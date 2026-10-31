/** Scoped reference rewriting. Text, remote identities, timestamps and source URLs never undergo string replacement. */
import type { BackupModuleId } from "@toolbox/shared/system";
import type { StoredEntity } from "../../database/types";
import type { ModuleData, BackupFile } from "./types";
import { object, keyOf } from "./registry";

export type IdMapping = Record<string, string>;
export function mapped(map: IdMapping, module: BackupModuleId, kind: string, id: string) {
  return map[keyOf(module, kind, id)] ?? id;
}
export function taskKind(tool: string) {
  const kinds: Record<string, string> = {
    "image-ai": "image-ai-task",
    "edge-tts": "edge-tts-task",
    "edge-tts-batch": "edge-tts-batch",
    chatterbox: "chatterbox-task",
    "chatterbox-batch": "chatterbox-batch",
    "media-archive": "archive-fetch-task",
    "xhs-archive": "archive-fetch-task",
    "media-archive-audio-edit": "archive-video-edit-job"
  };
  return kinds[tool] ?? "task";
}
export function mapFilePath(file: BackupFile, module: ModuleData, map: IdMapping) {
  const parts = file.path.split("/");
  const m = (kind: string, id: string) => mapped(map, module.id, kind, id);
  if (module.id === "image-compress") parts[1] = parts[1].replace(file.entityId, m("task", file.entityId));
  if (module.id === "image-ai") parts[2] = m("image-ai-task", parts[2]);
  if (module.id === "speech") {
    const kind =
      parts[0] === "edge-tts"
        ? `edge-tts-${parts[1] === "batches" ? "batch" : "task"}`
        : `chatterbox-${parts[1] === "voices" ? "voice" : parts[1] === "batches" ? "batch" : "task"}`;
    parts[2] = m(kind, parts[2]);
    if (parts[3] === "items") parts[4] = m("chatterbox-item", parts[4]);
  }
  if (module.id === "content-archive") {
    if (parts[1] === "items") parts[2] = m("xhs-archive", parts[2]);
    if (parts[1] === "watermark-library") parts[2] = `${m("archive-watermark-library", file.entityId)}.png`;
  }
  if (module.id === "audio-library") parts[2] = m("audio-library-item", parts[2]);
  if (module.id === "lan-transfer") {
    const kind = file.entityKind === "lan-file" ? "lan-file" : "lan-note";
    const target = m(kind, file.entityId);
    if (target !== file.entityId) parts[parts.length - 1] = `${target}-${parts.at(-1)}`;
  }
  return parts.join("/");
}
export function rewriteRecord(row: StoredEntity, module: ModuleData, map: IdMapping): StoredEntity {
  const m = (kind: string, value: unknown) => (typeof value === "string" ? mapped(map, module.id, kind, value) : value);
  const filePaths = new Map(module.files.map((file) => [file.path, mapFilePath(file, module, map)]));
  const recordKind = row.kind;
  const visit = (value: unknown, key = "", context = recordKind, parent = ""): unknown => {
    if (Array.isArray(value)) {
      const childContext =
        key === "items" && context === "chatterbox-batch"
          ? "chatterbox-item"
          : key === "items" && context === "edge-tts-batch"
            ? "edge-tts-entry"
            : key === "media"
              ? "xhs-media"
              : key === "topics"
                ? "remote-topic"
                : key === "works"
                  ? "tiktok-work"
                  : key === "images"
                    ? "lan-note-image"
                    : context;
      return value.map((v) => visit(v, typeof v === "string" ? key : "", childContext, key));
    }
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(object(value)).map(([k, v]) => [
          k,
          visit(v, k, key === "author" ? "remote-author" : context, key)
        ])
      );
    if (typeof value !== "string") return value;
    if (
      value.startsWith("@storage/") &&
      ["path", "maskPath", "outputPath", "foreground", "original", "background", "erase", "restore"].includes(key)
    )
      return `@storage/${filePaths.get(value.slice(9)) ?? value.slice(9)}`;
    if (key === "id") {
      if (
        context === "tiktok-work" ||
        context === "edge-tts-entry" ||
        context === "lan-note-image" ||
        context === "remote-author" ||
        context === "remote-topic"
      )
        return value;
      return m(context, value);
    }
    if (module.id === "content-archive") {
      if (["archiveId", "archive_id", "currentItemId", "itemIds"].includes(key)) return m("xhs-archive", value);
      if (key === "itemId" && context !== "tiktok-work") return m("xhs-archive", value);
      if (key === "groupId") return m("archive-group", value);
      if (key === "taskId") return m("archive-fetch-task", value);
      if (["batchId", "currentBatchId"].includes(key) || key === "batchIds") return m("archive-import-batch", value);
      if (key === "ownerProfileId") return m("tiktok-profile-job", value);
      if (["mediaId", "frameSourceMediaId", "sourceMediaId", "coverMediaId"].includes(key))
        return m("xhs-media", value);
      if (context === "tiktok-profile-job" && parent === "meta" && key === "id") return m("tiktok-profile-job", value);
      if (recordKind === "task" && key === "outputPath") return m("xhs-archive", value);
    }
    if (module.id === "speech") {
      const edge =
        recordKind.startsWith("edge-tts") ||
        (recordKind === "task" && String(object(row.payload).toolId).startsWith("edge-tts"));
      if (key === "batchId") return m(edge ? "edge-tts-batch" : "chatterbox-batch", value);
      if (key === "voiceId") return m("chatterbox-voice", value);
      if (key === "taskId") return m(edge ? "edge-tts-task" : "chatterbox-task", value);
      if (key === "itemId") return m("chatterbox-item", value);
    }
    if (module.id === "image-ai" && key === "taskId") return m("image-ai-task", value);
    if (key === "storedName" && module.id === "lan-transfer") {
      const match = module.files.find((file) => file.entityId === row.id && file.path.endsWith(`/${value}`));
      return match ? mapFilePath(match, module, map).split("/").at(-1) : value;
    }
    if (key.endsWith("Url") && value.startsWith("/api/v1/")) return rewriteUrl(value, module, map);
    if (module.id === "image-compress" && recordKind === "task" && key === "outputPath") {
      const file = module.files.find((file) => file.entityId === row.id);
      return file ? mapFilePath(file, module, map).slice(8) : value;
    }
    return value;
  };
  const rewritten = { ...row, id: mapped(map, module.id, row.kind, row.id), payload: visit(row.payload) };
  if (row.kind === "archive-group-member") {
    rewritten.id = mapped(map, module.id, "xhs-archive", row.id);
    rewritten.status = String(m("archive-group", row.status));
  }
  if (row.kind === "archive-publication") rewritten.id = mapped(map, module.id, "xhs-archive", row.id);
  // Universal task IDs mirror their domain IDs, including aliases and shared-table collisions.
  if (row.kind === "task") {
    const kind = taskKind(String(object(row.payload).toolId));
    rewritten.id = mapped(map, module.id, kind, row.id);
    object(rewritten.payload).id = rewritten.id;
  }
  if (row.kind === "tiktok-profile-job") object(object(rewritten.payload).meta).id = rewritten.id;
  if (row.kind === "xhs-archive")
    for (const media of object(rewritten.payload).media as Array<Record<string, unknown>>) {
      const base = `/api/v1/tools/media-archive/items/${rewritten.id}/media/${media.id}`;
      media.previewUrl = base;
      media.downloadUrl = `${base}?download=1`;
    }
  if (row.kind === "archive-watermark-library")
    object(rewritten.payload).previewUrl = `/api/v1/tools/media-archive/watermark-library/${rewritten.id}/image`;
  return rewritten;
}
function rewriteUrl(url: string, module: ModuleData, map: IdMapping) {
  const match = url.match(/^([^?#]*)([?#].*)?$/)!;
  const parts = match[1].split("/");
  let kind: string | undefined;
  if (parts[4] === "edge-tts" || parts[4] === "chatterbox")
    kind = `${parts[4]}-${parts[5] === "batches" ? "batch" : parts[5] === "voices" ? "voice" : "task"}`;
  if (parts[4] === "image-ai") kind = "image-ai-task";
  if (parts[4] === "xhs-archive" || parts[4] === "media-archive")
    kind = parts[5] === "watermark-library" ? "archive-watermark-library" : "xhs-archive";
  if (kind && parts[6]) parts[6] = mapped(map, module.id, kind, parts[6]);
  if (module.id === "content-archive" && parts[7] === "media" && parts[8])
    parts[8] = mapped(map, module.id, "xhs-media", parts[8]);
  if (module.id === "speech" && parts[4] === "chatterbox" && parts[7] === "items" && parts[8])
    parts[8] = mapped(map, module.id, "chatterbox-item", parts[8]);
  return parts.join("/") + (match[2] ?? "");
}
