/** 上传时仅要求音频；可编辑信息逐文件保存，空值由服务端补上安全默认值。 */
export type AudioUploadDraft = {
  file: File;
  title: string;
  purpose: "general" | "speech" | "music";
  language: string | null;
  groupId: string | null;
  foreignText: string;
  chineseText: string;
  note: string;
  message: string;
  done: boolean;
  failed: boolean;
  duplicate: boolean;
};
export function createUploadDraft(
  file: File,
  defaults: { language?: string | null; groupId?: string | null; purpose?: "general" | "speech" | "music" } = {}
): AudioUploadDraft {
  return {
    file,
    title: "",
    purpose: defaults.purpose ?? "general",
    language: defaults.language || null,
    groupId: defaults.groupId || null,
    foreignText: "",
    chineseText: "",
    note: "",
    message: "等待上传",
    done: false,
    failed: false,
    duplicate: false
  };
}
export function uploadFields(entry: AudioUploadDraft, keepDuplicate = false): Record<string, string> {
  return {
    title: entry.title,
    purpose: entry.purpose,
    language: entry.language || "",
    foreignText: entry.foreignText,
    chineseText: entry.chineseText,
    note: entry.note,
    groupId: entry.groupId || "null",
    keepDuplicate: String(keepDuplicate)
  };
}
