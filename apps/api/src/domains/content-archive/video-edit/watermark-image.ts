/** One validation/normalization boundary for temporary uploads and the persistent image library. */
import sharp from "sharp";
import { VideoEditError } from "./renderer";
export const watermarkMaxBytes = 20 * 1024 * 1024;
export async function normalizeWatermark(bytes: Buffer, filename: string, mime: string) {
  if (!bytes.length || bytes.length > watermarkMaxBytes)
    throw new VideoEditError("ARCHIVE_WATERMARK_TOO_LARGE", "水印图片最大 20 MiB", 413);
  if (!["image/png", "image/jpeg", "image/webp"].includes(mime) || !/\.(png|jpe?g|webp)$/i.test(filename))
    throw new VideoEditError("ARCHIVE_WATERMARK_INVALID", "水印仅支持 PNG、JPG、WebP 静态图片", 415);
  let normalized;
  try {
    const image = sharp(bytes, { limitInputPixels: 40_000_000, failOn: "warning" });
    const metadata = await image.metadata();
    if (
      !metadata.width ||
      !metadata.height ||
      metadata.width > 8192 ||
      metadata.height > 8192 ||
      (metadata.pages ?? 1) !== 1 ||
      !["png", "jpeg", "webp"].includes(metadata.format ?? "")
    )
      throw new Error("invalid image");
    normalized = await image.rotate().ensureAlpha().png().toBuffer({ resolveWithObject: true });
  } catch {
    throw new VideoEditError("ARCHIVE_WATERMARK_INVALID", "水印图片损坏、为动态图片或尺寸超限", 415);
  }
  if (normalized.data.length > watermarkMaxBytes)
    throw new VideoEditError("ARCHIVE_WATERMARK_TOO_LARGE", "规范化后的水印超过 20 MiB，请缩小图片", 413);
  return normalized;
}
