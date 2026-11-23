import { archiveVisibleSubtitles, watermarkTrackSettings, archiveWatermarkSize } from "@toolbox/shared";
import { writeStudioSubtitles } from "./studio-render";
import { watermarkFilter } from "./watermark-filter";
import { VideoEditError, type RenderVideoOptions } from "./renderer";

/** 水印与文本按同一轨道层级逐层合成，位于上方视频下的区间裁去。 */
export async function appendStudioVisuals(
  options: RenderVideoOptions,
  args: string[],
  filters: string[],
  videoLabel: string,
  firstIndex: number,
  width: number,
  height: number,
  duration: number,
  subtitleFiles: string[]
) {
  const clips = options.layoutClips ?? options.cut ?? [{ id: "original", start: 0, end: duration, lane: 1 }];
  const visuals = [
    ...(options.studio?.subtitles ?? []).map((cue) => ({ kind: "text" as const, lane: cue.lane ?? 0, cue })),
    ...(options.studio?.watermarks ?? []).map((mark) => ({ kind: "watermark" as const, lane: mark.lane ?? 0, mark }))
  ].sort((a, b) => b.lane - a.lane);
  let index = firstIndex;
  for (let i = 0; i < visuals.length; i++) {
    const visual = visuals[i];
    if (visual.kind === "text") {
      const cues = [visual.cue];
      // 相邻文字层共用一次 ASS 合成，避免字幕稿逐句启动字体渲染器。
      while (visuals[i + 1]?.kind === "text") {
        const next = visuals[++i];
        if (next.kind === "text") cues.push(next.cue);
      }
      const visible = archiveVisibleSubtitles(cues, clips);
      if (!visible.length) continue;
      const file = `${options.output}.layer-${i}.ass`;
      const name = await writeStudioSubtitles(file, visible, width, height);
      subtitleFiles.push(file);
      const next = `studio_text_${i}`;
      filters.push(`[${videoLabel}]subtitles=filename='${name}'[${next}]`);
      videoLabel = next;
    } else {
      const mark = visual.mark;
      if (mark.hidden || mark.start >= duration) continue;
      const visible = archiveVisibleSubtitles(
        [{ ...mark, end: Math.min(mark.followEnd ? duration : mark.end, duration) }],
        clips
      );
      if (!visible.length) continue;
      const asset = options.watermarkFiles?.[mark.asset.id];
      if (!asset) throw new VideoEditError("ARCHIVE_WATERMARK_MISSING", "水印素材快照不存在", 404);
      const settings = watermarkTrackSettings(mark, duration, width, height),
        size = archiveWatermarkSize(mark.settings, asset, { width, height });
      args.push("-loop", "1", "-framerate", "25", "-i", asset.file);
      const output = `studio_watermark_${i}`,
        logo = `studio_logo_${i}`;
      const enable = visible.map((span) => `gte(t,${span.start})*lt(t,${span.end})`).join("+");
      const filter = watermarkFilter(
        settings,
        index++,
        Math.max(1, Math.round(size.width * (mark.scaleX ?? 1))),
        Math.max(1, Math.round(size.height * (mark.scaleY ?? 1))),
        mark.angle ?? 0,
        settings.motion.type === "bounce" ? 0 : (mark.offsetX ?? 0) * width,
        settings.motion.type === "bounce" ? 0 : (mark.offsetY ?? 0) * height,
        true
      )
        .replace("[base]", `[${videoLabel}]`)
        .replaceAll("[logo]", `[${logo}]`)
        .replace("[watermarked]", `[${output}]`)
        .replace(/:enable='[^']*'/, `:enable='${enable}'`);
      filters.push(filter);
      videoLabel = output;
    }
  }
  return { label: videoLabel, inputCount: index - firstIndex };
}
