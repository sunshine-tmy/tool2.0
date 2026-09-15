/**
 * 中文模块说明：AI 图片处理领域，负责 Worker 任务、输入校验和结果文件
 */
import path from "node:path";
import sharp, { type Metadata } from "sharp";

export const IMAGE_AI_MAX_FILE_BYTES = 20 * 1024 * 1024;
export const IMAGE_AI_MAX_MASK_BYTES = 10 * 1024 * 1024;
const IMAGE_AI_MAX_PIXELS = 40_000_000;
const IMAGE_AI_MAX_EDGE = 8192;
const IMAGE_AI_MAX_OUTPUT_PIXELS = 100_000_000;
const IMAGE_AI_MAX_OUTPUT_EDGE = 16384;

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

type ValidatedImage = {
  width: number;
  height: number;
  format: "jpeg" | "png" | "webp";
};

export async function validateUploadedImage(input: {
  filePath: string;
  originalName: string;
  mimetype: string;
  size: number;
}): Promise<ValidatedImage> {
  if (!allowedMimeTypes.has(input.mimetype)) {
    throw validationError("UNSUPPORTED_IMAGE_TYPE", "仅支持 JPEG、PNG、WebP 图片");
  }
  if (!allowedExtensions.has(path.extname(input.originalName).toLowerCase())) {
    throw validationError("UNSUPPORTED_IMAGE_EXTENSION", "图片扩展名与允许类型不符");
  }
  if (input.size > IMAGE_AI_MAX_FILE_BYTES) {
    throw validationError("IMAGE_TOO_LARGE", "单张图片不能超过 20MB");
  }

  let metadata: Metadata;
  try {
    metadata = await sharp(input.filePath, { limitInputPixels: IMAGE_AI_MAX_PIXELS }).metadata();
  } catch {
    throw validationError("INVALID_IMAGE", "图片内容损坏、格式伪造或像素数量超限");
  }

  if (!metadata.width || !metadata.height || !metadata.format) {
    throw validationError("INVALID_IMAGE", "无法读取图片尺寸");
  }
  if (!allowedMimeTypes.has(`image/${metadata.format}`)) {
    throw validationError("IMAGE_SIGNATURE_MISMATCH", "图片真实格式不在允许列表中");
  }
  if (metadata.width > IMAGE_AI_MAX_EDGE || metadata.height > IMAGE_AI_MAX_EDGE) {
    throw validationError("IMAGE_DIMENSIONS_EXCEEDED", "图片最长边不能超过 8192px");
  }
  if (metadata.width * metadata.height > IMAGE_AI_MAX_PIXELS) {
    throw validationError("IMAGE_PIXELS_EXCEEDED", "图片总像素不能超过 4000 万");
  }

  return {
    width: metadata.width,
    height: metadata.height,
    format: metadata.format as ValidatedImage["format"]
  };
}

export async function validateWatermarkMask(
  filePath: string,
  size: number,
  expected: { width: number; height: number }
) {
  if (size > IMAGE_AI_MAX_MASK_BYTES) {
    throw validationError("MASK_TOO_LARGE", "蒙版不能超过 10MB");
  }
  let metadata: Metadata;
  try {
    metadata = await sharp(filePath, { limitInputPixels: IMAGE_AI_MAX_PIXELS }).metadata();
  } catch {
    throw validationError("INVALID_MASK", "蒙版必须是有效的 PNG 图片");
  }
  if (metadata.format !== "png") {
    throw validationError("INVALID_MASK_FORMAT", "蒙版必须使用 PNG 格式");
  }
  if (metadata.width !== expected.width || metadata.height !== expected.height) {
    throw validationError("MASK_DIMENSIONS_MISMATCH", "蒙版尺寸必须与原图完全一致");
  }
}

export function validateEnhanceOutput(width: number, height: number, scale: 2 | 4) {
  const outputWidth = width * scale;
  const outputHeight = height * scale;
  if (
    outputWidth > IMAGE_AI_MAX_OUTPUT_EDGE ||
    outputHeight > IMAGE_AI_MAX_OUTPUT_EDGE ||
    outputWidth * outputHeight > IMAGE_AI_MAX_OUTPUT_PIXELS
  ) {
    throw validationError("ENHANCE_OUTPUT_TOO_LARGE", "增强后的图片将超过 1 亿像素或 16384px 最长边");
  }
}

export function validationError(code: string, message: string) {
  return Object.assign(new Error(message), { code });
}
