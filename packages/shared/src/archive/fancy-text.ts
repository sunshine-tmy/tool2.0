export interface FancyPath {
  kind: "m" | "l" | "b";
  points: number[];
}
export interface FancyShape {
  color: string;
  path: FancyPath[];
}
export interface FancyTextLayout {
  font: number;
  lineHeight: number;
  lines: string[];
  lineWidths: number[];
  blockWidth: number;
  vertical: boolean;
  glyphs: { text: string; x: number; y: number }[];
}
export const archiveFancyTextStyles = [
  {
    id: "flame-blue" as const,
    label: "烈焰蓝字",
    fill: "#eaf8ff",
    strokes: [
      { color: "#ff4aa5", width: 0.15 },
      { color: "#fff000", width: 0.12 },
      { color: "#2448ff", width: 0.085 },
      { color: "#ffffff", width: 0.022 }
    ],
    paddingX: 0.35,
    paddingY: 0.36
  }
];
export const archiveFancyTextStyle = (id?: string) => archiveFancyTextStyles.find((style) => style.id === id);
const outer: FancyPath[] = [
  { kind: "m", points: [-0.1, -0.8] },
  { kind: "b", points: [0.43, -0.62, 0.03, -0.39, 0.32, -0.16] },
  { kind: "b", points: [0.43, -0.31, 0.4, -0.47, 0.46, -0.5] },
  { kind: "b", points: [0.63, 0.02, 0.41, 0.58, 0.02, 0.58] },
  { kind: "b", points: [-0.47, 0.6, -0.62, 0.13, -0.35, -0.21] },
  { kind: "b", points: [-0.37, 0.02, -0.17, 0.06, -0.2, -0.16] },
  { kind: "b", points: [-0.16, -0.42, 0.13, -0.48, -0.1, -0.8] }
];
const middle: FancyPath[] = [
  { kind: "m", points: [0.04, -0.42] },
  { kind: "b", points: [0.25, -0.12, 0.11, 0.08, 0.35, -0.04] },
  { kind: "b", points: [0.48, 0.3, 0.23, 0.58, 0.01, 0.57] },
  { kind: "b", points: [-0.35, 0.58, -0.48, 0.26, -0.26, -0.01] },
  { kind: "b", points: [-0.23, 0.24, 0.13, 0.04, 0.04, -0.42] }
];
const inner: FancyPath[] = [
  { kind: "m", points: [0.06, -0.1] },
  { kind: "b", points: [0.1, 0.14, 0.28, 0.2, 0.23, 0.39] },
  { kind: "b", points: [0.17, 0.67, -0.25, 0.6, -0.23, 0.34] },
  { kind: "b", points: [-0.21, 0.17, -0.03, 0.18, 0.06, -0.1] }
];
export function archiveFancyFlames(layout: FancyTextLayout, align?: string): FancyShape[] {
  const anchors: { x: number; y: number }[] = [];
  if (layout.vertical) anchors.push(...layout.glyphs.filter((glyph) => glyph.text.trim()));
  else
    layout.lines.forEach((line, index) => {
      if (!line.trim()) return;
      const width = layout.lineWidths[index],
        count = Math.max(1, Math.min(64, Math.ceil(width / layout.font)));
      const left =
        align === "left" ? -layout.blockWidth / 2 : align === "right" ? layout.blockWidth / 2 - width : -width / 2;
      for (let i = 0; i < count; i++)
        anchors.push({
          x: left + (width * (i + 0.5)) / count,
          y: (index - (layout.lines.length - 1) / 2) * layout.lineHeight
        });
    });
  return anchors.flatMap((anchor) =>
    [
      { color: "#ff4b1f", source: outer },
      { color: "#ff9d18", source: middle },
      { color: "#ffe752", source: inner }
    ].map(({ color, source }) => ({
      color,
      path: source.map((command) => ({
        kind: command.kind,
        points: command.points.map((point, i) => point * layout.font + (i % 2 ? anchor.y : anchor.x))
      }))
    }))
  );
}
export function archiveFancySvgPath(path: FancyPath[]) {
  return (
    path
      .map(
        (command) =>
          `${command.kind.toUpperCase() === "B" ? "C" : command.kind.toUpperCase()} ${command.points.join(" ")}`
      )
      .join(" ") + " Z"
  );
}

/** Exact cubic bounds make ASS drawing alignment agree with the canvas paths. */
export function archiveFancyPathBounds(path: FancyPath[]) {
  const xs: number[] = [],
    ys: number[] = [];
  let x = 0,
    y = 0;
  const extremes = (a: number, b: number, c: number, d: number) => {
    const aa = -a + 3 * b - 3 * c + d,
      bb = 2 * (a - 2 * b + c),
      cc = b - a;
    const discriminant = bb * bb - 4 * aa * cc;
    const roots =
      Math.abs(aa) < 1e-9
        ? Math.abs(bb) < 1e-9
          ? []
          : [-cc / bb]
        : discriminant < 0
          ? []
          : [(-bb + Math.sqrt(discriminant)) / (2 * aa), (-bb - Math.sqrt(discriminant)) / (2 * aa)];
    return [
      a,
      d,
      ...roots
        .filter((t) => t > 0 && t < 1)
        .map((t) => (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t ** 2 * c + t ** 3 * d)
    ];
  };
  for (const command of path) {
    const points = command.points;
    if (command.kind === "b") {
      xs.push(...extremes(x, points[0], points[2], points[4]));
      ys.push(...extremes(y, points[1], points[3], points[5]));
    } else {
      xs.push(points[0]);
      ys.push(points[1]);
    }
    x = points.at(-2)!;
    y = points.at(-1)!;
  }
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
}
