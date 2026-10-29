/** 图集先生成不带配乐的独立原片，再交给同一混音管线；源图片不改写。 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { ArchiveVideoEditInput } from "@toolbox/shared";
import { runMediaProcess, VideoEditError, type MediaTools } from "./renderer";
export async function renderSlideshow(options: {
  tools: MediaTools;
  images: string[];
  settings: NonNullable<ArchiveVideoEditInput["slideshow"]>;
  directory: string;
  output: string;
  signal: AbortSignal;
  maxBytes: number;
  onProgress: (value: number) => void;
}) {
  const dimensions = { portrait: [720, 1280], landscape: [1280, 720], square: [1080, 1080] } as const;
  const [width, height] = dimensions[options.settings.aspect];
  const lines = ["ffconcat version 1.0"];
  for (const [index, file] of options.images.entries()) {
    options.signal.throwIfAborted();
    const metadata = await sharp(file, { limitInputPixels: 40_000_000, failOn: "warning" }).metadata();
    if (!metadata.format || !["jpeg", "png", "webp", "avif", "heif", "gif", "tiff"].includes(metadata.format))
      throw new VideoEditError("ARCHIVE_EDIT_IMAGE_INVALID", "图集仅接受有效的位图图片", 415);
    const name = `slide-${String(index).padStart(3, "0")}.jpg`;
    await sharp(file, { limitInputPixels: 40_000_000, failOn: "warning" })
      .rotate()
      .resize(width, height, { fit: "contain", background: "#ffffff" })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 92 })
      .toFile(path.join(options.directory, name));
    lines.push(`file '${name}'`, `duration ${options.settings.secondsPerImage}`);
    options.onProgress(((index + 1) / options.images.length) * 25);
  }
  lines.push(`file 'slide-${String(options.images.length - 1).padStart(3, "0")}.jpg'`);
  const list = path.join(options.directory, "slides.ffconcat");
  await fs.writeFile(list, lines.join("\n"), { flag: "wx" });
  await runMediaProcess(
    options.tools.ffmpeg,
    [
      "-hide_banner",
      "-v",
      "error",
      "-nostdin",
      "-y",
      "-protocol_whitelist",
      "file,pipe",
      "-f",
      "concat",
      "-safe",
      "1",
      "-i",
      list,
      "-vf",
      "fps=25,format=yuv420p",
      "-t",
      String(options.images.length * options.settings.secondsPerImage),
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-movflags",
      "+faststart",
      options.output
    ],
    options.signal,
    { output: options.output, maxBytes: options.maxBytes }
  );
}
