/** 中文模块说明：在 Apple Silicon 上为每类桌面 Worker 生成独立的哈希锁文件。 */
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOCK_ROOT = path.join(REPOSITORY_ROOT, ".package", "macos-locks");
const DEFINITIONS = [
  { name: "edge-tts", python: "3.11", input: "edge-tts-requirements.txt" },
  { name: "video-transcribe", python: "3.11", input: "video-transcribe-requirements.txt" },
  { name: "chatterbox", python: "3.11", input: "chatterbox-requirements.txt", torchBackend: "cpu" },
  { name: "image-ai", python: "3.11", input: "image-ai-requirements.txt", torchBackend: "cpu" },
  { name: "xhs-archive", python: "3.12", input: "xhs-archive.lock.txt" },
  { name: "xhs-translation", python: "3.12", input: "xhs-translation-requirements.txt" }
];

export async function generateMacOSComponentLocks({
  python311 = path.join(REPOSITORY_ROOT, ".package", "stage", "python-311", "python", "bin", "python3.11"),
  python312 = path.join(REPOSITORY_ROOT, ".package", "stage", "python-312", "python", "bin", "python3.12"),
  uv = "uv",
  run = execFileSync
} = {}) {
  if (process.platform !== "darwin" || process.arch !== "arm64") {
    throw new Error("macOS 能力依赖锁必须在 Apple Silicon 原生构建机上生成");
  }
  await fs.mkdir(LOCK_ROOT, { recursive: true });
  const pythonPaths = { 3.11: path.resolve(python311), 3.12: path.resolve(python312) };
  for (const [version, executable] of Object.entries(pythonPaths)) {
    const output = run(
      executable,
      ["-I", "-c", "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      }
    );
    if (output.trim() !== version) throw new Error(`锁文件 Python 版本不匹配：需要 ${version}`);
  }

  const results = [];
  for (const definition of DEFINITIONS) {
    const input = path.join(REPOSITORY_ROOT, "scripts", definition.input);
    await fs.access(input);
    const output = path.join(LOCK_ROOT, `${definition.name}.lock.txt`);
    const args = [
      "pip",
      "compile",
      input,
      "--python",
      pythonPaths[definition.python],
      "--python-version",
      definition.python,
      "--python-platform",
      "aarch64-apple-darwin",
      "--generate-hashes",
      "--custom-compile-command",
      "pnpm components:lock-macos-dependencies",
      "--output-file",
      output,
      "--quiet"
    ];
    if (definition.torchBackend) args.push("--preview", "--torch-backend", definition.torchBackend);
    run(uv, args, { stdio: "inherit", cwd: REPOSITORY_ROOT, timeout: 60 * 60 * 1000 });
    const lock = await fs.readFile(output, "utf8");
    if (!/--hash=sha256:[a-f0-9]{64}/.test(lock)) throw new Error(`${definition.name} 锁文件缺少 SHA-256 约束`);
    results.push(output);
  }
  return results;
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value || values.has(key.slice(2))) throw new Error("命令行参数无效");
    values.set(key.slice(2), value);
  }
  const allowed = new Set(["python-311", "python-312", "uv"]);
  if ([...values.keys()].some((key) => !allowed.has(key))) throw new Error("命令行参数无效");
  return {
    ...(values.has("python-311") ? { python311: values.get("python-311") } : {}),
    ...(values.has("python-312") ? { python312: values.get("python-312") } : {}),
    ...(values.has("uv") ? { uv: values.get("uv") } : {})
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const outputs = await generateMacOSComponentLocks(parseArguments(process.argv.slice(2)));
    console.log(`已生成 ${outputs.length} 份 Apple Silicon 哈希锁，位于 .package/macos-locks/`);
    for (const output of outputs) console.log(`  ${path.relative(REPOSITORY_ROOT, output)}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "macOS Worker 锁文件生成失败");
    process.exitCode = 1;
  }
}
