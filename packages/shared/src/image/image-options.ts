/**
 * 中文模块说明：共享契约层，负责跨前后端复用的类型、Schema、响应和领域常量
 */
export const imageOutputFormats = ["jpeg", "png", "webp"] as const;

export type ImageOutputFormat = (typeof imageOutputFormats)[number];

export type RawImageOptions = {
  quality?: number;
  outputFormat?: string;
  width?: number;
};

export type ImageOptions = {
  quality: number;
  outputFormat: ImageOutputFormat;
  width?: number;
};

export function normalizeImageOptions(options: RawImageOptions): ImageOptions {
  // 未显式指定格式时统一输出 PNG，确保前端与直接调用 API 的默认行为一致。
  const outputFormat = options.outputFormat ?? "png";

  if (!imageOutputFormats.includes(outputFormat as ImageOutputFormat)) {
    throw new Error("Unsupported image format");
  }

  const rawQuality = Number.isFinite(options.quality) ? Number(options.quality) : 78;
  const quality = Math.min(95, Math.max(30, Math.round(rawQuality)));

  const width =
    Number.isFinite(options.width) && Number(options.width) > 0 ? Math.round(Number(options.width)) : undefined;

  return {
    quality,
    outputFormat: outputFormat as ImageOutputFormat,
    width
  };
}
