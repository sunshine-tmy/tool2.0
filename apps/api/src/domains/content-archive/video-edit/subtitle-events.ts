import {
  archiveVerticalText,
  archiveVerticalGeometry,
  archiveTextAppearance,
  type ArchiveSubtitle
} from "@toolbox/shared/archive";
import { VideoEditError } from "./renderer";
import { fancySubtitleEvents } from "./fancy-subtitles";
const stamp = (time: number) => {
  const cs = Math.round(time * 100);
  return `${Math.floor(cs / 360000)}:${String(Math.floor(cs / 6000) % 60).padStart(2, "0")}:${String(Math.floor(cs / 100) % 60).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
};
const escape = (text: string) =>
  text.replaceAll("\\", "＼").replaceAll("{", "｛").replaceAll("}", "｝").replace(/\r?\n/g, "\\N");
const round = (value: number) => Number(value.toFixed(4));
const assColor = (hex: string) => `&H${hex.slice(5, 7)}${hex.slice(3, 5)}${hex.slice(1, 3)}&`;
const assAlpha = (opacity: number) =>
  `&H${Math.round((1 - opacity) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase()}&`;

export function subtitleEvents(cue: ArchiveSubtitle, width: number): string[] {
  if (cue.end <= cue.start) throw new VideoEditError("ARCHIVE_SUBTITLE_RANGE", "字幕终点须晚于起点");
  const hex = cue.color.slice(1),
    color = `&H${hex.slice(4, 6)}${hex.slice(2, 4)}${hex.slice(0, 2)}&`;
  const sx = (cue.scale ?? 1) * (cue.scaleX ?? 1),
    sy = (cue.scale ?? 1) * (cue.scaleY ?? 1);
  const style = [`\\fs${cue.fontSize}`, `\\c${color}`];
  const appearance = archiveTextAppearance(cue);
  if (cue.fontFamily) style.push(`\\fn${cue.fontFamily}`);
  if (cue.bold !== undefined) style.push(`\\b${cue.bold ? 1 : 0}`);
  if (cue.italic !== undefined) style.push(`\\i${cue.italic ? 1 : 0}`);
  if (cue.underline !== undefined) style.push(`\\u${cue.underline ? 1 : 0}`);
  if (cue.letterSpacing !== undefined) style.push(`\\fsp${cue.letterSpacing}`);
  if (cue.opacity !== undefined)
    style.push(
      `\\alpha&H${Math.round((1 - cue.opacity) * 255)
        .toString(16)
        .padStart(2, "0")
        .toUpperCase()}&`
    );
  if (cue.rotation) style.push(`\\frz${round(cue.rotation)}`);
  if (sx !== 1 || sy !== 1) style.push(`\\fscx${round(sx * 100)}\\fscy${round(sy * 100)}`);
  if (cue.outlineColor !== undefined) style.push(`\\3c${assColor(appearance.outlineColor)}`);
  if (cue.outlineWidth !== undefined) style.push(`\\bord${appearance.outlineWidth}`);
  if ([cue.shadowColor, cue.shadowOpacity, cue.shadowX, cue.shadowY].some((value) => value !== undefined))
    style.push(
      `\\4c${assColor(appearance.shadowColor)}\\4a${assAlpha((cue.opacity ?? 1) * appearance.shadowOpacity)}\\xshad${appearance.shadowX}\\yshad${appearance.shadowY}`
    );
  const event = (tags: string[], text: string) =>
    `Dialogue: ${1999 - (cue.lane ?? 0)},${stamp(cue.start)},${stamp(cue.end)},Default,,0,0,0,,{${tags.join("")}}${escape(text)}`;
  const layout = cue.textLayout;
  if (layout) {
    if (
      Math.abs(layout.width - width) > 1 ||
      layout.lines
        .map((line) => line.text)
        .join("")
        .replace(/\s/gu, "") !== cue.text.replace(/\s/gu, "")
    )
      throw new VideoEditError("ARCHIVE_SUBTITLE_LAYOUT_STALE", "文本排版已变化，请重新打开编辑器后保存");
    const fancy = fancySubtitleEvents(cue, width, event, (plain) => subtitleEvents(plain, width));
    if (fancy) return fancy;
    const vertical = archiveVerticalText(cue.textAlign);
    const geometry = vertical
      ? archiveVerticalGeometry(layout.lines, cue.fontSize, cue.letterSpacing ?? 0, cue.lineSpacing ?? 0, cue.textAlign)
      : undefined;
    const lineHeight = cue.fontSize * 1.2 + (cue.lineSpacing ?? 0),
      blockWidth = Math.max(...layout.lines.map((line) => line.width));
    const positionHeight = geometry?.height ?? layout.lines.length * lineHeight;
    const cx = (cue.x ?? 0.5) * width;
    const cy =
      cue.y !== undefined
        ? cue.y * 720
        : cue.position === "top"
          ? 24 + positionHeight / 2
          : cue.position === "center"
            ? 360
            : 720 - 24 - positionHeight / 2;
    const radians = (-(cue.rotation ?? 0) * Math.PI) / 180,
      cos = Math.cos(radians),
      sin = Math.sin(radians);
    const background: string[] = [];
    if (appearance.backgroundOpacity > 0) {
      const padding = appearance.backgroundPadding;
      const w = Math.ceil((geometry?.width ?? blockWidth) + padding * 2);
      const h = Math.ceil((geometry?.height ?? (layout.lines.length - 1) * lineHeight + cue.fontSize) + padding * 2);
      background.push(
        event(
          [
            "\\q2",
            "\\an5",
            `\\pos(${round(cx)},${round(cy)})`,
            ...style,
            `\\bord0\\xshad0\\yshad0\\1c${assColor(appearance.backgroundColor)}\\1a${assAlpha((cue.opacity ?? 1) * appearance.backgroundOpacity)}\\p1`
          ],
          `m 0 0 l ${w} 0 ${w} ${h} 0 ${h} 0 0`
        )
      );
    }
    if (geometry)
      return [
        ...background,
        ...geometry.glyphs
          .filter((glyph) => glyph.text.trim())
          .map((glyph) => {
            const x = glyph.x * sx,
              y = glyph.y * sy;
            return event(
              [
                "\\q2",
                "\\an5",
                `\\pos(${round(cx + x * cos - y * sin)},${round(cy + x * sin + y * cos)})`,
                ...style,
                "\\fsp0"
              ],
              glyph.text
            );
          })
      ];
    return [
      ...background,
      ...layout.lines
        .filter((line) => line.text.length > 0)
        .map((line) => {
          const i = layout.lines.indexOf(line);
          const x =
            (cue.textAlign === "left"
              ? (line.width - blockWidth) / 2
              : cue.textAlign === "right"
                ? (blockWidth - line.width) / 2
                : 0) * sx;
          const y = (i - (layout.lines.length - 1) / 2) * lineHeight * sy;
          return event(
            ["\\q2", "\\an5", `\\pos(${round(cx + x * cos - y * sin)},${round(cy + x * sin + y * cos)})`, ...style],
            line.text
          );
        })
    ];
  }
  if (
    (cue.decoration && cue.decoration !== "none") ||
    cue.lineSpacing ||
    appearance.backgroundOpacity > 0 ||
    (cue.textAlign && cue.textAlign !== "center")
  )
    throw new VideoEditError("ARCHIVE_SUBTITLE_LAYOUT_MISSING", "文本排版数据缺失，请重新打开编辑器后保存");
  const positioned = cue.x !== undefined && cue.y !== undefined;
  const alignment = positioned ? 5 : cue.position === "top" ? 8 : cue.position === "center" ? 5 : 2;
  return [
    event(
      [
        `\\an${alignment}`,
        ...(positioned ? [`\\pos(${Math.round(cue.x! * width)},${Math.round(cue.y! * 720)})`] : []),
        ...style
      ],
      cue.text
    )
  ];
}
