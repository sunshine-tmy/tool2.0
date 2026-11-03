/** Resolve installed shared tools without owning capabilities or reading configuration at import time. */
export type FfmpegTools = { ffmpeg: string; ffprobe: string };
export async function resolveFfmpegTools(options: {
  managed: boolean;
  fallback: Partial<FfmpegTools>;
  asset: (relative: string) => Promise<string>;
}): Promise<FfmpegTools> {
  try {
    const suffix = process.platform === "win32" ? ".exe" : "";
    const [ffmpeg, ffprobe] = await Promise.all(["ffmpeg", "ffprobe"].map((n) => options.asset(`bin/${n}${suffix}`)));
    return { ffmpeg, ffprobe };
  } catch {
    if (options.managed || !options.fallback.ffmpeg || !options.fallback.ffprobe) throw new Error("FFMPEG_UNAVAILABLE");
    return options.fallback as FfmpegTools;
  }
}
