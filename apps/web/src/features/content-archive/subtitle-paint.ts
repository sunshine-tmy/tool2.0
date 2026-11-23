import { archiveTextAppearance, archiveFancyTextStyle, type ArchiveSubtitle } from "@toolbox/shared/archive";
import { subtitleFont, subtitleGlyphs, subtitleLayout } from "./subtitle-interaction";
import { paintFancyFlames } from "./fancy-text-paint";

export function paintSubtitle(ctx: CanvasRenderingContext2D, cue: ArchiveSubtitle, width: number, height: number) {
  const layout = subtitleLayout(cue, width, height, ctx),
    fancy = archiveFancyTextStyle(cue.decoration),
    style = archiveTextAppearance(fancy ? { color: cue.color, outlineWidth: 0 } : cue),
    unit = height / 720;
  ctx.save();
  ctx.translate(layout.cx, layout.cy);
  ctx.rotate((layout.rotation * Math.PI) / 180);
  ctx.scale(layout.scale * layout.scaleX, layout.scale * layout.scaleY);
  ctx.font = subtitleFont(cue, height);
  ctx.textAlign = layout.vertical ? "center" : "left";
  ctx.textBaseline = "middle";
  ctx.lineWidth = Math.max(0.01, 2 * style.outlineWidth * unit);
  ctx.lineJoin = "round";
  ctx.globalAlpha = cue.opacity ?? 1;
  const nativeSpacing = Reflect.has(ctx, "letterSpacing");
  let strokeOnly = false,
    fillOnly = false;
  if (nativeSpacing) ctx.letterSpacing = `${layout.vertical ? 0 : layout.letterSpacing}px`;
  if (style.backgroundOpacity) {
    ctx.save();
    ctx.globalAlpha = (cue.opacity ?? 1) * style.backgroundOpacity;
    ctx.fillStyle = style.backgroundColor;
    const padding = style.backgroundPadding * unit;
    ctx.fillRect(
      -layout.blockWidth / 2 - padding,
      -layout.blockHeight / 2 - padding,
      layout.blockWidth + padding * 2,
      layout.blockHeight + padding * 2
    );
    ctx.restore();
  }
  function run(text: string, x: number, y: number) {
    if (!fillOnly && (strokeOnly || style.outlineWidth > 0)) ctx.strokeText(text, x, y);
    if (!strokeOnly) ctx.fillText(text, x, y);
  }
  function underline(x: number, y: number, width: number) {
    const thickness = Math.max(1, layout.font / 16),
      top = y + layout.font * 0.45;
    if (!fillOnly && (strokeOnly || style.outlineWidth > 0)) ctx.strokeRect(x, top, width, thickness);
    if (!strokeOnly) ctx.fillRect(x, top, width, thickness);
  }
  function text() {
    if (layout.vertical) {
      for (const glyph of layout.glyphs) {
        run(glyph.text, glyph.x, glyph.y);
        if (cue.underline && glyph.text.trim()) {
          const width = ctx.measureText(glyph.text).width;
          underline(glyph.x - width / 2, glyph.y, width);
        }
      }
      return;
    }
    layout.lines.forEach((line, i) => {
      const y = (i - (layout.lines.length - 1) / 2) * layout.lineHeight,
        lineWidth = layout.lineWidths[i];
      let x =
        cue.textAlign === "left"
          ? -layout.blockWidth / 2
          : cue.textAlign === "right"
            ? layout.blockWidth / 2 - lineWidth
            : -lineWidth / 2;
      const start = x;
      if (layout.letterSpacing && !nativeSpacing) {
        for (const glyph of subtitleGlyphs(line)) {
          run(glyph, x, y);
          x += ctx.measureText(glyph).width + layout.letterSpacing;
        }
      } else run(line, x, y);
      if (cue.underline && line) underline(start, y, lineWidth);
    });
  }
  if (fancy) {
    paintFancyFlames(ctx, layout, cue.textAlign);
    strokeOnly = true;
    for (const stroke of fancy.strokes) {
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width * layout.font * 2;
      text();
    }
    strokeOnly = false;
    fillOnly = true;
    ctx.fillStyle = cue.color;
    text();
    ctx.restore();
    return;
  }
  if (style.shadowOpacity > 0 && (style.shadowX || style.shadowY)) {
    ctx.save();
    ctx.translate(style.shadowX * unit, style.shadowY * unit);
    ctx.strokeStyle = ctx.fillStyle = style.shadowColor;
    ctx.globalAlpha = (cue.opacity ?? 1) * style.shadowOpacity;
    text();
    ctx.restore();
  }
  ctx.strokeStyle = style.outlineColor;
  ctx.fillStyle = style.color;
  text();
  ctx.restore();
}
