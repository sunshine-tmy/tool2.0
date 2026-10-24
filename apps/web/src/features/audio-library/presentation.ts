import type { AudioLibraryItemView } from "@toolbox/shared";
export const languages: Record<string, string> = {
  und: "未指定",
  ms: "马来语",
  en: "英语",
  "pt-BR": "巴西葡萄牙语",
  "zh-CN": "中文"
};
export const languageLabel = (value: string) => languages[value] || value;
export const sourceLabel = (kind: AudioLibraryItemView["source"]["kind"]) =>
  ({ chatterbox: "参考音色克隆", "edge-tts": "在线自然音色", upload: "本地上传", clip: "裁剪音频" })[kind];
export function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("zh-CN", { dateStyle: "short", timeStyle: "short" });
}
export function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds)) return "—";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}
export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KiB`;
  return bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2)} GiB` : `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
}
export function groupOptions(groups: import("@toolbox/shared/audio-library").AudioLibraryGroup[]) {
  const result: Array<{ label: string; value: string }> = [];
  const visit = (parentId: string | null, path: string[]) => {
    for (const group of groups
      .filter((x) => x.parentId === parentId)
      .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))) {
      const names = [...path, group.name];
      result.push({ label: names.join(" / "), value: group.id });
      if (names.length < 3) visit(group.id, names);
    }
  };
  visit(null, []);
  return result;
}
