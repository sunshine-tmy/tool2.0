/** 图集先生成不带配乐的独立原片，再交给同一混音管线；源图片不改写。 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  ARCHIVE_SLIDESHOW_DIMENSIONS,
  archiveSlideshowCycles,
  archiveSlideshowDuration,
  type ArchiveVideoEditInput
} from "@toolbox/shared";
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
  const [width, height] = ARCHIVE_SLIDESHOW_DIMENSIONS[options.settings.aspect];
  const lines = ["ffconcat version 1.0"];
  const names: string[] = [];
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
    names.push(name);
    options.onProgress(((index + 1) / options.images.length) * 25);
  }
  const duration = archiveSlideshowDuration(names.length, options.settings.secondsPerImage);
  if (!duration) throw new VideoEditError("ARCHIVE_EDIT_SLIDESHOW_INVALID", "图集不能为空");
  const cycles = archiveSlideshowCycles(names.length, options.settings.secondsPerImage);
  for (let cycle = 0; cycle < cycles; cycle++) {
    for (const name of names) {
      lines.push(`file '${name}'`, `duration ${options.settings.secondsPerImage}`);
    }
  }
  lines.push(`file '${names[names.length - 1]}'`);
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
      String(duration),
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
