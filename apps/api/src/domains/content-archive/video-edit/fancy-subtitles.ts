import {
  archiveFancyTextStyle,
  archiveFancyFlames,
  archiveFancyPathBounds,
  archiveVerticalGeometry,
  archiveVerticalText,
  type ArchiveSubtitle
} from "@toolbox/shared/archive";
import { VideoEditError } from "./renderer";
type EmitEvent = (tags: string[], text: string) => string;
const round = (value: number) => Number(value.toFixed(4));

export function fancySubtitleEvents(
  cue: ArchiveSubtitle,
  width: number,
  event: EmitEvent,
  textEvents: (cue: ArchiveSubtitle) => string[]
): string[] | undefined {
  const fancy = archiveFancyTextStyle(cue.decoration);
  if (!fancy) return;
  const layout = cue.textLayout;
  if (!layout) throw new VideoEditError("ARCHIVE_SUBTITLE_LAYOUT_MISSING", "文本排版数据缺失，请重新打开编辑器后保存");
  const lines = layout.lines.map((line) => line.text),
    lineWidths = layout.lines.map((line) => line.width);
  const vertical = archiveVerticalText(cue.textAlign),
    font = cue.fontSize,
    lineHeight = font * 1.2 + (cue.lineSpacing ?? 0);
  const geometry = vertical
    ? archiveVerticalGeometry(layout.lines, font, cue.letterSpacing ?? 0, cue.lineSpacing ?? 0, cue.textAlign)
    : undefined;
  const positionHeight = geometry?.height ?? lines.length * lineHeight;
  const cx = (cue.x ?? 0.5) * width,
    cy =
      cue.y !== undefined
        ? cue.y * 720
        : cue.position === "top"
          ? 24 + positionHeight / 2
          : cue.position === "center"
            ? 360
            : 720 - 24 - positionHeight / 2;
  const sx = (cue.scale ?? 1) * (cue.scaleX ?? 1),
    sy = (cue.scale ?? 1) * (cue.scaleY ?? 1);
  const angle = (-(cue.rotation ?? 0) * Math.PI) / 180,
    cos = Math.cos(angle),
    sin = Math.sin(angle);
  const opacity = Math.round((1 - (cue.opacity ?? 1)) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
  const shapes = archiveFancyFlames(
    {
      font,
      lineHeight,
      lines,
      lineWidths,
      blockWidth: Math.max(...lineWidths),
      vertical,
      glyphs: geometry?.glyphs ?? []
    },
    cue.textAlign
  );
  const background = shapes.map((shape) => {
    const bounds = archiveFancyPathBounds(shape.path),
      x = ((bounds.left + bounds.right) / 2) * sx,
      y = ((bounds.top + bounds.bottom) / 2) * sy;
    const color = `&H${shape.color.slice(5, 7)}${shape.color.slice(3, 5)}${shape.color.slice(1, 3)}&`;
    const path = shape.path
      .map(
        (command) =>
          `${command.kind} ${command.points.map((point, i) => Math.round((point - (i % 2 ? bounds.top : bounds.left)) * 8)).join(" ")}`
      )
      .join(" ");
    return event(
      [
        "\\an5",
        `\\pos(${round(cx + x * cos - y * sin)},${round(cy + x * sin + y * cos)})`,
        `\\fscx${round(sx * 100)}\\fscy${round(sy * 100)}\\frz${round(cue.rotation ?? 0)}`,
        `\\bord0\\shad0\\1c${color}\\alpha&H${opacity}&\\p4`
      ],
      path
    );
  });
  const plain = { ...cue, decoration: "none" as const, backgroundOpacity: 0, shadowOpacity: 0, shadowX: 0, shadowY: 0 };
  const layers = fancy.strokes.flatMap((stroke) =>
    textEvents({ ...plain, outlineColor: stroke.color, outlineWidth: round(font * stroke.width) }).map((line) =>
      line.replace("}", "\\1a&HFF&}")
    )
  );
  return [...background, ...layers, ...textEvents({ ...plain, outlineWidth: 0 })];
}
