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
  const outputFormat = options.outputFormat ?? "webp";

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
