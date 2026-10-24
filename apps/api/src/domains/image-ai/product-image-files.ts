import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { validationError } from "./image-validation";

/** Validate every ancestor, not just the final file, including symlinks/junctions within a task. */
export async function ownedImageFile(root: string, taskId: string, file: string) {
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(taskId)) throw validationError("INVALID_SOURCE", "来源记录无效");
  const base = await fs.realpath(root);
  const resolved = await fs.realpath(file);
  const taskRoot = path.join(base, taskId);
  const relative = path.relative(taskRoot, resolved);
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
    throw validationError("INVALID_SOURCE", "来源文件不在受控目录");
  const parts = path.relative(base, path.resolve(file)).split(path.sep);
  let current = base;
  for (const part of parts) {
    current = path.join(current, part);
    if ((await fs.lstat(current)).isSymbolicLink()) throw validationError("INVALID_SOURCE", "不允许使用链接素材");
  }
  if (!(await fs.stat(resolved)).isFile()) throw validationError("INVALID_SOURCE", "来源素材不可用");
  return resolved;
}

export async function validateProductAsset(file: string, mask = false) {
  // Reject SVG/PDF and other loaders before invoking an image decoder.
  const handle = await fs.open(file, "r"),
    header = Buffer.alloc(12);
  let bytesRead = 0;
  try {
    bytesRead = (await handle.read(header, 0, 12, 0)).bytesRead;
  } finally {
    await handle.close();
  }
  const png = bytesRead >= 8 && header.subarray(0, 8).toString("hex") === "89504e470d0a1a0a";
  const jpeg = bytesRead >= 3 && header[0] === 255 && header[1] === 216 && header[2] === 255;
  const webp =
    bytesRead === 12 && header.toString("ascii", 0, 4) === "RIFF" && header.toString("ascii", 8, 12) === "WEBP";
  if (!(mask ? png : png || jpeg || webp))
    throw validationError("INVALID_PRODUCT_ASSET", "素材必须是真实的单帧 PNG、JPEG 或 WebP 图片");
  const metadata = await sharp(file, { limitInputPixels: mask ? 4194304 : 40000000 }).metadata();
  if (
    !["png", "jpeg", "webp"].includes(metadata.format ?? "") ||
    (metadata.pages ?? 1) !== 1 ||
    !metadata.width ||
    !metadata.height ||
    metadata.width > (mask ? 2048 : 8192) ||
    metadata.height > (mask ? 2048 : 8192) ||
    (mask && metadata.format !== "png")
  )
    throw validationError("INVALID_PRODUCT_ASSET", "素材格式、帧数或尺寸无效");
  return metadata;
}

export async function requireProductSpace(directory: string, pixels: number) {
  const stat = await fs.statfs(directory);
  if (stat.bavail * stat.bsize < Math.max(256 * 1024 * 1024, pixels * 24))
    throw validationError("INSUFFICIENT_DISK_SPACE", "可用磁盘空间不足，请先释放空间");
}
