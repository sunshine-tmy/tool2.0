/** 按时间边界逐段合成自由轨道，限制同时打开的解码器数量。 */
import fs from "node:fs/promises";
import path from "node:path";
import {
  archiveClipDuration,
  archiveCutStarts,
  archiveProjectDuration,
  archiveTransitionDuration,
  archiveTransitionTarget
} from "@toolbox/shared";
import { runMediaProcess, VideoEditError, type RenderVideoOptions, type probeMedia } from "./renderer";

type Input = { file: string; offset: number };
type Transition = { from: number; to: number; start: number; end: number; file: string };
const frame = (time: number) => Math.round(time * 30) / 30;
export async function prepareFreeLayout(
  options: RenderVideoOptions,
  directory: string,
  info: Awaited<ReturnType<typeof probeMedia>>,
  initialBytes: number
) {
  const clips = options.cut!,
    starts = archiveCutStarts(clips);
  const duration = Math.ceil(archiveProjectDuration(clips, options.studio) * 30 - 1e-7) / 30;
  if (!(duration > 0 && duration <= 7200))
    throw new VideoEditError("ARCHIVE_CUT_TOO_LONG", "剪辑后视频时长须在 0～2 小时之间");
  const width = Math.max(2, Math.floor(info.width / 2) * 2),
    height = Math.max(2, Math.floor(info.height / 2) * 2);
  let occupied = initialBytes;
  const common = ["-hide_banner", "-v", "error", "-nostdin", "-y", "-filter_complex_threads", "1"];
  async function render(args: string[], output: string) {
    options.signal.throwIfAborted();
    const remaining = options.maxBytes - occupied;
    if (remaining < 1024 * 1024)
      throw new VideoEditError("ARCHIVE_EDIT_DISK_FULL", "多轨合成中间空间不足，原成品保留", 507);
    await runMediaProcess(options.tools.ffmpeg, [...common, ...args, output], options.signal, {
      output,
      maxBytes: remaining
    });
    const size = (await fs.stat(output)).size;
    occupied += size;
    if (occupied > options.maxBytes)
      throw new VideoEditError("ARCHIVE_EDIT_DISK_FULL", "多轨合成超过可用空间，原成品保留", 507);
  }
  const transitions: Transition[] = [];
  for (const [i, clip] of clips.entries()) {
    const to = archiveTransitionTarget(clips, i),
      length = archiveTransitionDuration(clips, i);
    if (to < 0 || length < 1 / 30) continue;
    const start = frame(starts[to]),
      end = Math.min(duration, frame(start + length));
    if (end <= start) continue;
    const file = path.join(directory, `free-transition-${i}.mkv`);
    await render(
      [
        "-ss",
        String(Math.max(0, start - starts[i])),
        "-i",
        path.join(directory, `clip-${i}.mkv`),
        "-i",
        path.join(directory, `clip-${to}.mkv`),
        "-filter_complex",
        `[0:v]trim=duration=${end - start},setpts=PTS-STARTPTS,settb=AVTB[a];[1:v]trim=duration=${end - start},setpts=PTS-STARTPTS,settb=AVTB[b];[a][b]xfade=transition=${clip.transition!.type}:duration=${end - start}:offset=0[v];[0:a]atrim=duration=${end - start},asetpts=PTS-STARTPTS[aa];[1:a]atrim=duration=${end - start},asetpts=PTS-STARTPTS[ab];[aa][ab]acrossfade=d=${end - start}[audio]`,
        "-map",
        "[v]",
        "-map",
        "[audio]",
        "-t",
        String(end - start),
        "-r",
        "30",
        "-c:v",
        "ffv1",
        "-level",
        "3",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "pcm_f32le"
      ],
      file
    );
    transitions.push({ from: i, to, start, end, file });
  }
  const edges = [
    ...new Set([
      0,
      duration,
      ...clips.flatMap((clip, i) => [frame(starts[i]), frame(starts[i] + archiveClipDuration(clip))]),
      ...transitions.flatMap((t) => [t.start, t.end])
    ])
  ]
    .filter((t) => t >= 0 && t <= duration)
    .sort((a, b) => a - b);
  const lines = ["ffconcat version 1.0"];
  for (let part = 0; part < edges.length - 1; part++) {
    options.signal.throwIfAborted();
    const start = edges[part],
      end = edges[part + 1],
      length = end - start,
      middle = (start + end) / 2;
    if (length < 1 / 60) continue;
    const active = clips
      .map((clip, i) => ({ clip, i }))
      .filter(({ clip, i }) => middle >= frame(starts[i]) && middle < frame(starts[i] + archiveClipDuration(clip)))
      .sort((a, b) => (a.clip.lane ?? 1) - (b.clip.lane ?? 1) || b.i - a.i);
    const visible = active[0]?.i;
    const fades = transitions.filter((t) => middle >= t.start && middle < t.end);
    const visualFade = fades.find((t) => t.from === visible || t.to === visible);
    const picture: Input | undefined = visualFade
      ? { file: visualFade.file, offset: start - visualFade.start }
      : visible === undefined
        ? undefined
        : { file: path.join(directory, `clip-${visible}.mkv`), offset: Math.max(0, start - starts[visible]) };
    // 音频独立于画面遮挡；同轨转场的两个源以已交叉淡化的音轨替换。
    const audio: Input[] = active
      .filter(({ i }) => !fades.some((t) => t.from === i || t.to === i))
      .map(({ i }) => ({ file: path.join(directory, `clip-${i}.mkv`), offset: Math.max(0, start - starts[i]) }));
    audio.push(...fades.map((t) => ({ file: t.file, offset: start - t.start })));
    const temporary: string[] = [];
    let mixed = audio,
      pass = 0;
    // 每批最多 16 路；分级混合防止大量重叠片段一次性耗尽文件句柄和内存。
    while (mixed.length > 1) {
      const next: Input[] = [];
      for (let at = 0; at < mixed.length; at += 16) {
        const batch = mixed.slice(at, at + 16),
          file = path.join(directory, `mix-${part}-${pass}-${at}.wav`),
          args: string[] = [],
          filters: string[] = [];
        batch.forEach((input, i) => {
          args.push("-ss", String(input.offset), "-t", String(length), "-i", input.file);
          filters.push(`[${i}:a]asetpts=PTS-STARTPTS,apad,atrim=duration=${length}[a${i}]`);
        });
        filters.push(
          `${batch.map((_, i) => `[a${i}]`).join("")}amix=inputs=${batch.length}:duration=longest:dropout_transition=0:normalize=0[a]`
        );
        await render(
          [...args, "-filter_complex", filters.join(";"), "-map", "[a]", "-t", String(length), "-c:a", "pcm_f32le"],
          file
        );
        temporary.push(file);
        next.push({ file, offset: 0 });
      }
      mixed = next;
      pass++;
    }
    const args: string[] = [],
      filters: string[] = [];
    if (picture) {
      args.push("-ss", String(picture.offset), "-i", picture.file);
      filters.push(
        `[0:v]setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=${length},trim=duration=${length},fps=30,format=yuv420p[v]`
      );
    } else args.push("-f", "lavfi", "-i", `color=c=black:s=${width}x${height}:r=30:d=${length}`);
    if (mixed[0]) args.push("-ss", String(mixed[0].offset), "-i", mixed[0].file);
    else args.push("-f", "lavfi", "-i", `anullsrc=r=48000:cl=stereo:d=${length}`);
    filters.push(`[1:a]asetpts=PTS-STARTPTS,apad,atrim=duration=${length}[a]`);
    const name = `span-${part}.mkv`,
      file = path.join(directory, name);
    await render(
      [
        ...args,
        "-filter_complex",
        filters.join(";"),
        "-map",
        picture ? "[v]" : "0:v:0",
        "-map",
        "[a]",
        "-t",
        String(length),
        "-r",
        "30",
        "-c:v",
        "ffv1",
        "-level",
        "3",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "pcm_f32le"
      ],
      file
    );
    for (const file of temporary) {
      occupied -= (await fs.stat(file)).size;
      await fs.rm(file, { force: true });
    }
    lines.push(`file '${name}'`, `duration ${length}`);
    options.onProgress(35 + (end / duration) * 25);
  }
  const list = path.join(directory, "clips.ffconcat");
  await fs.writeFile(list, lines.join("\n"), "utf8");
  return { directory, list, duration, occupied, info: { ...info, width, height } };
}
