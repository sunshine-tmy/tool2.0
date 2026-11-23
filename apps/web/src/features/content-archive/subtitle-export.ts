import type { ArchiveStudio } from "@toolbox/shared/archive";
import { subtitleLayout } from "./subtitle-interaction";

/** Measure in the ASS logical coordinate system; export can then position each line without changing its glyph proportions. */
export function prepareSubtitleExport(studio: ArchiveStudio, width: number, height: number): ArchiveStudio {
  const value: ArchiveStudio = JSON.parse(JSON.stringify(studio));
  if (!value.subtitles.length) return value;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) throw new Error("无法读取文本排版，请重新打开编辑器后重试");
  const logicalWidth = Math.max(1, Math.round((width / height) * 720));
  value.subtitles = value.subtitles.map((cue) => {
    const layout = subtitleLayout(cue, logicalWidth, 720, ctx);
    return {
      ...cue,
      textLayout: { width: logicalWidth, lines: layout.lines.map((text, i) => ({ text, width: layout.lineWidths[i] })) }
    };
  });
  return value;
}
