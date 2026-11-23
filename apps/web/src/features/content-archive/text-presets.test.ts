import { expect, it } from "vitest";
import { activeArchiveTextPreset, archiveTextPresets } from "./text-presets";
import { paintSubtitle } from "./subtitle-paint";
import type { ArchiveSubtitle } from "@toolbox/shared/archive";
const cue: ArchiveSubtitle = {
  id: "text_001",
  start: 0,
  end: 3,
  text: "文本",
  fontSize: 36,
  color: "#ffffff",
  position: "center",
  opacity: 0.5
};
const preset = (id: string) => archiveTextPresets.find((style) => style.id === id)!.style;
function canvas() {
  const calls: { kind: string; color: string; alpha: number; values: unknown[]; lineWidth?: number }[] = [],
    states: Record<string, unknown>[] = [];
  const ctx = {
    font: "",
    fillStyle: "",
    strokeStyle: "",
    globalAlpha: 1,
    lineWidth: 1,
    lineJoin: "miter",
    textAlign: "left",
    textBaseline: "middle",
    save(this: CanvasRenderingContext2D) {
      states.push({
        fillStyle: this.fillStyle,
        strokeStyle: this.strokeStyle,
        globalAlpha: this.globalAlpha,
        lineWidth: this.lineWidth
      });
    },
    restore(this: CanvasRenderingContext2D) {
      Object.assign(this, states.pop());
    },
    rotate() {},
    scale() {},
    translate(...values: number[]) {
      calls.push({ kind: "translate", color: "", alpha: 1, values });
    },
    measureText(text: string) {
      return { width: text.length * 20 };
    },
    fillRect(this: CanvasRenderingContext2D, ...values: number[]) {
      calls.push({ kind: "rect", color: String(this.fillStyle), alpha: this.globalAlpha, values });
    },
    strokeRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    bezierCurveTo() {},
    closePath() {},
    fill(this: CanvasRenderingContext2D) {
      calls.push({ kind: "pathfill", color: String(this.fillStyle), alpha: this.globalAlpha, values: [] });
    },
    fillText(this: CanvasRenderingContext2D, ...values: unknown[]) {
      calls.push({ kind: "fill", color: String(this.fillStyle), alpha: this.globalAlpha, values });
    },
    strokeText(this: CanvasRenderingContext2D, ...values: unknown[]) {
      calls.push({
        kind: "stroke",
        color: String(this.strokeStyle),
        alpha: this.globalAlpha,
        values,
        lineWidth: this.lineWidth
      });
    }
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}
it("switching presets clears previous effects and identifies manual edits", () => {
  const styled = { ...cue, ...preset("black-yellow"), ...preset("white-red") };
  expect(styled.backgroundOpacity).toBe(0);
  expect(styled.shadowOpacity).toBe(0);
  expect(activeArchiveTextPreset(styled)).toBe("white-red");
  expect(activeArchiveTextPreset({ ...styled, color: "#123456" })).toBeUndefined();
  const plain = { ...styled, ...preset("none") };
  expect(plain).toMatchObject({
    color: "#ffffff",
    outlineWidth: 0,
    shadowOpacity: 0,
    backgroundOpacity: 0,
    fontSize: 36,
    text: cue.text,
    opacity: 0.5
  });
  expect(activeArchiveTextPreset(plain)).toBe("none");
});
it("paints full text-block backgrounds with the material opacity and skips zero outlines", () => {
  const { ctx, calls } = canvas();
  paintSubtitle(ctx, { ...cue, ...preset("black-yellow") }, 1280, 720);
  expect(calls.find((call) => call.kind === "rect")).toMatchObject({
    color: "#ffe600",
    alpha: 0.5,
    values: [-26, -24, 52, 48]
  });
  expect(calls.some((call) => call.kind === "stroke")).toBe(false);
  expect(calls.find((call) => call.kind === "fill")).toMatchObject({ color: "#111111", alpha: 0.5 });
});
it("paints shadows behind the foreground and uses the selected outline color", () => {
  const shadow = canvas();
  paintSubtitle(shadow.ctx, { ...cue, ...preset("white-blue-shadow") }, 1280, 720);
  expect(shadow.calls.filter((call) => call.kind === "fill").map((call) => call.color)).toEqual(["#189cdf", "#ffffff"]);
  expect(shadow.calls.some((call) => call.kind === "translate" && call.values[0] === 2 && call.values[1] === 2)).toBe(
    true
  );
  const outline = canvas();
  paintSubtitle(outline.ctx, { ...cue, ...preset("white-red") }, 1280, 720);
  expect(outline.calls.find((call) => call.kind === "stroke")?.color).toBe("#f05055");
  expect(outline.calls.find((call) => call.kind === "stroke")?.lineWidth).toBe(4);
});

it("paints actual flames before four separate outline passes and the text face", () => {
  const { ctx, calls } = canvas();
  paintSubtitle(ctx, { ...cue, decoration: "flame-blue", bold: true }, 1280, 720);
  expect(calls.filter((call) => call.kind === "pathfill")).toHaveLength(6);
  expect(calls.filter((call) => call.kind === "stroke").map((call) => call.color)).toEqual([
    "#ff4aa5",
    "#fff000",
    "#2448ff",
    "#ffffff"
  ]);
  expect(calls.filter((call) => call.kind === "fill")).toHaveLength(1);
  expect(
    calls.filter((call) => ["stroke", "fill", "pathfill"].includes(call.kind)).every((call) => call.alpha === 0.5)
  ).toBe(true);
  expect(activeArchiveTextPreset({ ...cue, decoration: "flame-blue" })).toBeUndefined();
});
