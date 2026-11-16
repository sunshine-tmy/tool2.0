// Anchor filesystem and CLI identity at the stable public entry.
const publicEntryUrl = new URL("../../scripts/prepare-macos-ai-environments.mjs", import.meta.url).href;

/** 中文模块说明：按 Mac 哈希锁下载 wheel 并离线重建独立 AI 虚拟环境。 */
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createWriteStream } from "node:fs";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { assertPinnedUvVersion, selectMacOSLockDefinitions } from "./lock-macos-component-dependencies.mjs";
import MACOS_TOOLCHAIN from "./macos/toolchain-sources.json" with { type: "json" };
import MACOS_SOURCE_BUILDS from "./macos/source-builds.json" with { type: "json" };
import MACOS_RUNTIME_LIBRARIES from "./macos/runtime-libraries.json" with { type: "json" };
import { ensureStrictCodeSignature } from "./macos-code-signing.mjs";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(publicEntryUrl)), "..");
const DEFAULT_COMPONENTS = Object.freeze(["image-ai", "chatterbox", "video-ai"]);
const IMPORTS = Object.freeze({
  "image-ai": [
    "fastapi",
    "uvicorn",
    "pydantic",
    "PIL",
    "numpy",
    "pandas",
    "cv2",
    "torch",
    "torchvision",
    "basicsr",
    "realesrgan",
    "rembg",
    "transformers",
    "safetensors",
    "paddle",
    "paddleocr",
    "onnxruntime"
  ],
  chatterbox: [
    "fastapi",
    "uvicorn",
    "pydantic",
    "numpy",
    "librosa",
    "s3tokenizer",
    "torch",
    "torchaudio",
    "transformers",
    "diffusers",
    "safetensors",
    "spacy_pkuseg",
    "pykakasi",
    "pyloudnorm",
    "omegaconf",
    "huggingface_hub",
    "conformer",
    "perth"
  ],
  "video-ai": [
    "fastapi",
    "uvicorn",
    "pydantic",
    "PIL",
    "numpy",
    "cv2",
    "torch",
    "torchvision",
    "paddle",
    "paddleocr",
    "einops",
    "scipy"
  ]
});

export const MACOS_AI_ENVIRONMENT_HELP = `用法：pnpm components:prepare-macos-ai-environments -- --python <Python 3.12.14 绝对路径> --uv <uv ${MACOS_TOOLCHAIN.uv.version} 绝对路径> --output <全新绝对目录> [--components image-ai,chatterbox,video-ai] [--wheel-cache-root <缓存根目录>]

审计失败后可对现有输出目录使用 --audit-resume，只重跑隔离检查和 Mach-O 修复审计。

按锁下载带 SHA-256 的 macOS arm64 wheel；对缺少上游 wheel 的依赖，先按固定源码和补丁离线构建 wheel，再从 wheelhouse 安装到互相隔离的 venv。仅允许这些组件：${DEFAULT_COMPONENTS.join(", ")}。
环境安装后运行 pip check、业务依赖导入、wheel tag 和 Mach-O arm64 / 最低 macOS / 动态库审计。不会下载模型或启动应用。`;

export function parseMacOSAIEnvironmentArguments(argv) {
  const args = argv[0] === "--" ? argv.slice(1) : argv;
  if (args.length === 1 && args[0] === "--help") return { help: true };
  const values = new Map();
  let auditResume = false;
  for (let index = 0; index < args.length;) {
    const key = args[index];
    if (key === "--audit-resume") {
      if (auditResume) throw new Error("命令行参数无效");
      auditResume = true;
      index++;
      continue;
    }
    const value = args[index + 1];
    if (!key?.startsWith("--") || key === "--help" || !value || value.startsWith("--") || values.has(key.slice(2))) {
      throw new Error("命令行参数无效");
    }
    values.set(key.slice(2), value);
    index += 2;
  }
  const allowed = new Set(["python", "uv", "output", "components", "wheel-cache-root"]);
  if ([...values.keys()].some((key) => !allowed.has(key))) throw new Error("命令行参数无效");
  for (const key of ["python", "uv", "output"]) {
    if (!values.has(key) || !path.isAbsolute(values.get(key))) throw new Error(`--${key} 必须是绝对路径`);
  }
  if (values.has("wheel-cache-root") && !path.isAbsolute(values.get("wheel-cache-root"))) {
    throw new Error("--wheel-cache-root 必须是绝对路径");
  }
  const components = values.has("components") ? values.get("components").split(",") : DEFAULT_COMPONENTS;
  if (components.some((component) => !component)) throw new Error("--components 必须是逗号分隔的组件 ID");
  selectMacOSLockDefinitions(components);
  if (components.some((component) => !DEFAULT_COMPONENTS.includes(component))) {
    throw new Error(`仅可准备 ${DEFAULT_COMPONENTS.join(", ")} 环境`);
  }
  return {
    python: values.get("python"),
    uv: values.get("uv"),
    output: values.get("output"),
    components,
    wheelCacheRoot: values.get("wheel-cache-root"),
    auditResume
  };
}

