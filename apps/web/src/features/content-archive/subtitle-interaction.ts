import {
  archiveTextGlyphs,
  archiveVerticalText,
  archiveVerticalColumns,
  archiveVerticalGeometry,
  archiveTextAppearance,
  archiveFancyTextStyle,
  type ArchiveSubtitle
} from "@toolbox/shared/archive";

export interface SubtitleLayout {
  cx: number;
  cy: number;
  font: number;
  lineHeight: number;
  lines: string[];
  lineWidths: number[];
  letterSpacing: number;
  vertical: boolean;
  glyphs: { text: string; x: number; y: number }[];
  blockWidth: number;
  blockHeight: number;
  scale: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}
export const subtitleGlyphs = archiveTextGlyphs;
export const subtitleFont = (cue: ArchiveSubtitle, height: number) =>
  `${cue.italic ? "italic " : ""}${cue.bold ? "bold " : ""}${(cue.fontSize * height) / 720}px "${cue.fontFamily ?? "Arial"}", sans-serif`;
export function measureSubtitleLine(ctx: CanvasRenderingContext2D, text: string, spacing: number) {
  if (Reflect.has(ctx, "letterSpacing")) {
    const previous = ctx.letterSpacing;
    ctx.letterSpacing = `${spacing}px`;
    const width = ctx.measureText(text).width;
    ctx.letterSpacing = previous;
    return width;
  }
  if (!spacing) return ctx.measureText(text).width;
  const glyphs = subtitleGlyphs(text);
  return Math.max(
    0,
    glyphs.reduce((sum, glyph) => sum + ctx.measureText(glyph).width, 0) + Math.max(0, glyphs.length - 1) * spacing
  );
}

