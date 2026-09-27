/** 中文模块说明：准备独立 CUDA 12.4 推理扩展；复用基础 Chatterbox 能力中的模型。 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { constants as fsConstants, createReadStream, createWriteStream } from "node:fs";
import { once } from "node:events";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { finished } from "node:stream/promises";
import {
  CHATTERBOX_PACKAGE_VERSION,
  copyTreeWithoutBytecode,
  verifyChatterboxSource,
  verifyChatterboxWheelhouse
} from "./prepare-chatterbox-component.mjs";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOCK_SOURCE = path.join(REPOSITORY_ROOT, "scripts", "chatterbox-cuda.lock.txt");
const DEFINITION_SOURCE = path.join(REPOSITORY_ROOT, "scripts", "component-definitions", "chatterbox-cuda.json");
const DEFAULT_WHEELHOUSE = path.join(REPOSITORY_ROOT, ".package", "chatterbox-cuda-wheelhouse");
const WORKER_FILES = [
  ["scripts/chatterbox-worker.py", path.join(REPOSITORY_ROOT, "scripts", "chatterbox-worker.py")],
  ["scripts/worker_lifecycle.py", path.join(REPOSITORY_ROOT, "scripts", "worker_lifecycle.py")]
];
const MAX_ADDITIONAL_ARCHIVES = 16;
const MAX_GITHUB_ASSET_BYTES = 1_500_000_000;

export function groupCudaWheelhouseAssets(entries) {
  const groups = new Map();
  const required = new Set(["torch", "torchaudio"]);
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
    if (distribution === "torch" || distribution === "torchaudio") {
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

export async function prepareChatterboxCudaComponent({
  pythonExecutablePath,
  stagingDirectory,
  wheelhouseDirectory = DEFAULT_WHEELHOUSE,
  lockFilePath = LOCK_SOURCE,
  definitionPath = DEFINITION_SOURCE,
  generatedDefinitionPath,
  runCommand = execFileSync
}) {
  if (process.platform !== "win32" || process.arch !== "x64") {
    throw new Error("Chatterbox CUDA 扩展仅支持 Windows x64 构建环境");
  }
  const python = path.resolve(pythonExecutablePath);
  const stage = path.resolve(stagingDirectory);
  const definitionOutput = path.resolve(
    generatedDefinitionPath ?? path.join(path.dirname(stage), "chatterbox-cuda-definition.generated.json")
  );
  const pythonVersion = runCommand(
    python,
    ["-I", "-X", "utf8", "-c", "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true, timeout: 30_000, env: cleanEnvironment() }
  );
  if (pythonVersion.trim() !== "3.11") throw new Error("Chatterbox CUDA 扩展必须使用 Python 3.11 环境");

  const sitePackagesDirectory = runCommand(
    python,
    ["-I", "-X", "utf8", "-c", "import sysconfig; print(sysconfig.get_paths()['purelib'])"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true, timeout: 30_000, env: cleanEnvironment() }
  ).trim();
  const cudaTorchOutput = runCommand(
    python,
    [
      "-I",
      "-X",
      "utf8",
      "-c",
      "import json, torch; print(json.dumps({'version': torch.__version__, 'cuda': torch.version.cuda}))"
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true, timeout: 60_000, env: cleanEnvironment() }
  );
  const cudaTorch = JSON.parse(cudaTorchOutput.trim());
  if (cudaTorch.version !== "2.6.0+cu124" || cudaTorch.cuda !== "12.4") {
    throw new Error(
      `构建 Python 必须安装 PyTorch 2.6.0 CUDA 12.4，当前为 ${cudaTorch.version} / CUDA ${cudaTorch.cuda}`
    );
  }

  const source = await verifyChatterboxSource(sitePackagesDirectory);
  const lockText = await fs.readFile(lockFilePath, "utf8");
  if (!/^torch==2\.6\.0\+cu124\s/m.test(lockText) || !/^torchaudio==2\.6\.0\+cu124\s/m.test(lockText)) {
    throw new Error("CUDA 锁文件必须固定 torch 和 torchaudio 2.6.0+cu124");
  }
  const wheelhouse = await verifyChatterboxWheelhouse(wheelhouseDirectory, lockText);
  const wheelhouseFiles = await fs.readdir(wheelhouse.wheelhouse, { withFileTypes: true });
  if (wheelhouseFiles.some((entry) => !entry.isFile() || !/\.(?:whl|zip|tar\.gz)$/i.test(entry.name))) {
    throw new Error("CUDA wheelhouse 只能包含经锁文件哈希授权的 wheel 或源码归档");
  }
  if (await pathExists(stage)) throw new Error("Chatterbox CUDA 暂存目录已存在，拒绝覆盖");
  for (const sourcePath of [source.sitePackages, wheelhouse.wheelhouse, definitionOutput]) {
    if (pathsOverlap(stage, sourcePath)) throw new Error("暂存目录不能与源码、wheelhouse 或定义文件目录互相包含");
  }

  let stageCreated = false;
  try {
    await fs.mkdir(stage, { recursive: false });
    stageCreated = true;
    const vendor = path.join(stage, "vendor");
    await fs.mkdir(vendor);
    for (const packageName of ["chatterbox", `chatterbox_tts-${CHATTERBOX_PACKAGE_VERSION}.dist-info`]) {
      await copyTreeWithoutBytecode(path.join(source.sitePackages, packageName), path.join(vendor, packageName));
    }
    const targetWheelhouse = path.join(stage, "wheelhouse");
    await fs.mkdir(targetWheelhouse);
    const archiveEntries = [];
    const assembledFiles = [];
    for (const asset of wheelhouse.files) {
      const sourcePath = path.join(wheelhouse.wheelhouse, asset.name);
      if (
        asset.name.toLowerCase().startsWith("torch-") &&
        asset.name.toLowerCase().endsWith(".whl") &&
        asset.bytes > MAX_GITHUB_ASSET_BYTES
      ) {
        const parts = await splitFileIntoParts(sourcePath, path.join(targetWheelhouse, ".parts"));
        const relativeParts = parts.map((part) => path.relative(stage, part.path).split(path.sep).join("/"));
        assembledFiles.push({
          path: `wheelhouse/${asset.name}`,
          bytes: asset.bytes,
          sha256: asset.sha256,
          parts: relativeParts
        });
        for (const part of parts) {
          archiveEntries.push({
            name: part.filename,
            path: path.relative(stage, part.path).split(path.sep).join("/")
          });
        }
      } else {
        await fs.copyFile(sourcePath, path.join(targetWheelhouse, asset.name), fsConstants.COPYFILE_EXCL);
        if (asset.name.toLowerCase().endsWith(".whl")) {
          archiveEntries.push({ name: asset.name, path: `wheelhouse/${asset.name}` });
        }
      }
    }
    const additionalArchives = groupCudaWheelhouseAssets(archiveEntries);
    for (const [relativePath, sourcePath] of WORKER_FILES) {
      const destination = path.join(stage, ...relativePath.split("/"));
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.copyFile(sourcePath, destination, fsConstants.COPYFILE_EXCL);
    }
    await fs.writeFile(path.join(stage, "requirements.lock"), lockText, { flag: "wx" });

    const definition = JSON.parse(await fs.readFile(definitionPath, "utf8"));
    if (definition.id !== "chatterbox-cuda") throw new Error("CUDA 能力定义 id 必须为 chatterbox-cuda");
    definition.additionalArchives = additionalArchives;
    if (assembledFiles.length) definition.assembledFiles = assembledFiles;
    await fs.mkdir(path.dirname(definitionOutput), { recursive: true });
    await fs.writeFile(definitionOutput, JSON.stringify(definition, null, 2) + "\n", "utf8");

    let payloadBytes = 0;
    async function visit(directory) {
      for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
        const candidate = path.join(directory, entry.name);
        if (entry.isDirectory()) await visit(candidate);
        else if (entry.isFile()) payloadBytes += (await fs.stat(candidate)).size;
        else throw new Error(`CUDA 暂存目录包含不支持的文件类型：${candidate}`);
      }
    }
    await visit(stage);
    return {
      stagingDirectory: stage,
      generatedDefinitionPath: definitionOutput,
      wheelCount: wheelhouse.count,
      wheelhouseBytes: wheelhouse.bytes,
      payloadBytes,
      archiveCount: additionalArchives.length + 1
    };
  } catch (error) {
    if (stageCreated) await fs.rm(stage, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

export async function splitFileIntoParts(sourcePath, outputDirectory, maxPartBytes = MAX_GITHUB_ASSET_BYTES) {
  if (!Number.isSafeInteger(maxPartBytes) || maxPartBytes < 1) throw new Error("分片大小配置无效");
  await fs.mkdir(outputDirectory, { recursive: true });
  const parts = [];
  let partIndex = 0;
  let partBytes = 0;
  let partDigest = createHash("sha256");
  let output;
  let currentPart;
  const openPart = () => {
    const filename = `${path.basename(sourcePath)}.part-${String(++partIndex).padStart(4, "0")}`;
    const partPath = path.join(outputDirectory, filename);
    output = createWriteStream(partPath, { flags: "wx" });
    currentPart = { filename, path: partPath, bytes: 0, sha256: "" };
    parts.push(currentPart);
  };
  const closePart = async () => {
    if (!output || !currentPart) return;
    const writeFinished = finished(output);
    output.end();
    await writeFinished;
    currentPart.bytes = partBytes;
    currentPart.sha256 = partDigest.digest("hex");
    output = undefined;
    currentPart = undefined;
    partBytes = 0;
    partDigest = createHash("sha256");
  };

  try {
    for await (const inputChunk of createReadStream(sourcePath)) {
      const chunk = Buffer.from(inputChunk);
      let offset = 0;
      while (offset < chunk.length) {
        if (!output) openPart();
        const length = Math.min(maxPartBytes - partBytes, chunk.length - offset);
        const slice = chunk.subarray(offset, offset + length);
        if (!output.write(slice)) await once(output, "drain");
        partDigest.update(slice);
        partBytes += length;
        offset += length;
        if (partBytes === maxPartBytes) await closePart();
      }
    }
    if (output) await closePart();
    if (parts.length < 2) throw new Error("资产未超过单个分片限制，不需要分片");
    return parts;
  } catch (error) {
    if (output) {
      output.destroy();
      await finished(output).catch(() => undefined);
    }
    await Promise.all(parts.map((part) => fs.rm(part.path, { force: true }).catch(() => undefined)));
    throw error;
  }
}

function cleanEnvironment() {
  const environment = { ...process.env };
  for (const key of ["PYTHONHOME", "PYTHONPATH", "PYTHONUSERBASE", "HF_TOKEN"]) delete environment[key];
  environment.PYTHONNOUSERSITE = "1";
  if (process.platform === "win32") environment.PIP_CONFIG_FILE = "NUL";
  return environment;
}

function pathsOverlap(left, right) {
  const resolvedLeft = path.resolve(left);
  const resolvedRight = path.resolve(right);
  return isPathWithin(resolvedLeft, resolvedRight) || isPathWithin(resolvedRight, resolvedLeft);
}

function isPathWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
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
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value || values.has(key.slice(2))) throw new Error("命令行参数无效");
    values.set(key.slice(2), value);
  }
  const required = ["python", "stage"];
  const allowed = [...required, "wheelhouse", "lock", "definition", "definition-output"];
  if (required.some((key) => !values.has(key)) || [...values.keys()].some((key) => !allowed.includes(key))) {
    throw new Error(
      "用法：pnpm components:prepare-chatterbox-cuda -- --python <已安装 CUDA PyTorch 与固定 Chatterbox 源码的 Python 3.11 python.exe> --stage <新暂存目录> [--wheelhouse <哈希校验 CUDA wheelhouse>] [--lock <CUDA 锁文件>] [--definition <能力定义>] [--definition-output <构建器使用的生成定义>]"
    );
  }
  return {
    pythonExecutablePath: values.get("python"),
    stagingDirectory: values.get("stage"),
    ...(values.has("wheelhouse") ? { wheelhouseDirectory: values.get("wheelhouse") } : {}),
    ...(values.has("lock") ? { lockFilePath: values.get("lock") } : {}),
    ...(values.has("definition") ? { definitionPath: values.get("definition") } : {}),
    ...(values.has("definition-output") ? { generatedDefinitionPath: values.get("definition-output") } : {})
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await prepareChatterboxCudaComponent(parseArguments(process.argv.slice(2)));
    console.log("Chatterbox CUDA 暂存目录已准备：" + result.stagingDirectory);
    console.log("生成的能力定义：" + result.generatedDefinitionPath);
    console.log(`wheelhouse：${result.wheelCount} 个锁文件哈希匹配的 wheel（${result.wheelhouseBytes} bytes）`);
    console.log(`能力载荷：${result.payloadBytes} bytes；预计归档：${result.archiveCount} 个`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Chatterbox CUDA 能力包准备失败");
    process.exitCode = 1;
  }
}
