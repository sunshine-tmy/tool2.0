import { archiveFancyFlames, type FancyShape, type FancyTextLayout } from "@toolbox/shared/archive";
const cache = new Map<string, FancyShape[]>();
export function paintFancyFlames(ctx: CanvasRenderingContext2D, layout: FancyTextLayout, align?: string) {
  const key = JSON.stringify([
    layout.font,
    layout.lineHeight,
    layout.lines,
    layout.lineWidths,
    layout.blockWidth,
    layout.vertical,
    layout.glyphs,
    align
  ]);
  let shapes = cache.get(key);
  if (!shapes) {
    shapes = archiveFancyFlames(layout, align);
    cache.set(key, shapes);
    if (cache.size > 16) cache.delete(cache.keys().next().value!);
  }
  for (const shape of shapes) {
    ctx.beginPath();
    for (const command of shape.path) {
      const p = command.points;
      if (command.kind === "m") ctx.moveTo(p[0], p[1]);
      else if (command.kind === "l") ctx.lineTo(p[0], p[1]);
      else ctx.bezierCurveTo(p[0], p[1], p[2], p[3], p[4], p[5]);
    }
    ctx.closePath();
    ctx.fillStyle = shape.color;
    ctx.fill();
  }
}
