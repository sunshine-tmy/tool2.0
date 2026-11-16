// Anchor filesystem and CLI identity at the stable public entry.
const publicEntryUrl = new URL("../../scripts/lock-macos-component-dependencies.mjs", import.meta.url).href;

/** 中文模块说明：用固定原生 Python 和 uv 为 macOS Worker 生成独立哈希锁。 */
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import MACOS_TOOLCHAIN from "./macos/toolchain-sources.json" with { type: "json" };

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(publicEntryUrl)), "..");
const MACOS_INPUT_ROOT = path.join(REPOSITORY_ROOT, "tooling", "components", "macos");
export const MACOS_LOCK_ROOT = path.join(MACOS_INPUT_ROOT, "locks");
const LOCK_ROOT = MACOS_LOCK_ROOT;
const DEFAULT_PYTHON312 = path.join(REPOSITORY_ROOT, ".package", "stage", "python-312", "python", "bin", "python3.12");
export const MACOS_LOCK_DEFINITIONS = Object.freeze([
  { name: "edge-tts", python: "3.12", input: "edge-tts-requirements.txt" },
  { name: "chatterbox", python: "3.12", input: "chatterbox-requirements.txt" },
  { name: "image-ai", python: "3.12", input: "image-ai-requirements.txt" },
  { name: "video-ai", python: "3.12", input: "video-ai-requirements.txt" },
  { name: "xhs-archive", python: "3.12", input: "xhs-archive.lock.txt" },
  { name: "xhs-translation", python: "3.12", input: "xhs-translation-requirements.txt" }
]);

export const MACOS_LOCK_HELP = `用法：pnpm components:lock-macos-dependencies [-- --python-312 <绝对路径> --uv <绝对路径或命令> --components <逗号分隔 ID> --lock-root <输出目录>]

在原生 Apple Silicon 上用固定 Python ${MACOS_TOOLCHAIN.python.version} 和 uv ${MACOS_TOOLCHAIN.uv.version} 解析 Mac 专用 requirements，输出到 tooling/components/macos/locks/。
默认生成全部锁；M01 可用 --components image-ai,chatterbox,video-ai 只生成三个隔离推理环境的锁。
支持组件：${MACOS_LOCK_DEFINITIONS.map(({ name }) => name).join(", ")}。`;

