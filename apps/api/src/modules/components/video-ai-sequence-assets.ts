/** Versioned sequence assets are resolved only from verified video generations. */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { isPathWithin } from "./package-paths";
import type { VerifiedComponentAsset } from "./types";

export const VIDEO_AI_SEQUENCE_SUPPORT = "scripts/video-ai-sequence-support.json";
export const VIDEO_AI_SEQUENCE_LOADER = "scripts/video_ai_engine_assets.py";
export const VIDEO_AI_SEQUENCE_RUNTIME_FILES = [
  "scripts/video_ai_sequence.py",
  "scripts/video_ai_sttn.py",
  "scripts/video_ai_propainter.py"
];
export const videoAiSequenceBundle = (engine: "sttn" | "propainter") =>
  `models/video-ai/engines/${engine}/sequence-bundle.json`;

export function hasVideoAiSequenceAssets(asset: VerifiedComponentAsset) {
  return (
    asset.manifest.files?.some((file) =>
      [videoAiSequenceBundle("sttn"), videoAiSequenceBundle("propainter")].includes(file.path)
    ) === true
  );
}

export async function videoAiSequenceEnvironment(cuda: VerifiedComponentAsset, base: VerifiedComponentAsset) {
  if (!hasVideoAiSequenceAssets(cuda)) return {};
  if (
    cuda.manifest.id !== "video-ai-cuda" ||
    base.manifest.id !== "video-ai" ||
    cuda.manifest.platform !== "win32-x64" ||
    base.manifest.platform !== "win32-x64" ||
    cuda.manifest.pythonEnvironment?.expectedPythonVersion !== "3.12" ||
    base.manifest.pythonEnvironment?.expectedPythonVersion !== "3.12"
  )
    throw new Error("视频时序引擎需要兼容的 Windows Python 3.12 视频基础包");
  await validateVideoAiSequenceSupport(base);
  const roots: Record<string, string> = {};
  for (const engine of ["sttn", "propainter"] as const) {
    const relative = videoAiSequenceBundle(engine);
    const bundle = await readJson(cuda, relative);
    if (
      bundle.assetSchemaVersion !== 1 ||
      bundle.engine !== engine ||
      bundle.namespace !== `toolbox_video_ai_vendor.${engine}`
    )
      throw new Error(`视频 ${engine} 时序资源协议不兼容`);
    roots[`VIDEO_AI_${engine.toUpperCase()}_ENGINE_ROOT`] = path.dirname(
      await verifiedVideoFile(cuda, relative, 128 * 1024)
    );
  }
  return roots;
}

export async function validateVideoAiSequenceSupport(base: VerifiedComponentAsset) {
  const support = await readJson(base, VIDEO_AI_SEQUENCE_SUPPORT);
  if (
    support.assetSchemaVersion !== 1 ||
    support.workerFeature !== "sequence-assets-v1" ||
    support.sequenceRuntime !== 1
  )
    throw new Error("视频基础包不支持当前时序资源协议，请先升级基础包");
  for (const file of VIDEO_AI_SEQUENCE_RUNTIME_FILES) await verifiedVideoFile(base, file);
  return verifiedVideoFile(base, VIDEO_AI_SEQUENCE_LOADER, 128 * 1024);
}

export async function verifiedVideoFile(asset: VerifiedComponentAsset, relative: string, maxBytes = 128 * 1024) {
  const listed = asset.manifest.files?.find((file) => file.path === relative);
  if (!listed) throw new Error(`视频签名清单缺少 ${relative}，请升级或重新安装对应能力包`);
  const root = await fs.realpath(asset.generationRoot);
  const target = await fs.realpath(path.join(root, ...relative.split("/")));
  if (!isPathWithin(root, target)) throw new Error("视频时序资源路径越界");
  const stat = await fs.stat(target);
  if (!stat.isFile() || stat.size > maxBytes || stat.size !== listed.bytes) throw new Error("视频时序资源文件大小不符");
  const bytes = await fs.readFile(target);
  if (crypto.createHash("sha256").update(bytes).digest("hex") !== listed.sha256)
    throw new Error("视频时序资源摘要不符");
  return target;
}

async function readJson(asset: VerifiedComponentAsset, relative: string): Promise<Record<string, unknown>> {
  const decoded: unknown = JSON.parse(await fs.readFile(await verifiedVideoFile(asset, relative), "utf8"));
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) throw new Error("视频时序资源描述无效");
  return decoded as Record<string, unknown>;
}