export async function prepareMacOSAIEnvironments({
  python,
  uv,
  output,
  components = DEFAULT_COMPONENTS,
  wheelCacheRoot,
  auditResume = false,
  run = execFileSync
}) {
  if (process.platform !== "darwin" || process.arch !== "arm64") {
    throw new Error("Mac AI 环境必须在 Apple Silicon 原生构建机上准备");
  }
  const selected = parseComponentSelection(components);
  const pythonPath = path.resolve(python);
  const uvPath = path.resolve(uv);
  const outputPath = path.resolve(output);
  const wheelCacheRootPath = wheelCacheRoot ? path.resolve(wheelCacheRoot) : null;
  if (wheelCacheRoot && !path.isAbsolute(wheelCacheRoot)) throw new Error("wheel cache root 必须是绝对路径");
  const pythonInfo = JSON.parse(
    commandText(
      run(
        pythonPath,
        [
          "-I",
          "-c",
          "import json, platform, sys; print(json.dumps({'version': '.'.join(map(str, sys.version_info[:3])), 'machine': platform.machine()}))"
        ],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
      )
    )
  );
  if (pythonInfo.version !== MACOS_TOOLCHAIN.python.version || pythonInfo.machine !== "arm64") {
    throw new Error(
      `需要原生 Python ${MACOS_TOOLCHAIN.python.version} arm64，当前为 ${pythonInfo.version} ${pythonInfo.machine}`
    );
  }
  const uvVersion = commandText(
    run(uvPath, ["--version"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
  ).trim();
  assertPinnedUvVersion(uvVersion);
  const outputExists = await pathExists(outputPath);
  if (outputExists && !auditResume) throw new Error("输出目录必须是尚不存在的新目录");
  if (auditResume && !outputExists) throw new Error("--audit-resume 需要已存在的失败输出目录");
  if (auditResume && !(await pathExists(path.join(outputPath, "FAILED.json")))) {
    throw new Error("--audit-resume 仅适用于包含 FAILED.json 的输出目录");
  }
  if (!outputExists) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.mkdir(outputPath, { recursive: false, mode: 0o700 });
  }

  const environment = isolatedPipEnvironment(outputPath);
  const results = [];
  try {
    for (const component of selected) {
      const lockPath = path.join(REPOSITORY_ROOT, "tooling", "components", "macos", "locks", `${component}.lock.txt`);
      const lock = await fs.readFile(lockPath, "utf8");
      assertHashPinnedLock(lock, component);
      const componentDirectory = path.join(outputPath, component);
      const wheelhouse = path.join(componentDirectory, "wheelhouse");
      const venv = path.join(componentDirectory, "venv");
      const venvPython = path.join(venv, "bin", "python3.12");
      let effectiveLock;
      let sourceBuild = null;
      let reuseCache = false;
      if (auditResume) {
        if (!(await pathExists(wheelhouse)) || !(await pathExists(venvPython))) {
          throw new Error(`${component} 缺少 wheelhouse 或现有 venv，无法恢复审计`);
        }
        effectiveLock = await fs.readFile(path.join(componentDirectory, "LOCK.txt"), "utf8");
        assertHashPinnedLock(effectiveLock, component);
        if (component === "image-ai") sourceBuild = await describeBasicSRWheel(componentDirectory);
        if (component === "chatterbox") sourceBuild = await describeAntlrWheel(componentDirectory);
      } else {
        const sourcePackage =
          component === "image-ai" ? "basicsr" : component === "chatterbox" ? "antlr4-python3-runtime" : null;
        const lockForDownload = sourcePackage ? withoutRequirement(lock, sourcePackage) : lock;
        await fs.mkdir(wheelhouse, { recursive: true });
        await fs.writeFile(path.join(componentDirectory, "LOCK.txt"), lock, "utf8");
        if (lockForDownload !== lock) {
          await fs.writeFile(path.join(componentDirectory, "wheel-download.lock.txt"), lockForDownload, "utf8");
        }

        const cachedWheelhouse = wheelCacheRootPath ? path.join(wheelCacheRootPath, component, "wheelhouse") : null;
        reuseCache = Boolean(cachedWheelhouse && (await pathExists(cachedWheelhouse)));
        run(
          pythonPath,
          [
            "-I",
            "-m",
            "pip",
            "download",
            "--no-deps",
            "--require-hashes",
            "--only-binary=:all:",
            ...(reuseCache ? ["--no-index", "--find-links", cachedWheelhouse] : []),
            "--no-cache-dir",
            "--dest",
            wheelhouse,
            "-r",
            lockForDownload === lock
              ? path.join(componentDirectory, "LOCK.txt")
              : path.join(componentDirectory, "wheel-download.lock.txt")
          ],
          { cwd: REPOSITORY_ROOT, env: environment, stdio: "inherit", timeout: 90 * 60_000 }
        );
        if (component === "image-ai") {
          sourceBuild = await buildBasicSRWheel({ componentDirectory, wheelhouse, lock, pythonPath, run, environment });
        } else if (component === "chatterbox") {
          sourceBuild = await buildAntlrWheel({ componentDirectory, wheelhouse, lock, pythonPath, run, environment });
        }
        effectiveLock = sourceBuild ? addWheelHash(lock, sourceBuild.package, sourceBuild.wheel.sha256) : lock;
        await fs.writeFile(path.join(componentDirectory, "LOCK.txt"), effectiveLock, "utf8");
      }
      const wheels = await readWheelhouse(wheelhouse);
      const wheelTags = await verifyWheelTags(pythonPath, wheels, run, environment);
      if (!auditResume) {
        run(pythonPath, ["-I", "-m", "venv", venv], {
          cwd: REPOSITORY_ROOT,
          env: environment,
          stdio: "inherit",
          timeout: 5 * 60_000
        });
      }
      const venvConfig = await fs.readFile(path.join(venv, "pyvenv.cfg"), "utf8");
      assertVenvIsolated(venvConfig, venvPython, outputPath);
      if (!auditResume) {
        run(
          venvPython,
          [
            "-I",
            "-m",
            "pip",
            "install",
            "--require-hashes",
            "--no-index",
            "--find-links",
            wheelhouse,
            "--no-cache-dir",
            "-r",
            path.join(componentDirectory, "LOCK.txt")
          ],
          { cwd: REPOSITORY_ROOT, env: environment, stdio: "inherit", timeout: 90 * 60_000 }
        );
      }
      const nativeRuntime =
        component === "image-ai" || component === "video-ai"
          ? await preparePaddleRuntime({ componentDirectory, venvPython, outputPath, run })
          : null;
      const pipCheck = commandText(
        run(venvPython, ["-I", "-m", "pip", "check"], {
          cwd: REPOSITORY_ROOT,
          env: runtimeEnvironment(venv, outputPath),
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          timeout: 5 * 60_000
        })
      ).trim();
      if (pipCheck !== "No broken requirements found.") throw new Error(`${component} pip check 失败：${pipCheck}`);
      const paddleWheel = wheels.find((wheel) => wheel.filename.startsWith("paddlepaddle-"));
      const paddleWheelMinimumOS = nativeRuntime ? macOSMinimumFromWheelFilename(paddleWheel?.filename ?? "") : null;
      const nativeAudit = await auditNativeLibraries(venvPython, outputPath, run, { paddleWheelMinimumOS });
      const nativeRuntimeValidation = nativeRuntime ? validatePaddleRuntime(venvPython, outputPath, run) : null;
      const imports = await importComponentDependencies(component, venvPython, outputPath, run);
      const result = {
        component,
        lock: {
          path: path.relative(outputPath, path.join(componentDirectory, "LOCK.txt")),
          sha256: await sha256File(path.join(componentDirectory, "LOCK.txt")),
          sourceLockSha256: await sha256Buffer(Buffer.from(lock)),
          builtWheels: sourceBuild ? [sourceBuild] : []
        },
        wheelhouse: {
          count: wheels.length,
          totalBytes: wheels.reduce((sum, wheel) => sum + wheel.bytes, 0),
          wheels,
          compatibleTags: wheelTags
        },
        wheelCache: auditResume
          ? { reused: true, validatedOffline: true, mode: "audit-resume" }
          : reuseCache
            ? {
                path: path.relative(wheelCacheRootPath, path.join(wheelCacheRootPath, component, "wheelhouse")),
                validatedOffline: true
              }
            : { reused: false },
        venv: {
          path: path.relative(outputPath, venv),
          python: venvPython,
          version: pythonInfo.version,
          includeSystemSitePackages: false
        },
        pipCheck,
        nativeRuntime,
        nativeRuntimeValidation,
        imports,
        nativeAudit
      };
      await fs.writeFile(
        path.join(componentDirectory, "PROVENANCE.json"),
        `${JSON.stringify(result, null, 2)}\n`,
        "utf8"
      );
      results.push(result);
    }
    const manifest = {
      schemaVersion: 1,
      platform: "darwin-arm64",
      pythonVersion: pythonInfo.version,
      uvVersion,
      components: results,
      modelValidation: "not_run",
      networkUse:
        "hash-verified wheel, source, and fixed Homebrew bottle downloads; wheel building and venv installation were offline"
    };
    await fs.writeFile(path.join(outputPath, "MANIFEST.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    if (auditResume) await fs.unlink(path.join(outputPath, "FAILED.json")).catch(() => undefined);
    return manifest;
  } catch (error) {
    await fs
      .writeFile(
        path.join(outputPath, "FAILED.json"),
        `${JSON.stringify({ schemaVersion: 1, error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`,
        "utf8"
      )
      .catch(() => undefined);
    throw error;
  }
}

export function parseComponentSelection(components) {
  if (!Array.isArray(components) || !components.length || new Set(components).size !== components.length) {
    throw new Error("Mac AI 组件选择为空或含有重复项");
  }
  if (components.some((component) => !DEFAULT_COMPONENTS.includes(component))) {
    throw new Error(`仅可准备 ${DEFAULT_COMPONENTS.join(", ")} 环境`);
  }
  return components;
}

export function assertHashPinnedLock(lock, component = "组件") {
  const lines = lock.split(/\r?\n/u);
  const blockStarts = lines
    .map((line, index) => (/^[A-Za-z0-9_.-]+==[^\s\\]+/u.test(line) ? index : -1))
    .filter((index) => index >= 0);
  if (!blockStarts.length) throw new Error(`${component} 锁文件缺少固定版本`);
  for (const start of blockStarts) {
    const block = [];
    let index = start;
    while (index < lines.length) {
      const line = lines[index];
      block.push(line);
      index++;
      if (!/\\\s*$/u.test(line)) break;
    }
    if (!block.some((line) => /--hash=sha256:[a-f0-9]{64}/u.test(line))) {
      throw new Error(`${component} 锁文件中存在未哈希固定项`);
    }
  }
}

export function withoutRequirement(lock, packageName) {
  const wanted = normalizePackageName(packageName);
  const lines = lock.split(/\r?\n/u);
  const result = [];
  let removed = 0;
  for (let index = 0; index < lines.length;) {
    const match = lines[index].match(/^([A-Za-z0-9_.-]+)==/u);
    if (!match || normalizePackageName(match[1]) !== wanted) {
      result.push(lines[index++]);
      continue;
    }
    let continued;
    do {
      continued = /\\\s*$/u.test(lines[index] ?? "");
      index++;
    } while (continued && index < lines.length);
    removed++;
    while (index < lines.length && /^\s+# via\b/u.test(lines[index])) index++;
  }
  const filtered = result.join("\n").replace(/\n{3,}/gu, "\n\n");
  if (removed !== 1) throw new Error(`下载锁中应恰有一个 ${packageName} 项`);
  if (!filtered.trim()) throw new Error("下载锁不得为空");
  return filtered;
}

export function addWheelHash(lock, packageName, wheelHash) {
  if (!/^[a-f0-9]{64}$/u.test(wheelHash)) throw new Error("构建 wheel 的 SHA-256 无效");
  const lines = lock.split(/\r?\n/u);
  let start = -1;
  for (let index = 0; index < lines.length; index++) {
    const match = lines[index].match(/^([A-Za-z0-9_.-]+)==/u);
    if (match && normalizePackageName(match[1]) === normalizePackageName(packageName)) {
      start = index;
      break;
    }
  }
  if (start < 0) throw new Error(`锁文件缺少 ${packageName}`);
  let end = start;
  while (/\\\s*$/u.test(lines[end] ?? "") && end + 1 < lines.length) end++;
  const existing = lines.slice(start, end + 1).join("\n");
  if (existing.includes(`--hash=sha256:${wheelHash}`)) return lock;
  lines[end] = lines[end].replace(/\s*\\\s*$/u, "").replace(/\s*$/u, "") + " \\";
  lines.splice(end + 1, 0, `    --hash=sha256:${wheelHash}`);
  return lines.join("\n");
}

export function assertVenvIsolated(config, python, root) {
  if (!/^include-system-site-packages\s*=\s*false\s*$/imu.test(config)) {
    throw new Error("venv 不得启用 system site-packages");
  }
  if (!python.startsWith(`${root}${path.sep}`)) throw new Error("venv Python 必须位于本次验证目录");
}

export function assertNativeMachO({ fileOutput, architectures, loadCommands, dylibs, minimumOS = "14.0", name }) {
  if (!/Mach-O/u.test(fileOutput) || !architectures.split(/\s+/u).includes("arm64")) {
    throw new Error(`${name} 必须包含原生 arm64 Mach-O 架构`);
  }
  const minOS =
    loadCommands.match(/cmd LC_BUILD_VERSION[\s\S]*?\bminos\s+(\d+(?:\.\d+){1,2})/u)?.[1] ??
    loadCommands.match(/cmd LC_VERSION_MIN_MACOSX[\s\S]*?\bversion\s+(\d+(?:\.\d+){1,2})/u)?.[1];
  if (!minOS || compareVersions(minOS, minimumOS) > 0) {
    throw new Error(`${name} 的最低系统目标缺失或高于 macOS ${minimumOS}`);
  }
  for (const line of otoolBody(dylibs)) {
    const dependency = line.trim().split(/\s+/u)[0];
    if (!dependency) continue;
    if (isDeveloperPath(dependency) || /\.package\/macos-validation/u.test(dependency)) {
      throw new Error(`${name} 引用了开发机路径：${dependency}`);
    }
    if (
      dependency.startsWith("/") &&
      !(dependency.startsWith("/usr/lib/") || dependency.startsWith("/System/Library/"))
    ) {
      throw new Error(`${name} 引用了非系统绝对动态库：${dependency}`);
    }
  }
  const loadCommandDetails = otoolBody(loadCommands).join("\n");
  if (
    /\/Users\/|\/DLC\/|\/opt\/homebrew|\/usr\/local\/opt|@@HOMEBREW_PREFIX@@|\.package\/macos-validation/u.test(
      loadCommandDetails
    )
  ) {
    throw new Error(`${name} 的 Mach-O load commands 含开发机路径`);
  }
  return { minimumOS: minOS, architectures: architectures.trim().split(/\s+/u) };
}

export function developerRpaths(loadCommands) {
  const found = new Set();
  for (const command of loadCommands.split(/(?=Load command \d+)/u)) {
    if (!/\bcmd LC_RPATH\b/u.test(command)) continue;
    const rpath = command.match(/^\s*path\s+(.+?)\s+\(offset \d+\)\s*$/mu)?.[1];
    if (rpath && isDeveloperPath(rpath)) found.add(rpath);
  }
  return [...found];
}

export function developerInstallIds(loadCommands) {
  const found = [];
  for (const command of loadCommands.split(/(?=Load command \d+)/u)) {
    if (!/\bcmd LC_ID_DYLIB\b/u.test(command)) continue;
    const installId = command.match(/^\s*name\s+(.+?)\s+\(offset \d+\)\s*$/mu)?.[1];
    if (installId && isDeveloperPath(installId)) {
      found.push({ original: installId, normalized: `@loader_path/${path.posix.basename(installId)}` });
    }
  }
  return found;
}

export function developerDylibDependencies(loadCommands) {
  const found = new Map();
  for (const command of loadCommands.split(/(?=Load command \d+)/u)) {
    if (!/\bcmd LC_(?:LOAD|REEXPORT|LOAD_WEAK|LOAD_UPWARD)_DYLIB\b/u.test(command)) continue;
    const dependency = command.match(/^\s*name\s+(.+?)\s+\(offset \d+\)\s*$/mu)?.[1];
    if (!dependency) continue;
    const gccRuntimeAlias = dependency === "@rpath/libgcc_s.1.1.dylib";
    if (!isDeveloperPath(dependency) && !gccRuntimeAlias) continue;
    const replacement = runtimeDependencyReplacement(dependency);
    if (!replacement) throw new Error(`缺少受支持的动态库替代项：${dependency}`);
    found.set(dependency, replacement);
  }
  return [...found].map(([original, normalized]) => ({ original, normalized }));
}

export function runtimeDependencyReplacement(dependency) {
  const filename = path.posix.basename(dependency);
  if (filename === "libgcc_s.1.1.dylib") return "@loader_path/libgcc_s.1.dylib";
  if (["libopenblas.0.dylib", "libgfortran.5.dylib", "libquadmath.0.dylib", "libgcc_s.1.dylib"].includes(filename)) {
    return `@loader_path/${filename}`;
  }
  if (["libgomp.1.dylib", "libomp.dylib"].includes(filename)) {
    return "@loader_path/../../torch/lib/libomp.dylib";
  }
  return null;
}

export function macOSMinimumFromWheelFilename(filename) {
  const match = filename.match(/macosx_(\d+)_(\d+)_arm64\.whl$/u);
  if (!match) throw new Error(`缺少 macOS arm64 wheel 部署标签：${filename}`);
  return `${match[1]}.${match[2]}`;
}

function isolatedPipEnvironment(output) {
  const env = { ...process.env };
  for (const key of [
    "PYTHONHOME",
    "PYTHONPATH",
    "PYTHONUSERBASE",
    "PIP_CONFIG_FILE",
    "PIP_INDEX_URL",
    "PIP_EXTRA_INDEX_URL",
    "PIP_TRUSTED_HOST",
    "PIP_NO_INDEX",
    "VIRTUAL_ENV",
    "DYLD_LIBRARY_PATH",
    "DYLD_FALLBACK_LIBRARY_PATH"
  ])
    delete env[key];
  env.PYTHONNOUSERSITE = "1";
  env.PIP_CONFIG_FILE = os.devNull;
  env.PIP_NO_INPUT = "1";
  env.PIP_DISABLE_PIP_VERSION_CHECK = "1";
  env.PIP_CACHE_DIR = path.join(output, "pip-cache");
  env.SOURCE_DATE_EPOCH = "0";
  return env;
}

async function buildBasicSRWheel({ componentDirectory, wheelhouse, lock, pythonPath, run, environment }) {
  const definition = MACOS_SOURCE_BUILDS.basicsr;
  if (!definition || definition.version !== "1.4.2") throw new Error("BasicSR 源码构建定义缺失或版本不符");
  const buildsDirectory = path.join(componentDirectory, "source-builds", "basicsr-1.4.2");
  const sourceArchive = path.join(buildsDirectory, "basicsr-1.4.2.tar.gz");
  const sourceDirectory = path.join(buildsDirectory, "source");
  const patchPath = path.join(REPOSITORY_ROOT, definition.patchPath);
  const patch = await fs.readFile(patchPath);
  const patchSha256 = await sha256Buffer(patch);
  if (patchSha256 !== definition.patchSha256) throw new Error("BasicSR 可复现构建补丁 SHA-256 校验失败");
  await fs.mkdir(buildsDirectory, { recursive: true });
  const sourceSha256 = await downloadFixedFile(definition.url, sourceArchive, definition.sha256);
  const listed = commandText(
    run("/usr/bin/tar", ["-tzf", sourceArchive], {
      cwd: componentDirectory,
      env: environment,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 4 * 1024 * 1024
    })
  );
  const members = listed.split(/\r?\n/u).filter(Boolean);
  if (
    !members.length ||
    members.some((member) => member.startsWith("/") || member.split("/").some((part) => part === "..")) ||
    members.some((member) => !member.startsWith("basicsr-1.4.2/"))
  ) {
    throw new Error("BasicSR 源码归档包含异常路径");
  }
  await fs.mkdir(sourceDirectory, { recursive: true });
  run("/usr/bin/tar", ["-xzf", sourceArchive, "--no-same-owner", "-C", sourceDirectory], {
    cwd: componentDirectory,
    env: environment,
    stdio: "inherit",
    timeout: 2 * 60_000
  });
  const extractedSource = path.join(sourceDirectory, "basicsr-1.4.2");
  run("/usr/bin/patch", ["--batch", "--forward", "-p1", "-i", patchPath], {
    cwd: extractedSource,
    env: environment,
    stdio: "inherit",
    timeout: 60_000
  });

  const buildVenv = path.join(buildsDirectory, "venv");
  run(pythonPath, ["-I", "-m", "venv", buildVenv], {
    cwd: REPOSITORY_ROOT,
    env: environment,
    stdio: "inherit",
    timeout: 5 * 60_000
  });
  const buildPython = path.join(buildVenv, "bin", "python3.12");
  const buildLock = selectRequirementBlocks(lock, ["cython", "numpy", "setuptools", "torch"]);
  const buildLockPath = path.join(buildsDirectory, "build-requirements.lock.txt");
  await fs.writeFile(buildLockPath, buildLock, "utf8");
  run(
    buildPython,
    [
      "-I",
      "-m",
      "pip",
      "install",
      "--no-deps",
      "--require-hashes",
      "--no-index",
      "--find-links",
      wheelhouse,
      "-r",
      buildLockPath
    ],
    {
      cwd: componentDirectory,
      env: environment,
      stdio: "inherit",
      timeout: 20 * 60_000
    }
  );
  run(
    buildPython,
    [
      "-I",
      "-m",
      "pip",
      "wheel",
      "--no-deps",
      "--no-build-isolation",
      "--no-cache-dir",
      "--wheel-dir",
      wheelhouse,
      extractedSource
    ],
    {
      cwd: extractedSource,
      env: { ...environment, BASICSR_EXT: "0", SOURCE_DATE_EPOCH: "0", TZ: "UTC", LC_ALL: "C" },
      stdio: "inherit",
      timeout: 20 * 60_000
    }
  );
  const builtWheel = path.join(wheelhouse, "basicsr-1.4.2-py3-none-any.whl");
  if (!(await pathExists(builtWheel))) throw new Error("BasicSR 1.4.2 可复现构建没有生成预期的纯 Python wheel");
  const wheel = {
    filename: path.basename(builtWheel),
    bytes: (await fs.stat(builtWheel)).size,
    sha256: await sha256File(builtWheel)
  };
  return {
    package: "basicsr",
    version: definition.version,
    source: { url: definition.url, sha256: sourceSha256 },
    patch: { path: definition.patchPath, sha256: patchSha256 },
    buildRequirements: ["cython", "numpy", "setuptools", "torch"],
    buildCommand: "python -m pip wheel --no-deps --no-build-isolation --no-cache-dir",
    environment: { SOURCE_DATE_EPOCH: 0, BASICSR_EXT: "0", timezone: "UTC", locale: "C" },
    wheel
  };
}

async function describeBasicSRWheel(componentDirectory) {
  const definition = MACOS_SOURCE_BUILDS.basicsr;
  const buildDirectory = path.join(componentDirectory, "source-builds", "basicsr-1.4.2");
  const sourceArchive = path.join(buildDirectory, "basicsr-1.4.2.tar.gz");
  const builtWheel = path.join(componentDirectory, "wheelhouse", "basicsr-1.4.2-py3-none-any.whl");
  const patchSha256 = await sha256File(path.join(REPOSITORY_ROOT, definition.patchPath));
  const sourceSha256 = await sha256File(sourceArchive);
  if (patchSha256 !== definition.patchSha256 || sourceSha256 !== definition.sha256 || !(await pathExists(builtWheel))) {
    throw new Error("BasicSR 已构建 wheel、固定源码或补丁校验失败，无法恢复审计");
  }
  return {
    package: "basicsr",
    version: definition.version,
    source: { url: definition.url, sha256: sourceSha256 },
    patch: { path: definition.patchPath, sha256: patchSha256 },
    buildRequirements: ["cython", "numpy", "setuptools", "torch"],
    buildCommand: "python -m pip wheel --no-deps --no-build-isolation --no-cache-dir",
    environment: { SOURCE_DATE_EPOCH: 0, BASICSR_EXT: "0", timezone: "UTC", locale: "C" },
    wheel: {
      filename: path.basename(builtWheel),
      bytes: (await fs.stat(builtWheel)).size,
      sha256: await sha256File(builtWheel)
    }
  };
}

async function buildAntlrWheel({ componentDirectory, wheelhouse, lock, pythonPath, run, environment }) {
  const definition = MACOS_SOURCE_BUILDS["antlr4-python3-runtime"];
  if (!definition || definition.version !== "4.9.3") throw new Error("ANTLR Python runtime 源码构建定义缺失或版本不符");
  const buildsDirectory = path.join(componentDirectory, "source-builds", "antlr4-python3-runtime-4.9.3");
  const sourceArchive = path.join(buildsDirectory, "antlr4-python3-runtime-4.9.3.tar.gz");
  const sourceDirectory = path.join(buildsDirectory, "source");
  await fs.mkdir(buildsDirectory, { recursive: true });
  const sourceSha256 = await downloadFixedFile(definition.url, sourceArchive, definition.sha256);
  const listed = commandText(
    run("/usr/bin/tar", ["-tzf", sourceArchive], {
      cwd: componentDirectory,
      env: environment,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 4 * 1024 * 1024
    })
  );
  const members = listed.split(/\r?\n/u).filter(Boolean);
  if (
    !members.length ||
    members.some((member) => member.startsWith("/") || member.split("/").some((part) => part === "..")) ||
    members.some((member) => !member.startsWith("antlr4-python3-runtime-4.9.3/"))
  ) {
    throw new Error("ANTLR Python runtime 源码归档包含异常路径");
  }
  await fs.mkdir(sourceDirectory, { recursive: true });
  run("/usr/bin/tar", ["-xzf", sourceArchive, "--no-same-owner", "-C", sourceDirectory], {
    cwd: componentDirectory,
    env: environment,
    stdio: "inherit",
    timeout: 2 * 60_000
  });

  const buildVenv = path.join(buildsDirectory, "venv");
  run(pythonPath, ["-I", "-m", "venv", buildVenv], {
    cwd: REPOSITORY_ROOT,
    env: environment,
    stdio: "inherit",
    timeout: 5 * 60_000
  });
  const buildPython = path.join(buildVenv, "bin", "python3.12");
  const buildLock = selectRequirementBlocks(lock, definition.buildRequirements);
  const buildLockPath = path.join(buildsDirectory, "build-requirements.lock.txt");
  await fs.writeFile(buildLockPath, buildLock, "utf8");
  run(
    buildPython,
    [
      "-I",
      "-m",
      "pip",
      "install",
      "--no-deps",
      "--require-hashes",
      "--no-index",
      "--find-links",
      wheelhouse,
      "-r",
      buildLockPath
    ],
    {
      cwd: componentDirectory,
      env: environment,
      stdio: "inherit",
      timeout: 20 * 60_000
    }
  );
  const extractedSource = path.join(sourceDirectory, "antlr4-python3-runtime-4.9.3");
  run(
    buildPython,
    [
      "-I",
      "-m",
      "pip",
      "wheel",
      "--no-deps",
      "--no-build-isolation",
      "--no-cache-dir",
      "--wheel-dir",
      wheelhouse,
      extractedSource
    ],
    {
      cwd: extractedSource,
      env: { ...environment, SOURCE_DATE_EPOCH: "0", TZ: "UTC", LC_ALL: "C", PYTHONHASHSEED: "0" },
      stdio: "inherit",
      timeout: 20 * 60_000
    }
  );
  const builtWheel = path.join(wheelhouse, "antlr4_python3_runtime-4.9.3-py3-none-any.whl");
  if (!(await pathExists(builtWheel))) throw new Error("ANTLR Python runtime 4.9.3 没有生成预期的纯 Python wheel");
  const wheel = {
    filename: path.basename(builtWheel),
    bytes: (await fs.stat(builtWheel)).size,
    sha256: await sha256File(builtWheel)
  };
  return {
    package: "antlr4-python3-runtime",
    version: definition.version,
    source: { url: definition.url, sha256: sourceSha256 },
    buildRequirements: definition.buildRequirements,
    buildCommand: "python -m pip wheel --no-deps --no-build-isolation --no-cache-dir",
    environment: { SOURCE_DATE_EPOCH: 0, timezone: "UTC", locale: "C", PYTHONHASHSEED: 0 },
    wheel
  };
}

async function describeAntlrWheel(componentDirectory) {
  const definition = MACOS_SOURCE_BUILDS["antlr4-python3-runtime"];
  const buildDirectory = path.join(componentDirectory, "source-builds", "antlr4-python3-runtime-4.9.3");
  const sourceArchive = path.join(buildDirectory, "antlr4-python3-runtime-4.9.3.tar.gz");
  const builtWheel = path.join(componentDirectory, "wheelhouse", "antlr4_python3_runtime-4.9.3-py3-none-any.whl");
  const sourceSha256 = await sha256File(sourceArchive);
  if (sourceSha256 !== definition.sha256 || !(await pathExists(builtWheel))) {
    throw new Error("ANTLR Python runtime wheel 或固定源码校验失败，无法恢复审计");
  }
  return {
    package: "antlr4-python3-runtime",
    version: definition.version,
    source: { url: definition.url, sha256: sourceSha256 },
    buildRequirements: definition.buildRequirements,
    buildCommand: "python -m pip wheel --no-deps --no-build-isolation --no-cache-dir",
    environment: { SOURCE_DATE_EPOCH: 0, timezone: "UTC", locale: "C", PYTHONHASHSEED: 0 },
    wheel: {
      filename: path.basename(builtWheel),
      bytes: (await fs.stat(builtWheel)).size,
      sha256: await sha256File(builtWheel)
    }
  };
}

async function downloadFixedFile(url, destination, expectedSha256) {
  if (!/^https:\/\/files\.pythonhosted\.org\//u.test(url))
    throw new Error("源码下载必须来自已配置的 Python 官方文件主机");
  if (await pathExists(destination)) {
    const existing = await sha256File(destination);
    if (existing === expectedSha256) return existing;
    await fs.unlink(destination);
  }
  const response = await fetch(url, { redirect: "error" });
  if (!response.ok) throw new Error(`源码下载失败：HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const hash = await sha256Buffer(bytes);
  if (hash !== expectedSha256) throw new Error("BasicSR 源码 SHA-256 校验失败");
  await fs.writeFile(destination, bytes, { mode: 0o600, flag: "wx" });
  return hash;
}

async function preparePaddleRuntime({ componentDirectory, venvPython, outputPath, run }) {
  const definition = MACOS_RUNTIME_LIBRARIES.openblas;
  const runtimeDirectory = path.join(componentDirectory, "source-builds", "paddle-runtime", "openblas");
  const archive = path.join(runtimeDirectory, `openblas-${definition.version}-${definition.platform}.bottle.tar.gz`);
  const sharedArchive = path.join(REPOSITORY_ROOT, ".package", "macos-artifact-cache", path.basename(archive));
  const extracted = path.join(runtimeDirectory, "extracted");
  const packageRoot = path.join(path.dirname(path.dirname(venvPython)), "lib", "python3.12", "site-packages");
  const paddleLibraries = path.join(packageRoot, "paddle", "libs");
  const sourceLibrary = path.join(extracted, "openblas", definition.version, "lib", "libopenblas.0.dylib");
  const sourceLicense = path.join(extracted, "openblas", definition.version, "LICENSE");
  const installedLibrary = path.join(paddleLibraries, "libopenblas.0.dylib");
  const installedLicense = path.join(paddleLibraries, "licenses", "OPENBLAS-LICENSE.txt");
  await fs.mkdir(runtimeDirectory, { recursive: true });
  const bottleSha256 = await downloadHomebrewBottle(definition, sharedArchive);
  if (!(await pathExists(archive)) || (await sha256File(archive)) !== bottleSha256) {
    await fs.copyFile(sharedArchive, archive);
  }
  const members = commandText(
    run("/usr/bin/tar", ["-tzf", archive], {
      cwd: runtimeDirectory,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 4 * 1024 * 1024
    })
  )
    .split(/\r?\n/u)
    .filter(Boolean);
  if (
    !members.length ||
    members.some((member) => member.startsWith("/") || member.split("/").some((part) => part === "..")) ||
    members.some((member) => !member.startsWith(`openblas/${definition.version}/`))
  ) {
    throw new Error("OpenBLAS bottle 包含异常归档路径");
  }
  await fs.rm(extracted, { recursive: true, force: true });
  await fs.mkdir(extracted, { recursive: true });
  run("/usr/bin/tar", ["-xzf", archive, "--no-same-owner", "-C", extracted], {
    cwd: runtimeDirectory,
    stdio: "inherit",
    timeout: 2 * 60_000
  });
  const sourceLibraryFile = commandText(run("/usr/bin/file", [sourceLibrary], { encoding: "utf8" }));
  const sourceArchitectures = commandText(run("/usr/bin/lipo", ["-archs", sourceLibrary], { encoding: "utf8" })).trim();
  const sourceLoadCommands = commandText(run("/usr/bin/otool", ["-l", sourceLibrary], { encoding: "utf8" }));
  const sourceMinOS =
    sourceLoadCommands.match(/cmd LC_BUILD_VERSION[\s\S]*?\bminos\s+(\d+(?:\.\d+){1,2})/u)?.[1] ??
    sourceLoadCommands.match(/cmd LC_VERSION_MIN_MACOSX[\s\S]*?\bversion\s+(\d+(?:\.\d+){1,2})/u)?.[1];
  if (
    !/Mach-O/u.test(sourceLibraryFile) ||
    !sourceArchitectures.split(/\s+/u).includes("arm64") ||
    sourceMinOS !== "14.0"
  ) {
    throw new Error("OpenBLAS bottle 内 dylib 必须是 arm64 且最低目标为 macOS 14.0");
  }
  await fs.mkdir(path.dirname(installedLicense), { recursive: true });
  await fs.rm(installedLibrary, { force: true });
  await fs.rm(installedLicense, { force: true });
  await fs.copyFile(sourceLibrary, installedLibrary);
  await fs.copyFile(sourceLicense, installedLicense);
  const relativeLibrary = path.relative(packageRoot, installedLibrary).split(path.sep).join("/");
  const relativeLicense = path.relative(packageRoot, installedLicense).split(path.sep).join("/");
  run(
    venvPython,
    [
      "-I",
      "-c",
      ADD_RECORD_ENTRIES,
      packageRoot,
      JSON.stringify([
        { relative: relativeLibrary, path: installedLibrary },
        { relative: relativeLicense, path: installedLicense }
      ])
    ],
    {
      cwd: outputPath,
      env: runtimeEnvironment(path.dirname(path.dirname(venvPython)), outputPath),
      stdio: "inherit",
      timeout: 60_000
    }
  );
  const provenance = {
    provider: "Homebrew Core bottle",
    version: definition.version,
    platform: definition.platform,
    url: definition.url,
    sha256: bottleSha256,
    sourceLibrary: "openblas/0.3.34/lib/libopenblas.0.dylib",
    sourceLicense: "openblas/0.3.34/LICENSE",
    license: definition.license,
    installed: [
      { path: relativeLibrary, sha256: await sha256File(installedLibrary) },
      { path: relativeLicense, sha256: await sha256File(installedLicense) }
    ],
    runtimeOverrides: {
      openblas: "@loader_path/libopenblas.0.dylib",
      libgfortran: "@loader_path/libgfortran.5.dylib",
      libquadmath: "@loader_path/libquadmath.0.dylib",
      libgomp: "@loader_path/../../torch/lib/libomp.dylib",
      libomp: "@loader_path/../../torch/lib/libomp.dylib"
    }
  };
  const provenancePath = path.join(componentDirectory, "PADDLE-RUNTIME.json");
  await fs.writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`, "utf8");
  return { path: path.relative(outputPath, provenancePath), ...provenance };
}

function validatePaddleRuntime(python, outputPath, run) {
  const sitePackages = path.join(path.dirname(path.dirname(python)), "lib", "python3.12", "site-packages");
  const libraries = [
    path.join(sitePackages, "paddle", "libs", "libblas.dylib"),
    path.join(sitePackages, "paddle", "libs", "liblapack.dylib")
  ];
  const code =
    "import ctypes, json, sys; loaded=[ctypes.CDLL(path)._name for path in sys.argv[1:]]; print(json.dumps({'loaded':loaded}))";
  const result = JSON.parse(
    commandText(
      run(python, ["-I", "-c", code, ...libraries], {
        cwd: outputPath,
        env: runtimeEnvironment(path.dirname(path.dirname(python)), outputPath),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 5 * 60_000
      })
    )
  );
  if (JSON.stringify(result.loaded) !== JSON.stringify(libraries)) {
    throw new Error("Paddle OpenBLAS / GCC runtime 动态加载验证失败");
  }
  return result;
}

async function downloadHomebrewBottle(definition, destination) {
  const expected = definition.sha256;
  const url = new URL(definition.url);
  if (url.hostname !== "ghcr.io" || url.pathname !== `/v2/homebrew/core/openblas/blobs/sha256:${expected}`) {
    throw new Error("Homebrew bottle URL 与固定 SHA-256 不匹配");
  }
  if (await pathExists(destination)) {
    const existing = await sha256File(destination);
    if (existing === expected) return existing;
    await fs.unlink(destination);
  }
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const tokenResponse = await fetch(
    "https://ghcr.io/token?scope=repository%3Ahomebrew%2Fcore%2Fopenblas%3Apull&service=ghcr.io"
  );
  if (!tokenResponse.ok) throw new Error(`Homebrew bottle 授权失败：HTTP ${tokenResponse.status}`);
  const tokenPayload = await tokenResponse.json();
  if (typeof tokenPayload.token !== "string" || !tokenPayload.token) throw new Error("Homebrew bottle 授权响应无效");
  const registryResponse = await fetch(definition.url, {
    headers: { authorization: `Bearer ${tokenPayload.token}` },
    redirect: "manual"
  });
  if (registryResponse.status !== 307)
    throw new Error(`Homebrew bottle registry 请求失败：HTTP ${registryResponse.status}`);
  const signedLocation = registryResponse.headers.get("location");
  if (!signedLocation || new URL(signedLocation).hostname !== "pkg-containers.githubusercontent.com") {
    throw new Error("Homebrew bottle 内容地址不在固定下载主机");
  }
  const response = await fetch(signedLocation, { redirect: "follow" });
  if (!response.ok || !response.body) throw new Error(`Homebrew bottle 下载失败：HTTP ${response.status}`);
  const temporary = `${destination}.partial`;
  const digest = crypto.createHash("sha256");
  const transform = new Transform({
    transform(chunk, encoding, callback) {
      digest.update(chunk);
      callback(null, chunk);
    }
  });
  await pipeline(Readable.fromWeb(response.body), transform, createWriteStream(temporary, { mode: 0o600 }));
  const actual = digest.digest("hex");
  if (actual !== expected) {
    await fs.unlink(temporary).catch(() => undefined);
    throw new Error("Homebrew bottle SHA-256 校验失败");
  }
  await fs.rename(temporary, destination);
  return actual;
}

function selectRequirementBlocks(lock, names) {
  const selected = new Set(names.map(normalizePackageName));
  const lines = lock.split(/\r?\n/u);
  const blocks = [];
  for (let index = 0; index < lines.length;) {
    const match = lines[index].match(/^([A-Za-z0-9_.-]+)==/u);
    if (!match) {
      index++;
      continue;
    }
    const start = index;
    let continued;
    do {
      continued = /\\\s*$/u.test(lines[index] ?? "");
      index++;
    } while (continued && index < lines.length);
    if (selected.has(normalizePackageName(match[1]))) blocks.push(lines.slice(start, index).join("\n"));
  }
  if (blocks.length !== selected.size) throw new Error("BasicSR 构建锁缺少必要依赖项");
  return `${blocks.join("\n")}\n`;
}

function normalizePackageName(name) {
  return name.toLowerCase().replace(/[-_.]+/gu, "-");
}

function runtimeEnvironment(venv, output) {
  const env = isolatedPipEnvironment(output);
  env.PATH = `${path.join(venv, "bin")}:${path.join(path.parse(process.execPath).root, "usr", "bin")}:${path.join(path.parse(process.execPath).root, "bin")}`;
  return env;
}

async function importComponentDependencies(component, python, output, run) {
  const modules = IMPORTS[component];
  const code =
    "import importlib, json, sys; names=sys.argv[1:]; imported=[]\nfor name in names:\n importlib.import_module(name); imported.append(name)\nprint(json.dumps({'modules':imported,'userSite':__import__('site').ENABLE_USER_SITE,'prefix':sys.prefix,'basePrefix':sys.base_prefix}))";
  const result = JSON.parse(
    commandText(
      run(python, ["-I", "-c", code, ...modules], {
        cwd: output,
        env: runtimeEnvironment(path.dirname(path.dirname(python)), output),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 20 * 60_000,
        maxBuffer: 16 * 1024 * 1024
      })
    )
  );
  if (
    JSON.stringify(result.modules) !== JSON.stringify(modules) ||
    result.prefix === result.basePrefix ||
    result.userSite
  ) {
    throw new Error(`${component} 隔离环境导入或 venv 身份检查失败`);
  }
  return result;
}

async function auditNativeLibraries(python, output, run, { paddleWheelMinimumOS = null } = {}) {
  const sitePackages = commandText(
    run(python, ["-I", "-c", "import sysconfig; print(sysconfig.get_paths()['purelib'])"], {
      cwd: output,
      env: runtimeEnvironment(path.dirname(path.dirname(python)), output),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    })
  ).trim();
  const files = await walkFiles(sitePackages);
  const candidates = files.filter((file) => /\.(?:so(?:\.\d+)*|dylib)$/u.test(file));
  const audited = [];
  const loadCommandRepairs = [];
  let sdkVersion = null;
  for (const filePath of candidates) {
    const fileOutput = commandText(run("/usr/bin/file", [filePath], { encoding: "utf8" }));
    if (!/Mach-O/u.test(fileOutput)) continue;
    const architectures = commandText(run("/usr/bin/lipo", ["-archs", filePath], { encoding: "utf8" }));
    const dylibs = commandText(run("/usr/bin/otool", ["-L", filePath], { encoding: "utf8" }));
    let loadCommands = commandText(run("/usr/bin/otool", ["-l", filePath], { encoding: "utf8" }));
    const relativePath = path.relative(sitePackages, filePath).split(path.sep).join("/");
    let minimumOSNormalization = null;
    const hasMinimumOS =
      /cmd LC_BUILD_VERSION[\s\S]*?\bminos\s+\d+(?:\.\d+){1,2}/u.test(loadCommands) ||
      /cmd LC_VERSION_MIN_MACOSX[\s\S]*?\bversion\s+\d+(?:\.\d+){1,2}/u.test(loadCommands);
    if (!hasMinimumOS && relativePath.startsWith("paddle/")) {
      if (!paddleWheelMinimumOS || compareVersions(paddleWheelMinimumOS, "14.0") > 0) {
        throw new Error(`${relativePath} 缺少最低系统版本，且 Paddle wheel 标签无法证明兼容 macOS 14`);
      }
      if (!sdkVersion) {
        sdkVersion = commandText(
          run("/usr/bin/xcrun", ["--sdk", "macosx", "--show-sdk-version"], { encoding: "utf8" })
        ).trim();
        if (!/^\d+(?:\.\d+){1,2}$/u.test(sdkVersion)) throw new Error("无法读取 MacOS SDK 版本");
      }
      const normalizedBinary = `${filePath}.vtool-output`;
      run(
        "/usr/bin/vtool",
        ["-set-build-version", "macos", "14.0", sdkVersion, "-output", normalizedBinary, filePath],
        {
          cwd: output,
          env: runtimeEnvironment(path.dirname(path.dirname(python)), output),
          stdio: "inherit",
          timeout: 60_000
        }
      );
      await fs.rename(normalizedBinary, filePath);
      minimumOSNormalization = {
        source: "verified Paddle wheel macOS arm64 platform tag",
        declaredMinimumOS: paddleWheelMinimumOS,
        normalizedMinimumOS: "14.0",
        sdkVersion
      };
      loadCommands = commandText(run("/usr/bin/otool", ["-l", filePath], { encoding: "utf8" }));
    }
    const invalidRpaths = developerRpaths(loadCommands);
    const invalidInstallIds = developerInstallIds(loadCommands);
    const invalidDependencies = developerDylibDependencies(loadCommands);
    let binaryChanged = false;
    if (invalidRpaths.length || invalidInstallIds.length || invalidDependencies.length || minimumOSNormalization) {
      for (const rpath of invalidRpaths) {
        run("/usr/bin/install_name_tool", ["-delete_rpath", rpath, filePath], {
          cwd: output,
          env: runtimeEnvironment(path.dirname(path.dirname(python)), output),
          stdio: "inherit",
          timeout: 60_000
        });
      }
      for (const installId of invalidInstallIds) {
        run("/usr/bin/install_name_tool", ["-id", installId.normalized, filePath], {
          cwd: output,
          env: runtimeEnvironment(path.dirname(path.dirname(python)), output),
          stdio: "inherit",
          timeout: 60_000
        });
      }
      for (const dependency of invalidDependencies) {
        if (!dependency.normalized.startsWith("@loader_path/")) {
          throw new Error(`动态库替代项必须相对加载器：${dependency.normalized}`);
        }
        const resolvedDependency = path.resolve(
          path.dirname(filePath),
          dependency.normalized.slice("@loader_path/".length)
        );
        if (!(await pathExists(resolvedDependency))) {
          throw new Error(`动态库替代项不存在：${dependency.original} -> ${resolvedDependency}`);
        }
        run("/usr/bin/install_name_tool", ["-change", dependency.original, dependency.normalized, filePath], {
          cwd: output,
          env: runtimeEnvironment(path.dirname(path.dirname(python)), output),
          stdio: "inherit",
          timeout: 60_000
        });
      }
      binaryChanged = true;
      loadCommands = commandText(run("/usr/bin/otool", ["-l", filePath], { encoding: "utf8" }));
    }
    const codeSignature = ensureStrictCodeSignature(filePath, { run });
    if (codeSignature.status === "ad-hoc") binaryChanged = true;
    if (binaryChanged) {
      run(python, ["-I", "-c", REWRITE_RECORD_HASH, sitePackages, relativePath, filePath], {
        cwd: output,
        env: runtimeEnvironment(path.dirname(path.dirname(python)), output),
        stdio: "inherit",
        timeout: 60_000
      });
      loadCommandRepairs.push({
        path: relativePath,
        removed: invalidRpaths,
        normalizedInstallIds: invalidInstallIds,
        normalizedDependencies: invalidDependencies,
        minimumOSNormalization,
        codeSignature: codeSignature.status,
        method: "Mach-O load commands and strict code signature verified; wheel RECORD hash refreshed"
      });
    }
    const auditedDylibs =
      invalidInstallIds.length || invalidDependencies.length
        ? commandText(run("/usr/bin/otool", ["-L", filePath], { encoding: "utf8" }))
        : dylibs;
    const audit = assertNativeMachO({
      fileOutput,
      architectures,
      loadCommands,
      dylibs: auditedDylibs,
      name: path.relative(sitePackages, filePath)
    });
    audited.push({
      path: relativePath,
      sha256: await sha256File(filePath),
      ...audit,
      minimumOSSource: minimumOSNormalization
        ? `wheel tag ${paddleWheelMinimumOS}, vtool-normalized to macOS 14.0`
        : "Mach-O load command",
      codeSignature: codeSignature.status,
      dynamicLibraries: otoolBody(auditedDylibs)
        .map((line) => line.trim().split(/\s+/u)[0])
        .filter(Boolean)
    });
  }
  if (!audited.length) throw new Error("venv 中未发现可审计的 arm64 Mach-O Python 扩展");
  return {
    sitePackages: path.relative(path.dirname(path.dirname(python)), sitePackages),
    machOCount: audited.length,
    loadCommandRepairs,
    libraries: audited
  };
}

function otoolBody(output) {
  return output.split(/\r?\n/u).filter((line) => line.trim() && !/^[^\r\n]+:\s*$/u.test(line.trim()));
}

export const REWRITE_RECORD_HASH = `import base64,csv,hashlib,os,tempfile
from pathlib import Path
root=Path(__import__('sys').argv[1]); relative=__import__('sys').argv[2]; target=Path(__import__('sys').argv[3])
matches=[]
for record in root.glob('*.dist-info/RECORD'):
 rows=[]
 with record.open(newline='',encoding='utf-8') as stream: rows=list(csv.reader(stream))
 row_matches=[row for row in rows if row and row[0]==relative]
 if len(row_matches)>1: raise SystemExit(f'duplicate RECORD rows in {record.name} for {relative}')
 changed=False
 for row in rows:
  if row and row[0]==relative:
   payload=target.read_bytes(); digest=base64.urlsafe_b64encode(hashlib.sha256(payload).digest()).rstrip(b'=').decode('ascii')
   while len(row)<3: row.append('')
   row[1]='sha256='+digest; row[2]=str(len(payload)); changed=True
 if changed:
  temporary=None
  try:
   with tempfile.NamedTemporaryFile('w',newline='',encoding='utf-8',dir=record.parent,delete=False) as stream:
    temporary=stream.name; csv.writer(stream,lineterminator='\\n').writerows(rows)
   os.replace(temporary,record)
  finally:
   if temporary and os.path.exists(temporary): os.unlink(temporary)
  matches.append(str(record))
if not matches: raise SystemExit(f'expected at least one wheel RECORD row for {relative}, found none')`;

const ADD_RECORD_ENTRIES = `import base64,csv,hashlib,json,os,tempfile
from pathlib import Path
root=Path(__import__('sys').argv[1]); entries=json.loads(__import__('sys').argv[2]); records=list(root.glob('paddlepaddle-*.dist-info/RECORD'))
if len(records)!=1: raise SystemExit(f'expected exactly one Paddle RECORD, found {len(records)}')
record=records[0]
with record.open(newline='',encoding='utf-8') as stream: rows=list(csv.reader(stream))
for entry in entries:
 relative=entry['relative']; target=Path(entry['path'])
 if relative.startswith('/') or '..' in Path(relative).parts: raise SystemExit(f'unsafe RECORD path: {relative}')
 payload=target.read_bytes(); digest=base64.urlsafe_b64encode(hashlib.sha256(payload).digest()).rstrip(b'=').decode('ascii')
 matches=[row for row in rows if row and row[0]==relative]
 row=[relative,'sha256='+digest,str(len(payload))]
 if matches:
  if len(matches)!=1: raise SystemExit(f'duplicate RECORD rows for {relative}')
  rows[rows.index(matches[0])]=row
 else: rows.append(row)
temporary=None
try:
 with tempfile.NamedTemporaryFile('w',newline='',encoding='utf-8',dir=record.parent,delete=False) as stream:
  temporary=stream.name; csv.writer(stream,lineterminator='\\n').writerows(rows)
 os.replace(temporary,record)
finally:
 if temporary and os.path.exists(temporary): os.unlink(temporary)`;

function isDeveloperPath(value) {
  return /^(?:\/Users\/|\/DLC\/|\/opt\/homebrew(?:\/|$)|\/usr\/local\/opt(?:\/|$)|@@HOMEBREW_PREFIX@@(?:\/|$)|.*\.package\/macos-validation(?:\/|$))/u.test(
    value
  );
}

async function verifyWheelTags(python, wheels, run, env) {
  const code =
    "import json, sys\nfrom pathlib import Path\nfrom pip._vendor.packaging.tags import sys_tags\nfrom pip._vendor.packaging.utils import parse_wheel_filename\ncompatible=set(sys_tags())\nresults=[]\nfor name in sys.argv[1:]:\n _,_,_,tags=parse_wheel_filename(Path(name).name)\n matches=sorted(str(tag) for tag in tags & compatible)\n if not matches: raise SystemExit(f'incompatible Mac arm64 wheel tag: {name}')\n results.append({'filename':Path(name).name,'compatibleTags':matches})\nprint(json.dumps(results))";
  return JSON.parse(
    commandText(
      run(python, ["-I", "-c", code, ...wheels.map((wheel) => wheel.path)], {
        cwd: REPOSITORY_ROOT,
        env,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 5 * 60_000,
        maxBuffer: 16 * 1024 * 1024
      })
    )
  );
}

async function readWheelhouse(wheelhouse) {
  const entries = await fs.readdir(wheelhouse, { withFileTypes: true });
  if (!entries.length || entries.some((entry) => !entry.isFile() || !entry.name.endsWith(".whl"))) {
    throw new Error(`wheelhouse 只允许包含完整 wheel 文件：${wheelhouse}`);
  }
  return Promise.all(
    entries.map(async (entry) => {
      const filePath = path.join(wheelhouse, entry.name);
      return {
        filename: entry.name,
        path: filePath,
        bytes: (await fs.stat(filePath)).size,
        sha256: await sha256File(filePath)
      };
    })
  );
}

async function walkFiles(root) {
  const files = [];
  const pending = [root];
  while (pending.length) {
    const directory = pending.pop();
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const candidate = path.join(directory, entry.name);
      if (entry.isDirectory()) pending.push(candidate);
      else if (entry.isFile() || entry.isSymbolicLink()) files.push(candidate);
    }
  }
  return files;
}

async function sha256File(filePath) {
  const digest = crypto.createHash("sha256");
  const file = await fs.readFile(filePath);
  digest.update(file);
  return digest.digest("hex");
}

async function sha256Buffer(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function compareVersions(left, right) {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference) return Math.sign(difference);
  }
  return 0;
}

function commandText(result) {
  return typeof result === "string" ? result : String(result ?? "");
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(publicEntryUrl)) {
  try {
    const options = parseMacOSAIEnvironmentArguments(process.argv.slice(2));
    if (options.help) {
      console.log(MACOS_AI_ENVIRONMENT_HELP);
    } else {
      const result = await prepareMacOSAIEnvironments(options);
      console.log(`已完成 ${result.components.length} 个 macOS arm64 独立 Python 环境：${options.output}`);
      console.log(`modelValidation: ${result.modelValidation}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "macOS AI 环境准备失败");
    process.exitCode = 1;
  }
}
