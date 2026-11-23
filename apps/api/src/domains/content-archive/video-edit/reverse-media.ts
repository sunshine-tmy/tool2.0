/** 分块倒放，FFmpeg 每次只缓存至多两秒画面，避免整段 reverse 耗尽内存。 */
import fs from "node:fs/promises";
import path from "node:path";
import { runMediaProcess, VideoEditError, type RenderVideoOptions } from "./renderer";

export async function prepareReverseMedia(
  options: RenderVideoOptions,
  source: string,
  start: number,
  end: number,
  hasAudio: boolean,
  directory: string,
  maxBytes: number
) {
  await fs.mkdir(directory);
  let occupied = 0;
  const lines = ["ffconcat version 1.0"];
  // 从片尾往前读，每块内部倒放后按当前顺序拼接。
  for (let edge = end, index = 0; edge > start + 1e-7; index++) {
    options.signal.throwIfAborted();
    const from = Math.max(start, edge - 2),
      length = edge - from;
    const name = `part-${index}.mkv`,
      file = path.join(directory, name);
    if (maxBytes - occupied < 1024 * 1024)
      throw new VideoEditError("ARCHIVE_EDIT_DISK_FULL", "倒放处理中间空间不足，原成品保留", 507);
    await runMediaProcess(
      options.tools.ffmpeg,
      [
        "-hide_banner",
        "-v",
        "error",
        "-nostdin",
        "-y",
        "-threads",
        "1",
        "-filter_complex_threads",
        "1",
        "-ss",
        String(from),
        "-i",
        source,
        "-filter_complex",
        `[0:v:0]trim=duration=${length},setpts=PTS-STARTPTS,reverse,setpts=PTS-STARTPTS[v]` +
          (hasAudio ? `;[0:a:0]atrim=duration=${length},asetpts=PTS-STARTPTS,areverse,asetpts=PTS-STARTPTS[a]` : ""),
        "-map",
        "[v]",
        ...(hasAudio ? ["-map", "[a]", "-c:a", "pcm_s16le"] : ["-an"]),
        "-t",
        String(length),
        "-c:v",
        "ffv1",
        "-level",
        "3",
        file
      ],
      options.signal,
      { output: file, maxBytes: maxBytes - occupied }
    );
    occupied += (await fs.stat(file)).size;
    lines.push(`file '${name}'`, `duration ${length}`);
    edge = from;
  }
  const list = path.join(directory, "reverse.ffconcat");
  await fs.writeFile(list, lines.join("\n"), "utf8");
  return { list, occupied };
}
