import fs from "node:fs/promises";
import path from "node:path";
import type { ArchiveSubtitle } from "@toolbox/shared";
import { probeMedia, VideoEditError, type RenderVideoOptions } from "./renderer";
export async function studioAudio(
  options: RenderVideoOptions,
  args: string[],
  filters: string[],
  duration: number,
  firstIndex: number
) {
  let index = firstIndex;
  const labels = ["[mix]"];
  for (const track of options.studio?.musicTracks ?? []) {
    if (track.start >= duration) continue;
    const file = options.trackFiles?.[track.id];
    if (!file) throw new VideoEditError("ARCHIVE_STUDIO_MUSIC_MISSING", "独立配乐轨素材不存在", 404);
    const info = await probeMedia(options.tools, file, options.signal, false);
    if (!info.hasAudio || track.end <= track.start)
      throw new VideoEditError("ARCHIVE_STUDIO_MUSIC_RANGE", "独立配乐轨的起点或时长无效");
    if (!track.loop && track.sourceStart >= info.duration) continue;
    if (track.loop) args.push("-stream_loop", "-1");
    args.push(
      "-protocol_whitelist",
      "file,pipe",
      "-ss",
      String(track.loop ? track.sourceStart % info.duration : track.sourceStart),
      "-i",
      file
    );
    const length = Math.min(duration, track.end) - track.start,
      fadeIn = Math.min(track.fadeIn, length / 2),
      fadeOut = Math.min(track.fadeOut, length / 2);
    const fades = `${fadeIn ? `,afade=t=in:st=0:d=${fadeIn}` : ""}${fadeOut ? `,afade=t=out:st=${length - fadeOut}:d=${fadeOut}` : ""}`;
    filters.push(
      `[${index}:a:0]aresample=48000,asetpts=PTS-STARTPTS,volume=${track.volume / 100},apad,atrim=duration=${length}${fades},adelay=${Math.round(track.start * 1000)}:all=1[studio${index}]`
    );
    labels.push(`[studio${index}]`);
    index++;
  }
  if (labels.length === 1) return "[mix]";
  filters.push(
    `${labels.join("")}amix=inputs=${labels.length}:duration=first:normalize=0,alimiter=limit=0.95:level=0:latency=1[studioMix]`
  );
  return "[studioMix]";
}
const stamp = (time: number) => {
  const cs = Math.round(time * 100);
  return `${Math.floor(cs / 360000)}:${String(Math.floor(cs / 6000) % 60).padStart(2, "0")}:${String(Math.floor(cs / 100) % 60).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
};
export async function writeStudioSubtitles(file: string, cues: ArchiveSubtitle[], width: number, height: number) {
  const logicalWidth = Math.round((width / height) * 720);
  const lines = [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${logicalWidth}`,
    "PlayResY: 720",
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    "Style: Default,Arial,36,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,0,2,24,24,24,1",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"
  ];
  for (const cue of cues) {
    if (cue.end <= cue.start) throw new VideoEditError("ARCHIVE_SUBTITLE_RANGE", "字幕终点须晚于起点");
    const hex = cue.color.slice(1);
    const color = `&H${hex.slice(4, 6)}${hex.slice(2, 4)}${hex.slice(0, 2)}&`;
    const alignment = cue.position === "top" ? 8 : cue.position === "center" ? 5 : 2;
    const text = cue.text.replaceAll("\\", "＼").replaceAll("{", "｛").replaceAll("}", "｝").replace(/\r?\n/g, "\\N");
    lines.push(
      `Dialogue: ${1999 - (cue.lane ?? 0)},${stamp(cue.start)},${stamp(cue.end)},Default,,0,0,0,,{\\an${alignment}\\fs${cue.fontSize}\\c${color}}${text}`
    );
  }
  await fs.writeFile(file, lines.join("\n"), "utf8");
  return path.basename(file);
}
