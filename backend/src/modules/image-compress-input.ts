/**
 * 中文模块说明：后端应用层，负责 后端公共服务、配置或基础设施能力
 */
import path from "node:path";
import type { FastifyRequest } from "fastify";

const IMAGE_COMPRESS_MAX_FILE_BYTES = 20 * 1024 * 1024;
export const IMAGE_COMPRESS_MAX_PIXELS = 40_000_000;
export const SUPPORTED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export class ImageInputError extends Error {
  constructor(
    readonly statusCode: 400 | 413 | 415,
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

export async function readImageMultipart(request: FastifyRequest) {
  let input: Buffer | undefined;
  let originalName = "image";
  const fields: Record<string, unknown> = {};
  for await (const part of request.parts({ limits: { fileSize: IMAGE_COMPRESS_MAX_FILE_BYTES, files: 1 } })) {
    if (part.type === "field") {
      fields[part.fieldname] = part.value;
      continue;
    }
    if (!SUPPORTED_IMAGE_MIME_TYPES.has(part.mimetype)) {
      part.file.resume();
      throw new ImageInputError(415, "UNSUPPORTED_IMAGE_TYPE", "Only JPEG, PNG and WebP images are supported");
    }
    input = await part.toBuffer();
    originalName = path.basename(part.filename || "image");
    if (part.file.truncated || input.length > IMAGE_COMPRESS_MAX_FILE_BYTES) {
      throw new ImageInputError(413, "IMAGE_TOO_LARGE", "Image exceeds the 20MB limit");
    }
  }
  if (!input) throw new ImageInputError(400, "FILE_REQUIRED", "Please upload an image file");
  return { input, originalName, fields };
}

export function parseImageOptions(fields: Record<string, unknown>) {
  return {
    quality: Number(fields.quality ?? 78),
    outputFormat: String(fields.outputFormat ?? "webp"),
    width: fields.width ? Number(fields.width) : undefined
  };
}