/** 保留显式换行；优先按单词换行，超长单词和中日韩文本按字形拆行，不横向压缩文字。 */
export function wrapSubtitleLines(text: string, maxWidth: number, measure: (text: string) => number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.replaceAll("\r", "").split("\n")) {
    let line = "";
    for (const token of paragraph.match(/\s+|\S+/gu) ?? []) {
      if (!token.trim()) {
        if (line) line += token;
        continue;
      }
      if (measure(line + token) <= maxWidth) {
        line += token;
        continue;
      }
      if (line.trimEnd()) lines.push(line.trimEnd());
      line = "";
      for (const segment of subtitleGlyphs(token)) {
        if (line && measure(line + segment) > maxWidth) {
          lines.push(line);
          line = "";
        }
        line += segment;
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

/** 字幕中心点与排版信息；安全边距采用与导出 ASS 相同的 720 高度坐标系。 */
export function subtitleLayout(
  cue: ArchiveSubtitle,
  width: number,
  height: number,
  ctx: CanvasRenderingContext2D
): SubtitleLayout {
  const scale = cue.scale ?? 1;
  // ASS 字幕角度逆时针为正，Canvas 与屏幕手柄使用顺时针坐标。
  const rotation = -(cue.rotation ?? 0);
  const font = (cue.fontSize * height) / 720;
  const lineHeight = font * 1.2 + ((cue.lineSpacing ?? 0) * height) / 720;
  const letterSpacing = ((cue.letterSpacing ?? 0) * height) / 720;
  ctx.font = subtitleFont(cue, height);
  const vertical = archiveVerticalText(cue.textAlign);
  const lines = vertical
    ? archiveVerticalColumns(cue.text, Math.max(1, height - (48 * height) / 720), font, letterSpacing)
    : wrapSubtitleLines(cue.text, Math.max(1, width - (48 * height) / 720), (text) =>
        measureSubtitleLine(ctx, text, letterSpacing)
      );
  const lineWidths = lines.map((line) =>
    vertical
      ? Math.max(font, ...subtitleGlyphs(line).map((glyph) => measureSubtitleLine(ctx, glyph, 0)))
      : measureSubtitleLine(ctx, line, letterSpacing)
  );
  const geometry = vertical
    ? archiveVerticalGeometry(
        lines.map((text, i) => ({ text, width: lineWidths[i] })),
        font,
        letterSpacing,
        ((cue.lineSpacing ?? 0) * height) / 720,
        cue.textAlign
      )
    : undefined;
  const blockWidth = geometry?.width ?? Math.max(...lineWidths);
  const blockHeight = geometry?.height ?? (lines.length - 1) * lineHeight + font;
  const positionHeight = vertical ? blockHeight : lines.length * lineHeight;
  const cx = cue.x !== undefined ? cue.x * width : width / 2;
  const cy =
    cue.y !== undefined
      ? cue.y * height
      : cue.position === "top"
        ? (24 * height) / 720 + positionHeight / 2
        : cue.position === "center"
          ? height / 2
          : height - (24 * height) / 720 - positionHeight / 2;
  return {
    cx,
    cy,
    font,
    lineHeight,
    lines,
    lineWidths,
    letterSpacing,
    vertical,
    glyphs: geometry?.glyphs ?? [],
    blockWidth,
    blockHeight,
    scale,
    scaleX: cue.scaleX ?? 1,
    scaleY: cue.scaleY ?? 1,
    rotation
  };
}

export interface StageTransform {
  scale: number;
  left: number;
  top: number;
}

/** canvas 内容区（去 letterbox）相对其父容器（.watermark-stage，position: relative）的映射。 */
export function stageTransform(canvas: HTMLCanvasElement): StageTransform {
  const bounds = canvas.getBoundingClientRect();
  const stage = canvas.parentElement;
  const parent = stage?.getBoundingClientRect();
  const cw = canvas.width,
    ch = canvas.height;
  const scale = cw && ch ? Math.min(bounds.width / cw, bounds.height / ch) : 1;
  const left = parent ? bounds.left - parent.left + (bounds.width - cw * scale) / 2 : 0;
  const top = parent ? bounds.top - parent.top + (bounds.height - ch * scale) / 2 : 0;
  return { scale, left, top };
}

/** 屏幕 client 坐标 → canvas 内部像素坐标。 */
export function canvasPoint(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number
): { x: number; y: number } | null {
  const stage = canvas.parentElement;
  const parent = stage?.getBoundingClientRect();
  if (!parent || !canvas.width || !canvas.height) return null;
  const { scale, left, top } = stageTransform(canvas);
  return { x: (clientX - parent.left - left) / scale, y: (clientY - parent.top - top) / scale };
}

/** canvas 内部像素坐标 → 父容器（stage）相对坐标，用于 overlay 定位。 */
export function screenPoint(canvas: HTMLCanvasElement, x: number, y: number): { left: number; top: number } | null {
  if (!canvas.width || !canvas.height) return null;
  const { scale, left, top } = stageTransform(canvas);
  return { left: left + x * scale, top: top + y * scale };
}

export interface SubtitleBounds extends SubtitleLayout {
  halfW: number;
  halfH: number;
}

/** 计算字幕旋转/缩放前（局部坐标）的包围盒半宽半高，供命中检测与选中框渲染。 */
export function subtitleBounds(
  cue: ArchiveSubtitle,
  width: number,
  height: number,
  ctx: CanvasRenderingContext2D
): SubtitleBounds {
  const layout = subtitleLayout(cue, width, height, ctx);
  const style = archiveTextAppearance(cue),
    unit = height / 720;
  const outline = cue.outlineWidth === undefined ? 0 : style.outlineWidth * unit;
  const background = style.backgroundOpacity ? style.backgroundPadding * unit : 0;
  const padX = Math.max(outline, background, style.shadowOpacity ? outline + Math.abs(style.shadowX) * unit : 0);
  const padY = Math.max(outline, background, style.shadowOpacity ? outline + Math.abs(style.shadowY) * unit : 0);
  const fancy = archiveFancyTextStyle(cue.decoration);
  return {
    ...layout,
    halfW: layout.blockWidth / 2 + Math.max(padX, (fancy?.paddingX ?? 0) * layout.font),
    halfH: layout.blockHeight / 2 + Math.max(padY, (fancy?.paddingY ?? 0) * layout.font)
  };
}

/** 命中检测：把点反变换到字幕局部坐标后判断是否落在包围盒内，取最上层（后绘制）的字幕。 */
export function hitSubtitle(
  cues: ArchiveSubtitle[],
  x: number,
  y: number,
  width: number,
  height: number,
  ctx: CanvasRenderingContext2D
): ArchiveSubtitle | undefined {
  const pad = 8;
  for (let i = cues.length - 1; i >= 0; i--) {
    const cue = cues[i];
    const bounds = subtitleBounds(cue, width, height, ctx);
    const radians = (-bounds.rotation * Math.PI) / 180;
    const cos = Math.cos(radians),
      sin = Math.sin(radians);
    const dx = x - bounds.cx,
      dy = y - bounds.cy;
    const lx = (dx * cos - dy * sin) / (bounds.scale * bounds.scaleX);
    const ly = (dx * sin + dy * cos) / (bounds.scale * bounds.scaleY);
    if (Math.abs(lx) <= bounds.halfW + pad && Math.abs(ly) <= bounds.halfH + pad) return cue;
  }
  return undefined;
}
