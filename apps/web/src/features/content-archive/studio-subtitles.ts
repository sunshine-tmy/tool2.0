import type { ArchiveSubtitle } from "@toolbox/shared/archive";
export function parseStudioSrt(text: string, id: () => string): ArchiveSubtitle[] {
  const cues: ArchiveSubtitle[] = [];
  for (const block of text
    .replace(/^\uFEFF/, "")
    .replaceAll("\r", "")
    .trim()
    .split(/\n\s*\n/)) {
    const lines = block.split("\n");
    const index = lines.findIndex((line) => line.includes("-->"));
    if (index < 0) continue;
    const match = /^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/.exec(
      lines[index].trim()
    );
    if (!match) throw new Error("SRT 时间格式无效");
    const seconds = (offset: number) =>
      Number(match[offset]) * 3600 +
      Number(match[offset + 1]) * 60 +
      Number(match[offset + 2]) +
      Number(match[offset + 3].padEnd(3, "0")) / 1000;
    const start = seconds(1),
      end = seconds(5),
      content = lines
        .slice(index + 1)
        .join("\n")
        .trim();
    if (start >= end || end > 7200 || !content || content.length > 2000)
      throw new Error("字幕文本或时间无效，时间范围最多支持 2 小时");
    cues.push({ id: id(), start, end, text: content, fontSize: 36, color: "#ffffff", position: "bottom" });
    if (cues.length > 2000) throw new Error("字幕最多支持 2000 条");
  }
  if (!cues.length) throw new Error("没有读取到有效字幕");
  return cues;
}
const stamp = (time: number) => {
  const ms = Math.round(time * 1000);
  return `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
};
export const exportStudioSrt = (cues: ArchiveSubtitle[]) =>
  [...cues]
    .sort((a, b) => a.start - b.start)
    .map((cue, i) => `${i + 1}\n${stamp(cue.start)} --> ${stamp(cue.end)}\n${cue.text}`)
    .join("\n\n");
