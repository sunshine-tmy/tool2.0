/** 中文模块说明：从 Astral 固定版本准备 Python 3.12 Windows x64 共享运行时。 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { preparePythonRuntime } from "./prepare-python-runtime.mjs";

export const PYTHON312_ARCHIVE_URL =
  "https://github.com/astral-sh/python-build-standalone/releases/download/20260901/cpython-3.12.14%2B20260901-x86_64-pc-windows-msvc-install_only_stripped.tar.gz";
export const PYTHON312_ARCHIVE_BYTES = 21_980_728;
export const PYTHON312_ARCHIVE_SHA256 = "7c45c9622400d578709a9b2cddbe8124cc21d382409d9f13406d706d28e31b14";

export function preparePython312Runtime({ archivePath, stagingDirectory }) {
  return preparePythonRuntime({
    archivePath,
    stagingDirectory,
    expectedVersion: "3.12",
    expectedArchiveBytes: PYTHON312_ARCHIVE_BYTES,
    expectedArchiveSha256: PYTHON312_ARCHIVE_SHA256
  });
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value || values.has(key.slice(2))) throw new Error("命令行参数无效");
    values.set(key.slice(2), value);
  }
  if (values.size !== 2 || !values.has("archive") || !values.has("stage")) {
    throw new Error("用法：pnpm components:prepare-python-312 -- --archive <官方归档> --stage <新暂存目录>");
  }
  return { archivePath: values.get("archive"), stagingDirectory: values.get("stage") };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await preparePython312Runtime(parseArguments(process.argv.slice(2)));
    console.log(`Python 3.12.14 运行时已校验并准备：${result.stagingDirectory}`);
    console.log(`解压文件大小：${result.extractedBytes} 字节`);
    console.log(`固定来源：${PYTHON312_ARCHIVE_URL}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Python 3.12 运行时准备失败");
    process.exitCode = 1;
  }
}
