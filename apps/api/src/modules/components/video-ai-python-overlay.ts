/** 视频 CUDA 包只提供增量依赖；导入时先使用其 CUDA 库，再复用已验证基础包的服务和 OCR 依赖。 */
import fs from "node:fs/promises";
import path from "node:path";
import { isPathWithin } from "./package-paths";
import type { VerifiedComponentAsset } from "./types";

export async function videoAiCudaPythonEnvironment(cudaGenerationRoot: string, basePython: VerifiedComponentAsset) {
  if (
    basePython.manifest.id !== "video-ai" ||
    basePython.manifest.platform !== "win32-x64" ||
    basePython.manifest.pythonEnvironment?.expectedPythonVersion !== "3.12"
  ) {
    throw new Error("视频去字幕 CUDA 扩展需要已验证的 Windows Python 3.12 基础包");
  }
  const [cudaSite, baseSite] = await Promise.all([
    sitePackages(cudaGenerationRoot),
    sitePackages(basePython.generationRoot)
  ]);
  // PYTHONPATH 优先于 venv 默认搜索目录，必须显式将 CUDA 路径排在基础包的 CPU torch 前面。
  return { PYTHONPATH: [cudaSite, baseSite].join(path.delimiter) };
}

async function sitePackages(generationRoot: string) {
  const root = await fs.realpath(generationRoot);
  const directory = await fs.realpath(path.join(root, "venv", "Lib", "site-packages"));
  if (!isPathWithin(root, directory) || !(await fs.stat(directory)).isDirectory()) {
    throw new Error("视频去字幕 Python 依赖目录不可用或越界");
  }
  return directory;
}
