import fs from "node:fs/promises";
import path from "node:path";
import { audioTempo } from "./audio-tempo";
import { subtitleEvents } from "./subtitle-events";
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
    if (track.start >= duration || track.muted) continue;
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
      fadeIn = Math.min(track.fadeIn, length),
      fadeOut = Math.min(track.fadeOut, length);
    const fades = `${fadeIn ? `,afade=t=in:st=0:d=${fadeIn}` : ""}${fadeOut ? `,afade=t=out:st=${length - fadeOut}:d=${fadeOut}` : ""}`;
    filters.push(
      `[${index}:a:0]aresample=48000,asetpts=PTS-STARTPTS,${audioTempo(track.speed ?? 1)},volume=${track.volume / 100},apad,atrim=duration=${length}${fades},adelay=${Math.round(track.start * 1000)}:all=1[studio${index}]`
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
    lines.push(...subtitleEvents(cue, logicalWidth));
  }
  await fs.writeFile(file, lines.join("\n"), "utf8");
  return path.basename(file);
}
