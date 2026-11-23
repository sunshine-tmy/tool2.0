import type { ArchiveSubtitle } from "./video-studio";
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
export const archiveTextGlyphs = (text: string) => Array.from(segmenter.segment(text), (entry) => entry.segment);
export const archiveVerticalText = (align?: ArchiveSubtitle["textAlign"]) => align?.startsWith("vertical-") ?? false;

/** Explicit newlines create right-to-left columns; long columns wrap at the canvas safe height. */
export function archiveVerticalColumns(text: string, height: number, font: number, spacing: number): string[] {
  const step = Math.max(1, font + spacing);
  const count = Math.max(1, Math.floor((height - font) / step) + 1);
  return text
    .replaceAll("\r", "")
    .split("\n")
    .flatMap((paragraph) => {
      const glyphs = archiveTextGlyphs(paragraph),
        columns: string[] = [];
      for (let index = 0; index < glyphs.length; index += count)
        columns.push(glyphs.slice(index, index + count).join(""));
      return columns.length ? columns : [""];
    });
}

/** Geometry is shared by canvas preview, selection bounds, and ASS glyph positions. */
export function archiveVerticalGeometry(
  columns: { text: string; width: number }[],
  font: number,
  letterSpacing: number,
  lineSpacing: number,
  alignment: ArchiveSubtitle["textAlign"]
) {
  const step = Math.max(1, font + letterSpacing),
    gap = font * 0.2 + lineSpacing;
  const values = columns.map((column) => {
    const glyphs = archiveTextGlyphs(column.text);
    return { glyphs, width: Math.max(font, column.width), height: font + Math.max(0, glyphs.length - 1) * step };
  });
  const width = values.reduce((sum, column) => sum + column.width, 0) + Math.max(0, values.length - 1) * gap;
  const height = Math.max(font, ...values.map((column) => column.height));
  const glyphs: { text: string; x: number; y: number }[] = [];
  let right = width / 2;
  for (const column of values) {
    const x = right - column.width / 2;
    const offset =
      alignment === "vertical-bottom"
        ? height - column.height
        : alignment === "vertical-center"
          ? (height - column.height) / 2
          : 0;
    const top = -height / 2 + offset + font / 2;
    column.glyphs.forEach((text, index) => glyphs.push({ text, x, y: top + index * step }));
    right -= column.width + gap;
  }
  return { width, height, glyphs };
}
