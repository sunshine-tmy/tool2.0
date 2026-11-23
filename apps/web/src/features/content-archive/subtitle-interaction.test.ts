import { expect, it } from "vitest";
import type { ArchiveSubtitle } from "@toolbox/shared/archive";
import { parseStudioSrt } from "./studio-subtitles";
import { measureSubtitleLine, subtitleBounds, subtitleLayout, wrapSubtitleLines } from "./subtitle-interaction";

// Deterministic metrics: full-width glyphs use one em, Latin uses half an em.
function context() {
  return {
    font: "",
    measureText(text: string) {
      const font = Number(/([\d.]+)px/.exec(this.font)?.[1]);
      return { width: Array.from(text).reduce((sum, char) => sum + (char.charCodeAt(0) > 127 ? font : font / 2), 0) };
    }
  } as CanvasRenderingContext2D;
}
const cue: ArchiveSubtitle = {
  id: "subtitle_001",
  start: 0,
  end: 3,
  text: "默认文本",
  fontSize: 36,
  color: "#ffffff",
  position: "bottom"
};

it("uses native letter spacing to keep connected-script shaping intact and restores the canvas state", () => {
  const measured: string[] = [];
  const ctx = {
    letterSpacing: "0px",
    measureText(text: string) {
      measured.push(text);
      return { width: 42 + Number.parseFloat(this.letterSpacing) * 3 };
    }
  } as CanvasRenderingContext2D;
  expect(measureSubtitleLine(ctx, "سلام", 2)).toBe(48);
  expect(measured).toEqual(["سلام"]);
  expect(ctx.letterSpacing).toBe("0px");
});

it("wraps imported bilingual subtitles in a portrait frame without reducing glyph size", () => {
  const [imported] = parseStudioSrt(
    "1\n00:00:00,000 --> 00:00:03,000\nKalau jenis malas nak sediakan macam-macam bahan\n如果你是懒得准备各种材料的人这款养颜茶适合你",
    () => cue.id
  );
  const ctx = context();
  const layout = subtitleLayout(imported, 405, 720, ctx);
  expect(layout.font).toBe(36);
  expect(layout.scaleX).toBe(1);
  expect(layout.scaleY).toBe(1);
  expect(layout.lines.length).toBeGreaterThan(2);
  expect(layout.lines.every((line) => ctx.measureText(line).width <= 357)).toBe(true);
  expect(layout.lines.join("").replaceAll(" ", "")).toBe(imported.text.replace(/\s/gu, ""));
  const bounds = subtitleBounds(imported, 405, 720, ctx);
  expect(bounds.lines).toEqual(layout.lines);
  expect(bounds.halfH * 2).toBe((layout.lines.length - 1) * layout.lineHeight + layout.font);
  expect(bounds.cy + bounds.halfH).toBeLessThan(720);
});

it("measures styled text, letter spacing, and multiline height for selection and alignment", () => {
  const ctx = context();
  const styled = {
    ...cue,
    text: "你好\n世界",
    bold: true,
    italic: true,
    fontFamily: "Courier New" as const,
    letterSpacing: 4,
    lineSpacing: 12
  };
  const layout = subtitleLayout(styled, 405, 720, ctx);
  expect(ctx.font).toContain('italic bold 36px "Courier New"');
  expect(layout.lineWidths).toEqual([76, 76]);
  expect(layout.lineHeight).toBe(36 * 1.2 + 12);
  const bounds = subtitleBounds(styled, 405, 720, ctx);
  expect(bounds.halfW).toBe(38);
  expect(bounds.halfH).toBe((layout.lineHeight + 36) / 2);
});

it("preserves explicit blank lines and wraps words without splitting a grapheme", () => {
  expect(wrapSubtitleLines("hello world\n\n文字", 6, (text) => text.length)).toEqual(["hello", "world", "", "文字"]);
  const glyph = "👨‍👩‍👧";
  expect(wrapSubtitleLines(glyph.repeat(2), glyph.length, (text) => text.length)).toEqual([glyph, glyph]);
});

it("adapts wrapping to the canvas ratio and keeps manual transforms and positions", () => {
  const text = "这是很长的一段测试字幕用于检查竖屏和横屏换行效果";
  const portrait = subtitleLayout({ ...cue, text }, 405, 720, context());
  const landscape = subtitleLayout({ ...cue, text }, 1280, 720, context());
  expect(portrait.lines.length).toBeGreaterThan(landscape.lines.length);
  const positioned = subtitleLayout({ ...cue, text, x: 0.3, y: 0.4, scaleX: 0.8, scaleY: 1.2 }, 405, 720, context());
  expect(positioned.cx).toBe(121.5);
  expect(positioned.cy).toBe(288);
  expect(positioned.scaleX).toBe(0.8);
  expect(positioned.scaleY).toBe(1.2);
});

it.each([
  ["vertical-top", -36, -36],
  ["vertical-center", -18, 0],
  ["vertical-bottom", 0, 36]
] as const)("lays out upright right-to-left columns with %s alignment", (textAlign, middleY, leftY) => {
  const text = { ...cue, position: "center" as const, text: "甲乙丙\n丁戊\n己", textAlign };
  const layout = subtitleLayout(text, 1280, 720, context());
  expect(layout.vertical).toBe(true);
  expect(layout.glyphs.map((glyph) => glyph.text).join("")).toBe("甲乙丙丁戊己");
  expect(layout.glyphs[0].x).toBeCloseTo(43.2);
  expect(layout.glyphs[0].y).toBe(-36);
  expect(layout.glyphs[3].x).toBeCloseTo(0);
  expect(layout.glyphs[3].y).toBe(middleY);
  expect(layout.glyphs[5].x).toBeCloseTo(-43.2);
  expect(layout.glyphs[5].y).toBe(leftY);
  const bounds = subtitleBounds(text, 1280, 720, context());
  expect(bounds.halfW).toBeCloseTo(61.2);
  expect(bounds.halfH).toBe(54);
});

it("wraps tall vertical text by the safe height, preserving graphemes and spacing", () => {
  const text = {
    ...cue,
    text: "甲乙丙丁戊己庚辛壬癸".repeat(2) + "👨‍👩‍👧",
    textAlign: "vertical-top" as const,
    letterSpacing: 4,
    lineSpacing: 12
  };
  const layout = subtitleLayout(text, 405, 180, context());
  expect(layout.lines.length).toBeGreaterThan(1);
  expect(layout.blockHeight).toBeLessThanOrEqual(180 - (48 * 180) / 720);
  expect(layout.glyphs.filter((glyph) => glyph.text === "👨‍👩‍👧")).toHaveLength(1);
  expect(layout.glyphs[1].y - layout.glyphs[0].y).toBe(10);
});
