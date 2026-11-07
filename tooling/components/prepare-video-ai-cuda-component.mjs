// Anchor filesystem and CLI identity at the stable public entry.
const publicEntryUrl = new URL("../../scripts/prepare-video-ai-cuda-component.mjs", import.meta.url).href;

/** 中文模块说明：准备视频去字幕 GPU 扩展包（CUDA 12.4），复用基础包模型与 worker。 */
import { execFileSync } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertWorkerPythonVersion, assertWorkerWheelPython } from "./worker-python-policy.mjs";
import { sha256File, stageEngineDirectory } from "./prepare-video-ai-component.mjs";
import { splitFileIntoParts } from "./prepare-chatterbox-cuda-component.mjs";
import { stageSequenceBundle } from "../video-ai/sequence-bundle.mjs";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(publicEntryUrl)), "..");
const LOCK_SOURCE = path.join(REPOSITORY_ROOT, "scripts", "video-ai-cuda.lock.txt");
const DEFINITION_SOURCE = path.join(REPOSITORY_ROOT, "scripts", "component-definitions", "video-ai-cuda.json");
const PROPAINTER_DIRECTORY = path.join("models", "video-ai", "engines", "propainter");
/** 与 chatterbox-cuda 一致：单个 GitHub Release 资产留出安全余量，不得超过 1.5 GB。 */
const MAX_GITHUB_ASSET_BYTES = 1_500_000_000;
const MAX_ADDITIONAL_ARCHIVES = 16;

export function validateVideoAiCudaLock(lockText, platform = process.platform) {
  if (!/^torch==2\.6\.0\+cu124\s*\\?\s*$/m.test(lockText)) {
    throw new Error("视频去字幕 GPU 扩展锁文件必须固定 PyTorch 2.6.0+cu124");
  }
  if (platform === "win32") {
    // Windows 版 cu124 wheel 已内置 CUDA 12 运行库 DLL（cublas/cudnn/cudart 等在 torch/lib 下），
    // nvidia-* 是 Linux 才分发的 pip 包；在 Windows 上强制要求会让 GPU 扩展包永远无法准备。
    if (/^nvidia-[a-z0-9-]*==/m.test(lockText)) {
      throw new Error("Windows 视频去字幕 GPU 扩展锁文件不能包含 Linux 专用 nvidia-* 运行时包");
    }
    return;
  }
  if (!/^nvidia-cublas-cu12==/m.test(lockText)) {
    throw new Error("视频去字幕 GPU 扩展锁文件缺少 NVIDIA CUDA 12 运行时依赖");
  }
}

/**
 * 把 CUDA wheelhouse 资产按 GitHub Release 资产边界分组：torch 分片每个一组
 * （cuda-torch-part-000N），torchvision 单独一组，nvidia-* 各自成组；其余小 wheel
 * 留在主归档，避免无谓的分卷。
 */
export function groupVideoAiCudaWheelhouseAssets(entries) {
  const groups = new Map();
  const required = new Set(["torch", "torchvision"]);
  for (const entry of entries) {
    const filename = typeof entry === "string" ? entry : entry.name;
    const relativePath =
      typeof entry === "string" ? `wheelhouse/${filename}` : (entry.path ?? `wheelhouse/${filename}`);
    const torchPart = /^(torch-.+\.whl)\.part-(\d{4})$/i.exec(filename ?? "");
    if (
      !filename ||
      !relativePath ||
      relativePath.includes("\\") ||
      relativePath.split("/").some((part) => !part || part === "." || part === "..") ||
      (!torchPart && !filename.toLowerCase().endsWith(".whl"))
    ) {
      throw new Error(`CUDA wheelhouse 仅允许普通 wheel 文件或受控 torch 分片：${String(filename)}`);
    }
    const wheelFilename = torchPart?.[1] ?? filename;
    const distribution = wheelFilename.split("-")[0].toLowerCase().replaceAll("_", "-");
    let groupName;
    if (distribution === "torch" || distribution === "torchvision") {
      required.delete(distribution);
      groupName = `cuda-${distribution}${torchPart ? `-part-${torchPart[2]}` : ""}`;
    } else if (distribution.startsWith("nvidia-")) {
      groupName = `cuda-${distribution}`;
    } else {
      continue;
    }
    const paths = groups.get(groupName) ?? [];
    paths.push(relativePath);
    groups.set(groupName, paths);
  }
  if (required.size) throw new Error(`CUDA wheelhouse 缺少必需的 PyTorch wheel：${[...required].join("、")}`);
  if (groups.size > MAX_ADDITIONAL_ARCHIVES) {
    throw new Error(`CUDA wheelhouse 需要 ${groups.size} 个 GitHub 分片，已超过 ${MAX_ADDITIONAL_ARCHIVES} 个的限制`);
  }
  return [...groups]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, paths]) => ({ name, paths: paths.sort((left, right) => left.localeCompare(right)) }));
}

