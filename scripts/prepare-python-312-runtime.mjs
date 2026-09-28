/** 中文模块说明：校验固定来源的 Python 3.12 Windows x64 / Apple Silicon 运行时。 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { preparePythonRuntime } from "./prepare-python-runtime.mjs";

export const PYTHON312_ARCHIVES = {
  "win32-x64": {
    url: "https://github.com/astral-sh/python-build-standalone/releases/download/20260901/cpython-3.12.14%2B20260901-x86_64-pc-windows-msvc-install_only_stripped.tar.gz",
    bytes: 21_980_728,
    sha256: "7c45c9622400d578709a9b2cddbe8124cc21d382409d9f13406d706d28e31b14"
  },
  "darwin-arm64": {
    url: "https://github.com/astral-sh/python-build-standalone/releases/download/20260924/cpython-3.12.14%2B20260924-aarch64-apple-darwin-install_only_stripped.tar.gz",
    bytes: 25_017_789,
    sha256: "c2edb321cd32ec2b170df208db0446dccc4398db602ca27cf2079098fb1f7d9d"
  }
};

export const PYTHON312_ARCHIVE_URL = PYTHON312_ARCHIVES["win32-x64"].url;
export const PYTHON312_ARCHIVE_BYTES = PYTHON312_ARCHIVES["win32-x64"].bytes;
export const PYTHON312_ARCHIVE_SHA256 = PYTHON312_ARCHIVES["win32-x64"].sha256;

export function preparePython312Runtime({ archivePath, stagingDirectory, platform = hostPlatform() }) {
  const pinned = PYTHON312_ARCHIVES[platform];
  if (!pinned) throw new Error(`Python 3.12 暂不支持目标平台：${platform}`);
  return preparePythonRuntime({
    archivePath,
    stagingDirectory,
    expectedVersion: "3.12",
    expectedArchiveBytes: pinned.bytes,
    expectedArchiveSha256: pinned.sha256,
    platform
  });
}

function hostPlatform() {
  if (process.platform === "win32" && process.arch === "x64") return "win32-x64";
  if (process.platform === "darwin" && process.arch === "arm64") return "darwin-arm64";
  throw new Error(`Python 3.12 运行时仅支持 Windows x64 或 Apple Silicon：${process.platform}-${process.arch}`);
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
    const platform = hostPlatform();
    const result = await preparePython312Runtime({ ...parseArguments(process.argv.slice(2)), platform });
    console.log(`Python 3.12.14 (${platform}) 运行时已校验并准备：${result.stagingDirectory}`);
    console.log(`解压文件大小：${result.extractedBytes} 字节`);
    console.log(`固定来源：${PYTHON312_ARCHIVES[platform].url}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Python 3.12 运行时准备失败");
    process.exitCode = 1;
  }
}
