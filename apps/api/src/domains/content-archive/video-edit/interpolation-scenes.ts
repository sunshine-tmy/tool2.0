import fs from "node:fs/promises";
import path from "node:path";
import { runMediaProcess, VideoEditError, type RenderVideoOptions } from "./renderer";

/** 切镜按原始时间点分开处理，避免插值器的最近帧策略提前切换画面。 */
export async function interpolationSceneEdges(
  options: RenderVideoOptions,
  input: string,
  duration: number,
  fps: number
) {
  const points = new Set<number>((options.interpolationBoundaries ?? []).map((time) => Math.round(time * fps) / fps));
  let line = "";
  await runMediaProcess(
    options.tools.ffmpeg,
    [
      "-hide_banner",
      "-v",
      "info",
      "-nostdin",
      "-i",
      input,
      "-vf",
      "select='gt(scene,0.3)',showinfo",
      "-an",
      "-f",
      "null",
      "-"
    ],
    options.signal,
    {
      onDiagnostic: (text) => {
        line += text;
        const lines = line.split(/\r?\n/);
        line = lines.pop()!.slice(-4096);
        for (const item of lines) {
          const match = /pts_time:([0-9.]+)/.exec(item);
          if (match) points.add(Math.round(Number(match[1]) * fps) / fps);
        }
        if (points.size > 10000) throw new VideoEditError("ARCHIVE_INTERPOLATION_SCENES", "镜头数量过多，请分段处理");
      }
    }
  );
  return [0, ...[...points].filter((time) => time > 0 && time < duration).sort((a, b) => a - b), duration];
}
export async function renderFlowScenes(
  options: RenderVideoOptions,
  input: string,
  output: string,
  fps: number,
  duration: number,
  remaining: number,
  filter: (duration: number) => string
) {
  const edges = await interpolationSceneEdges(options, input, duration, fps);
  const directory = await fs.mkdtemp(`${output}.scenes-`);
  let occupied = 0;
  try {
    const list = ["ffconcat version 1.0"];
    for (let i = 0; i < edges.length - 1; i++) {
      options.signal.throwIfAborted();
      const length = edges[i + 1] - edges[i],
        name = `scene-${i}.mkv`,
        file = path.join(directory, name);
      if (length <= 0) continue;
      if (remaining - occupied < 1024 * 1024)
        throw new VideoEditError("ARCHIVE_EDIT_DISK_FULL", "补帧临时空间不足", 507);
      options.onStatus?.(`兼容补帧 · 镜头 ${i + 1}/${edges.length - 1} · ${fps} FPS`);
      await runMediaProcess(
        options.tools.ffmpeg,
        [
          "-hide_banner",
          "-v",
          "error",
          "-nostdin",
          "-y",
          "-filter_threads",
          "1",
          "-ss",
          String(edges[i]),
          "-t",
          String(length),
          "-i",
          input,
          "-vf",
          filter(length),
          "-an",
          "-t",
          String(length),
          "-r",
          String(fps),
          "-c:v",
          "ffv1",
          "-level",
          "3",
          file
        ],
        options.signal,
        { output: file, maxBytes: remaining - occupied }
      );
      occupied += (await fs.stat(file)).size;
      list.push(`file '${name}'`);
      options.onProgress((edges[i + 1] / duration) * 100);
    }
    const manifest = path.join(directory, "scenes.ffconcat");
    await fs.writeFile(manifest, list.join("\n"));
    await runMediaProcess(
      options.tools.ffmpeg,
      [
        "-v",
        "error",
        "-nostdin",
        "-y",
        "-f",
        "concat",
        "-safe",
        "1",
        "-i",
        manifest,
        "-i",
        input,
        "-map",
        "0:v:0",
        "-map",
        "1:a?",
        "-t",
        String(duration),
        "-c",
        "copy",
        output
      ],
      options.signal,
      { output, maxBytes: remaining - occupied }
    );
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}