export async function generateMacOSComponentLocks({
  python312 = DEFAULT_PYTHON312,
  uv = "uv",
  components,
  lockRoot = LOCK_ROOT,
  run = execFileSync
} = {}) {
  if (process.platform !== "darwin" || process.arch !== "arm64") {
    throw new Error("macOS 能力依赖锁必须在 Apple Silicon 原生构建机上生成");
  }
  const executable = path.resolve(python312);
  const versionOutput = commandText(
    run(executable, ["-I", "-c", "import sys; print('.'.join(map(str, sys.version_info[:3])))"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    })
  ).trim();
  if (versionOutput !== MACOS_TOOLCHAIN.python.version) {
    throw new Error(`锁文件 Python 版本不匹配：需要 ${MACOS_TOOLCHAIN.python.version}`);
  }
  const uvVersionOutput = commandText(
    run(uv, ["--version"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
  ).trim();
  assertPinnedUvVersion(uvVersionOutput);

  const selectedDefinitions = selectMacOSLockDefinitions(components);
  await fs.mkdir(lockRoot, { recursive: true });
  const results = [];
  for (const definition of selectedDefinitions) {
    const input = path.join(MACOS_INPUT_ROOT, definition.input);
    await fs.access(input);
    const output = path.join(lockRoot, `${definition.name}.lock.txt`);
    const args = buildUvCompileArgs(definition, executable, output, input);
    run(uv, args, { stdio: "inherit", cwd: REPOSITORY_ROOT, timeout: 60 * 60 * 1000 });
    const lock = await fs.readFile(output, "utf8");
    if (!/--hash=sha256:[a-f0-9]{64}/u.test(lock)) throw new Error(`${definition.name} 锁文件缺少 SHA-256 约束`);
    if (/torch==[^\n]*(?:\+cpu|\+cu\d+)/iu.test(lock)) {
      throw new Error(`${definition.name} Mac 锁中包含 CPU/CUDA 专用 PyTorch wheel 标记`);
    }
    results.push(output);
  }
  return results;
}

export function parseMacOSLockArguments(argv) {
  const args = argv[0] === "--" ? argv.slice(1) : argv;
  if (args.length === 1 && args[0] === "--help") return { help: true };
  const values = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith("--") || key === "--help" || !value || value.startsWith("--") || values.has(key.slice(2))) {
      throw new Error("命令行参数无效");
    }
    values.set(key.slice(2), value);
  }
  const allowed = new Set(["python-312", "uv", "components", "lock-root"]);
  if ([...values.keys()].some((key) => !allowed.has(key))) throw new Error("命令行参数无效");
  if (values.has("python-312") && !path.isAbsolute(values.get("python-312"))) {
    throw new Error("--python-312 必须是绝对路径");
  }
  if (values.has("lock-root") && !path.isAbsolute(values.get("lock-root"))) {
    throw new Error("--lock-root 必须是绝对路径");
  }
  const components = values.has("components") ? values.get("components").split(",") : undefined;
  if (components?.some((component) => !component)) throw new Error("--components 必须是逗号分隔的组件 ID");
  if (components) selectMacOSLockDefinitions(components);
  return {
    ...(values.has("python-312") ? { python312: values.get("python-312") } : {}),
    ...(values.has("uv") ? { uv: values.get("uv") } : {}),
    ...(values.has("lock-root") ? { lockRoot: values.get("lock-root") } : {}),
    ...(components ? { components } : {})
  };
}

export function selectMacOSLockDefinitions(components) {
  if (components === undefined) return MACOS_LOCK_DEFINITIONS;
  if (!Array.isArray(components) || new Set(components).size !== components.length) {
    throw new Error("MacOS 锁组件选择无效或重复");
  }
  const definitions = new Map(MACOS_LOCK_DEFINITIONS.map((definition) => [definition.name, definition]));
  return components.map((name) => {
    const definition = definitions.get(name);
    if (!definition) throw new Error(`不支持的 macOS 锁组件：${name}`);
    return definition;
  });
}

export function buildUvCompileArgs(
  definition,
  python312,
  output,
  input = path.join(MACOS_INPUT_ROOT, definition.input)
) {
  return [
    "pip",
    "compile",
    input,
    "--python",
    python312,
    "--python-version",
    definition.python,
    "--python-platform",
    MACOS_TOOLCHAIN.python.platform === "darwin-arm64" ? "aarch64-apple-darwin" : MACOS_TOOLCHAIN.python.platform,
    "--generate-hashes",
    "--custom-compile-command",
    "pnpm components:lock-macos-dependencies",
    "--output-file",
    output,
    "--quiet"
  ];
}

export function assertPinnedUvVersion(output) {
  if (!new RegExp(`^uv ${escapeRegExp(MACOS_TOOLCHAIN.uv.version)}(?:\\s|$)`, "u").test(output)) {
    throw new Error(`锁文件生成器需要 uv ${MACOS_TOOLCHAIN.uv.version}，当前版本：${output || "未知"}`);
  }
}

function commandText(result) {
  return typeof result === "string" ? result : String(result ?? "");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(publicEntryUrl)) {
  try {
    const options = parseMacOSLockArguments(process.argv.slice(2));
    if (options.help) {
      console.log(MACOS_LOCK_HELP);
    } else {
      const outputs = await generateMacOSComponentLocks(options);
      console.log(`已生成 ${outputs.length} 份 Apple Silicon 哈希锁，默认位于 tooling/components/macos/locks/`);
      for (const output of outputs) console.log(`  ${path.relative(REPOSITORY_ROOT, output)}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "macOS Worker 锁文件生成失败");
    process.exitCode = 1;
  }
}
