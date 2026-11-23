import { expect, it } from "vitest";
import {
  archiveFancyFlames,
  archiveFancyPathBounds,
  archiveFancySvgPath,
  archiveFancyTextStyle
} from "../archive/fancy-text";

const layout = {
  font: 36,
  lineHeight: 43.2,
  lines: ["你好", "好"],
  lineWidths: [72, 36],
  blockWidth: 72,
  vertical: false,
  glyphs: []
};
it("builds layered flames behind each non-empty text row and shares SVG paths", () => {
  const shapes = archiveFancyFlames(layout);
  expect(shapes).toHaveLength(9);
  expect(shapes.slice(0, 3).map((shape) => shape.color)).toEqual(["#ff4b1f", "#ff9d18", "#ffe752"]);
  expect(archiveFancySvgPath(shapes[0].path)).toContain("C ");
  expect(archiveFancySvgPath(shapes[0].path)).toMatch(/ Z$/);
  expect(shapes[6].path[0].points[1] - shapes[0].path[0].points[1]).toBeCloseTo(layout.lineHeight);
  expect(archiveFancyTextStyle("flame-blue")?.strokes).toHaveLength(4);
  expect(archiveFancyTextStyle("unknown")).toBeUndefined();
});
it("accounts for true cubic extrema rather than using the control point box", () => {
  const bounds = archiveFancyPathBounds([
    { kind: "m", points: [0, 0] },
    { kind: "b", points: [0, 100, 100, 100, 100, 0] }
  ]);
  expect(bounds).toEqual({ left: 0, top: 0, right: 100, bottom: 75 });
});
it("supports upright vertical glyphs and bounds flame count on unusually wide lines", () => {
  expect(
    archiveFancyFlames({
      ...layout,
      vertical: true,
      glyphs: [
        { text: "甲", x: 0, y: 0 },
        { text: " ", x: 0, y: 36 },
        { text: "😀", x: 0, y: 72 }
      ]
    })
  ).toHaveLength(6);
  expect(archiveFancyFlames({ ...layout, lines: ["宽"], lineWidths: [36000] })).toHaveLength(64 * 3);
});