export async function prepareVideoAiCudaComponent({
  pythonExecutablePath,
  stagingDirectory,
  wheelhouseDirectory,
  propainterAssets,
  sequenceCacheDirectory,
  enableSequenceEngines = false,
  lockFilePath = sequenceCacheDirectory
    ? path.join(REPOSITORY_ROOT, "scripts", "video-ai-cuda-sequence.lock.txt")
    : LOCK_SOURCE,
  definitionPath = sequenceCacheDirectory
    ? path.join(REPOSITORY_ROOT, "scripts", "component-definitions", "video-ai-cuda-sequence.json")
    : DEFINITION_SOURCE,
  generatedDefinitionPath,
  stageSequence = stageSequenceBundle,
  runCommand = execFileSync
}) {
  if (typeof enableSequenceEngines !== "boolean" || (enableSequenceEngines && !sequenceCacheDirectory))
    throw new Error("启用时序引擎必须显式提供固定的 sequence-cache 资源");
  if (!(process.platform === "win32" && process.arch === "x64")) {
    throw new Error("视频去字幕 GPU 扩展包仅支持 Windows x64 构建环境");
  }
  const python = path.resolve(pythonExecutablePath);
  const stage = path.resolve(stagingDirectory);
  const definitionOutput = path.resolve(
    generatedDefinitionPath ?? path.join(path.dirname(stage), "video-ai-cuda-definition.generated.json")
  );
  const version = runCommand(
    python,
    ["-I", "-c", "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true, timeout: 30_000 }
  );
  assertWorkerPythonVersion(version);
  if (await pathExists(stage)) throw new Error("视频去字幕 GPU 暂存目录已存在，拒绝覆盖");

  const lockText = await fs.readFile(lockFilePath, "utf8");
  validateVideoAiCudaLock(lockText);
  if (sequenceCacheDirectory && (!/^einops==0\.8\.1\s/m.test(lockText) || !/^scipy==1\.17\.1\s/m.test(lockText)))
    throw new Error("时序 GPU 包缺少已经验证的 einops / scipy 锁定依赖");
  if (sequenceCacheDirectory && propainterAssets) throw new Error("不能混合旧引擎目录与新的固定时序资源");
  const definition = JSON.parse(await fs.readFile(definitionPath, "utf8"));
  if (definition.id !== "video-ai-cuda") throw new Error("CUDA 能力定义 id 必须为 video-ai-cuda");
  if (sequenceCacheDirectory && definition.version === "1.0.0-py312-cu1241")
    throw new Error("时序资源必须使用新版本，不能覆盖旧签名版本");
  if (enableSequenceEngines) {
    definition.purpose =
      "为视频去字幕增加 STTN 均衡档与 ProPainter 极致档（非商用内部试用）；复用基础包的 OCR、LaMa 和 Worker。";
    definition.installConditions.push(
      "本版本显式开放两套已接入的时序适配器，画质由使用者验收；安装后仍检查本机 CUDA 和显存，不承诺所有素材的修复效果。"
    );
  }
  const wheelhouseEntries = await fs.readdir(wheelhouseDirectory, { withFileTypes: true });
  const wheels = wheelhouseEntries.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".whl"));
  if (!wheels.length)
    throw new Error("GPU wheelhouse 为空；先用 scripts/video-ai-cuda.lock.txt 执行 pip download --require-hashes");
  for (const entry of wheels) assertWorkerWheelPython(entry.name);
  if (!wheels.some((entry) => /^torch-2\.6\.0(\+cu124)?-/.test(entry.name))) {
    throw new Error("GPU wheelhouse 缺少 PyTorch 2.6.0+cu124 wheel");
  }
  if (
    sequenceCacheDirectory &&
    (!wheels.some((entry) => entry.name.startsWith("einops-0.8.1-")) ||
      !wheels.some((entry) => entry.name.startsWith("scipy-1.17.1-")))
  )
    throw new Error("时序 GPU wheelhouse 缺少锁定的 einops / scipy wheel");

  let stageCreated = false;
  try {
    await fs.mkdir(stage, { recursive: false });
    stageCreated = true;
    const wheelhouse = path.join(stage, "wheelhouse");
    await fs.mkdir(wheelhouse);
    const archiveEntries = [];
    const assembledFiles = [];
    for (const entry of wheels) {
      const sourcePath = path.join(wheelhouseDirectory, entry.name);
      const wheelBytes = (await fs.stat(sourcePath)).size;
      if (
        entry.name.toLowerCase().startsWith("torch-") &&
        entry.name.toLowerCase().endsWith(".whl") &&
        wheelBytes > MAX_GITHUB_ASSET_BYTES
      ) {
        // torch cu124 wheel 约 2.5 GB，超过 GitHub Release 单资产上限；切成受控分片，
        // 安装端按 assembledFiles 的 parts 清单重新拼装后校验摘要。
        const parts = await splitFileIntoParts(sourcePath, path.join(wheelhouse, ".parts"));
        const relativeParts = parts.map((part) => path.relative(stage, part.path).split(path.sep).join("/"));
        assembledFiles.push({
          path: `wheelhouse/${entry.name}`,
          bytes: wheelBytes,
          sha256: await sha256File(sourcePath),
          parts: relativeParts
        });
        for (const part of parts) {
          archiveEntries.push({
            name: part.filename,
            path: path.relative(stage, part.path).split(path.sep).join("/")
          });
        }
      } else {
        await fs.copyFile(sourcePath, path.join(wheelhouse, entry.name), fsConstants.COPYFILE_EXCL);
        if (entry.name.toLowerCase().endsWith(".whl")) {
          archiveEntries.push({ name: entry.name, path: `wheelhouse/${entry.name}` });
        }
      }
    }
    const additionalArchives = groupVideoAiCudaWheelhouseAssets(archiveEntries);
    await fs.writeFile(path.join(stage, "requirements.lock"), lockText, { flag: "wx" });
    const provenance = { engines: {} };
    if (sequenceCacheDirectory) {
      const engineParent = path.join(stage, "models", "video-ai", "engines");
      await fs.mkdir(engineParent, { recursive: true });
      for (const engine of ["sttn", "propainter"]) {
        provenance.engines[engine] = await stageSequence({
          cacheRoot: sequenceCacheDirectory,
          destination: path.join(engineParent, engine),
          engine,
          adapterReady: enableSequenceEngines
        });
      }
    }
    if (propainterAssets) {
      const files = await stageEngineDirectory(propainterAssets, path.join(stage, ...PROPAINTER_DIRECTORY.split("/")));
      provenance.engines.propainter = files;
    }
    await fs.writeFile(path.join(stage, "PROVENANCE.json"), JSON.stringify(provenance, null, 2), { flag: "wx" });

    definition.additionalArchives = additionalArchives;
    if (assembledFiles.length) definition.assembledFiles = assembledFiles;
    await fs.mkdir(path.dirname(definitionOutput), { recursive: true });
    await fs.writeFile(
      definitionOutput,
      JSON.stringify(definition, null, 2) + "\n",
      sequenceCacheDirectory ? { encoding: "utf8", flag: "wx" } : "utf8"
    );

    return {
      stagingDirectory: stage,
      generatedDefinitionPath: definitionOutput,
      wheelCount: wheels.length,
      archiveCount: additionalArchives.length + 1,
      engines: Object.keys(provenance.engines)
    };
  } catch (error) {
    if (stageCreated) await fs.rm(stage, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

function pathExists(candidate) {
  return fs.lstat(candidate).then(
    () => true,
    (error) => {
      if (error?.code === "ENOENT") return false;
      throw error;
    }
  );
}

function parseArguments(argv) {
  const values = new Map();
  const allowed = [
    "python",
    "stage",
    "wheelhouse",
    "propainter-assets",
    "definition-output",
    "sequence-cache",
    "enable-sequence-engines"
  ];
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value || values.has(key.slice(2))) throw new Error("命令行参数无效");
    values.set(key.slice(2), value);
  }
  if (["python", "stage", "wheelhouse"].some((key) => !values.has(key))) {
    throw new Error(
      "用法：pnpm components:prepare-video-ai-cuda -- --python <Python 3.12 python.exe> --stage <新暂存目录> " +
        "--wheelhouse <已按 video-ai-cuda.lock.txt 下载的 wheel 目录> " +
        "[--propainter-assets <ProPainter 引擎目录>] [--sequence-cache <S01 固定资源缓存>] " +
        "[--definition-output <生成的派生定义 JSON 路径>] [--enable-sequence-engines true|false]"
    );
  }
  if ([...values.keys()].some((key) => !allowed.includes(key))) throw new Error("命令行参数无效");
  if (values.has("enable-sequence-engines") && !["true", "false"].includes(values.get("enable-sequence-engines")))
    throw new Error("--enable-sequence-engines 只能为 true 或 false");
  return {
    pythonExecutablePath: values.get("python"),
    stagingDirectory: values.get("stage"),
    wheelhouseDirectory: values.get("wheelhouse"),
    ...(values.has("sequence-cache") ? { sequenceCacheDirectory: values.get("sequence-cache") } : {}),
    enableSequenceEngines: values.get("enable-sequence-engines") === "true",
    ...(values.has("propainter-assets") ? { propainterAssets: values.get("propainter-assets") } : {}),
    ...(values.has("definition-output") ? { generatedDefinitionPath: values.get("definition-output") } : {})
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(publicEntryUrl)) {
  try {
    const result = await prepareVideoAiCudaComponent(parseArguments(process.argv.slice(2)));
    console.log("视频去字幕 GPU 暂存目录已准备：" + result.stagingDirectory);
    console.log("wheelhouse：" + result.wheelCount + " 个 CUDA 12.4 wheel");
    console.log("归档分卷：" + result.archiveCount + " 个（含主归档）");
    console.log("派生定义：" + result.generatedDefinitionPath);
    console.log("序列引擎：" + (result.engines.length ? result.engines.join(", ") : "未提供（仅复用基础包快速档）"));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "视频去字幕 GPU 扩展包准备失败");
    process.exitCode = 1;
  }
}
