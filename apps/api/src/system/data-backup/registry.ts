/** Exact ownership, file inventory and portable path encoding; never scan all of storageRoot. */
import path from "node:path";
import fs from "node:fs/promises";
import type { AudioLibraryCatalog, ContentArchiveItem } from "@toolbox/shared";
import { isContentArchiveItem } from "@toolbox/shared";
import type { BackupModuleId } from "@toolbox/shared/system";
import type { AppConfig } from "../../config";
import type { ToolboxDatabase } from "../../database/toolbox-database";
import type { StoredEntity } from "../../database/types";
import { archiveMediaAssets } from "../../domains/content-archive/core/media-assets";
import { readCatalog, validateAudioLibraryCatalog } from "../../domains/audio-library/catalog";
import { safeRelative, ownedPath } from "./package-io";
import type { BackupFile, ModuleData } from "./types";

export const ownership: Record<BackupModuleId, { kinds: string[]; tools: string[] }> = {
  "image-compress": { kinds: [], tools: ["image-compress"] },
  "image-ai": { kinds: ["image-ai-task"], tools: ["image-ai"] },
  speech: {
    kinds: [
      "chatterbox-voice",
      "chatterbox-batch",
      "chatterbox-item",
      "chatterbox-task",
      "edge-tts-task",
      "edge-tts-batch"
    ],
    tools: ["chatterbox", "chatterbox-batch", "edge-tts", "edge-tts-batch"]
  },
  "audio-library": { kinds: ["audio-library-group", "audio-library-item", "audio-library-preset"], tools: [] },
  "content-archive": {
    kinds: [
      "xhs-archive",
      "xhs-media",
      "translation",
      "archive-group",
      "archive-group-member",
      "archive-publication",
      "archive-fetch-task",
      "archive-import-batch",
      "tiktok-profile-job",
      "archive-video-edit-job",
      "archive-watermark-library",
      "archive-watermark-preset"
    ],
    tools: [
      "xhs-archive",
      "media-archive",
      "xhs-translation",
      "media-archive-translation",
      "media-archive-local-upload",
      "media-archive-audio-edit"
    ]
  },
  "lan-transfer": { kinds: ["lan-file", "lan-note"], tools: [] }
};
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("备份领域记录不是对象");
  return value as Record<string, unknown>;
}
export function array(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error("备份领域列表无效");
  return value.map(object);
}
export function text(value: unknown): string {
  if (typeof value !== "string") throw new Error("备份领域字段无效");
  return value;
}
function safeId(value: string) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new Error("备份记录 ID 无效");
  return value;
}
export const keyOf = (module: BackupModuleId, kind: string, id: string) => `${module}/${kind}/${id}`;
function readRecords(database: ToolboxDatabase, id: BackupModuleId) {
  const spec = ownership[id];
  return [
    ...spec.kinds.flatMap((kind) => database.list(kind)),
    ...database.list("task").filter((row) => spec.tools.includes(String(object(row.payload).toolId)))
  ];
}
export function assertOwnedRecord(module: BackupModuleId, row: StoredEntity) {
  safeId(row.id);
  if (
    !ownership[module].kinds.includes(row.kind) &&
    !(row.kind === "task" && ownership[module].tools.includes(String(object(row.payload).toolId)))
  )
    throw new Error("备份记录不属于所选模块");
  const p = object(row.payload);
  if (p.id !== undefined && p.id !== row.id) throw new Error("备份实体身份不一致");
  if (row.kind === "xhs-archive" && !isContentArchiveItem(row.payload)) throw new Error("归档作品不符合约定");
  if (row.kind === "archive-group-member" && !p.groupId) throw new Error("作品分组引用无效");
  if (row.kind === "archive-group-member" && row.status !== p.groupId) throw new Error("作品分组状态不一致");
  if (row.kind === "archive-publication" && p.archiveId !== row.id) throw new Error("发布标记身份不一致");
}
function storagePath(config: AppConfig, filename: string) {
  const relative = path.relative(config.storageRoot, filename).replaceAll("\\", "/");
  return safeRelative(relative);
}
/** Only persisted filesystem fields are encoded. User text and remote source URLs are untouched. */
export function portablePaths(payload: unknown, config: AppConfig, decode = false): unknown {
  const visit = (value: unknown, key = "", parent = ""): unknown => {
    if (Array.isArray(value)) return value.map((v) => visit(v, key, parent));
    if (value && typeof value === "object")
      return Object.fromEntries(Object.entries(object(value)).map(([k, v]) => [k, visit(v, k, key)]));
    const isPath =
      ["path", "maskPath", "outputPath"].includes(key) ||
      (parent === "assets" && ["foreground", "original", "background", "erase", "restore"].includes(key));
    if (typeof value === "string" && isPath) {
      if (decode && value.startsWith("@storage/")) return path.join(config.storageRoot, safeRelative(value.slice(9)));
      if (!decode && path.isAbsolute(value)) return `@storage/${storagePath(config, value)}`;
    }
    return value;
  };
  return visit(payload);
}
const fixedSpeechFiles: Record<string, string[]> = {
  "chatterbox-voice": ["reference.wav"],
  "chatterbox-task": ["reference.wav", "output.wav", "audio.mp3", "subtitle.srt"],
  "chatterbox-batch": ["reference.wav", "combined.mp3", "subtitle.srt", "subtitle.zh-CN.srt", "subtitle.bilingual.srt"],
  "chatterbox-item": ["audio.mp3", "output.wav", "candidate.mp3", "timing.json"],
  "edge-tts-task": ["audio.mp3", "subtitle.srt"],
  "edge-tts-batch": ["combined.mp3", "subtitle.srt", "subtitle.zh-CN.srt", "subtitle.bilingual.srt"]
};
export function speechDirectory(kind: string, id: string, payload: unknown) {
  safeId(id);
  if (kind === "chatterbox-item") return `chatterbox/batches/${safeId(text(object(payload).batchId))}/items/${id}`;
  const dirs: Record<string, string> = {
    "chatterbox-voice": "chatterbox/voices",
    "chatterbox-task": "chatterbox/tasks",
    "chatterbox-batch": "chatterbox/batches",
    "edge-tts-task": "edge-tts/tasks",
    "edge-tts-batch": "edge-tts/batches"
  };
  if (!dirs[kind]) throw new Error("无效配音数据类型");
  return `${dirs[kind]}/${id}`;
}
export async function inventory(database: ToolboxDatabase, config: AppConfig, id: BackupModuleId): Promise<ModuleData> {
  const records = readRecords(database, id).map((row) => ({ ...row, payload: portablePaths(row.payload, config) }));
  for (const row of records) {
    assertOwnedRecord(id, row);
    if (["pending", "running", "queued", "processing", "stopping"].includes(row.status ?? ""))
      throw new Error("所选模块仍有活动任务，请结束任务后再备份");
  }
  const result: ModuleData = { version: 1, id, records, files: [] };
  const byPath = new Map<string, BackupFile>();
  const add = async (
    relative: string,
    kind: string,
    entityId: string,
    required = true,
    expected?: { bytes: number; sha256?: string }
  ) => {
    safeRelative(relative);
    const filename = await ownedPath(config.storageRoot, relative, !required);
    const stat = await fs.stat(filename).catch((error) => {
      if (!required && (error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    });
    if (!stat) return;
    if (!stat.isFile()) throw new Error("受管媒体不是普通文件");
    if (expected && stat.size !== expected.bytes) throw new Error(`受管媒体大小异常：${relative}`);
    const file: BackupFile = {
      path: relative,
      sha256: expected?.sha256 ?? "",
      bytes: stat.size,
      entityKind: kind,
      entityId,
      createdAt:
        records.find((r) => r.kind === kind && r.id === entityId)?.createdAt ?? new Date(stat.birthtimeMs).toISOString()
    };
    const key = relative.toLowerCase();
    if (byPath.has(key) && byPath.get(key)!.path !== relative) throw new Error("受管文件存在大小写冲突");
    byPath.set(key, file);
  };
  // Explicit domain assets also cover historical files missing a metadata index.
  for (const row of records) {
    const p = object(row.payload);
    if (row.kind === "xhs-archive") {
      const item = row.payload as ContentArchiveItem;
      for (const media of item.media)
        for (const asset of archiveMediaAssets(media, false))
          await add(`xhs-archive/items/${row.id}/${safeRelative(asset.fileName)}`, "xhs-media", media.id, true, {
            bytes: asset.size,
            sha256: asset.checksum
          });
    }
    if (row.kind === "archive-watermark-library")
      await add(`xhs-archive/watermark-library/${row.id}.png`, row.kind, row.id, true, {
        bytes: Number(p.size),
        sha256: String(p.checksum)
      });
    if (fixedSpeechFiles[row.kind]) {
      for (const filename of fixedSpeechFiles[row.kind]) {
        const required =
          (row.kind === "chatterbox-voice" && filename === "reference.wav") ||
          (row.status === "completed" &&
            ["edge-tts-task", "chatterbox-task", "chatterbox-item"].includes(row.kind) &&
            filename === "audio.mp3");
        await add(`${speechDirectory(row.kind, row.id, p)}/${filename}`, row.kind, row.id, required);
      }
    }
    if (row.kind === "image-ai-task") {
      const addPath = async (value: unknown, kind: string) => {
        if (typeof value !== "string" || !value.startsWith("@storage/")) throw new Error("AI 图片受管路径无效");
        await add(value.slice(9), kind, row.id);
      };
      for (const input of array(p.inputs)) await addPath(input.path, "image-ai-input");
      if (p.maskPath) await addPath(p.maskPath, "image-ai-mask");
      if (p.assets)
        for (const value of Object.values(object(p.assets))) if (value) await addPath(value, "image-ai-input");
      for (const output of array(p.results)) await addPath(output.outputPath, "image-ai-result");
    }
    if (row.kind === "task" && id === "image-compress" && p.outputPath)
      await add(`outputs/${safeRelative(text(p.outputPath))}`, "image-compress", row.id);
    if (row.kind === "lan-file")
      await add(`lan-transfer/files/${safeRelative(text(p.storedName))}`, row.kind, row.id, true, {
        bytes: Number(p.size)
      });
    if (row.kind === "lan-note")
      for (const image of array(p.images))
        await add(`lan-transfer/notes/images/${safeRelative(text(image.storedName))}`, "lan-note-image", row.id, true, {
          bytes: Number(image.size)
        });
  }
  if (id === "audio-library") {
    const catalogPath = path.join(config.storageRoot, "audio-library", "library.json");
    const raw = await fs.readFile(catalogPath, "utf8").catch((error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT" && !records.length) return undefined;
      throw error;
    });
    const catalog = raw
      ? readCatalog(JSON.parse(raw))
      : ({
          version: 1,
          libraryId: "empty-library",
          revision: 0,
          items: [],
          groups: [],
          presets: [],
          pendingDeletes: []
        } satisfies AudioLibraryCatalog);
    if (!catalog) throw new Error("音频库清单异常，请先修复再备份");
    validateAudioLibraryCatalog(catalog);
    catalog.pendingDeletes = [];
    result.catalog = catalog;
    for (const item of catalog.items)
      await add(
        `audio-library/items/${safeId(item.id)}/${safeRelative(item.fileName)}`,
        "audio-library-item",
        item.id,
        true,
        { bytes: item.bytes, sha256: item.sha256 }
      );
  }
  if (id === "image-compress")
    for (const file of database.listFiles({ entityKind: "image-compress" })) {
      if (!byPath.has(file.relativePath.toLowerCase()))
        await add(file.relativePath, file.entityKind, file.entityId, false, {
          bytes: file.byteSize,
          sha256: file.sha256
        });
    }
  result.files = [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
  return result;
}

/** Destination whitelist is independently derived from the record, not trusted from files.json. */
export function assertFileOwnership(module: ModuleData, file: BackupFile) {
  safeRelative(file.path);
  safeId(file.entityId);
  let valid = false;
  if (module.id === "image-compress")
    valid =
      file.entityKind === "image-compress" &&
      file.path.startsWith(`outputs/${file.entityId}.`) &&
      /^outputs\/[A-Za-z0-9_-]+\.(?:png|jpe?g|webp)$/.test(file.path);
  if (module.id === "image-ai")
    valid =
      ["image-ai-input", "image-ai-mask", "image-ai-result"].includes(file.entityKind) &&
      /^image-ai\/(inputs|outputs)\//.test(file.path) &&
      module.records.some((r) => r.kind === "image-ai-task" && r.id === file.entityId) &&
      file.path.split("/")[2] === file.entityId;
  if (module.id === "speech") {
    const row = module.records.find((r) => r.kind === file.entityKind && r.id === file.entityId);
    valid = Boolean(
      row &&
      fixedSpeechFiles[row.kind]?.some(
        (name) => file.path === `${speechDirectory(row.kind, row.id, row.payload)}/${name}`
      )
    );
  }
  if (module.id === "content-archive") {
    if (file.entityKind === "archive-watermark-library")
      valid =
        module.records.some((r) => r.kind === file.entityKind && r.id === file.entityId) &&
        file.path === `xhs-archive/watermark-library/${file.entityId}.png`;
    if (file.entityKind === "xhs-media")
      valid = module.records.some(
        (r) =>
          r.kind === "xhs-archive" &&
          (r.payload as ContentArchiveItem).media.some(
            (m) =>
              m.id === file.entityId &&
              archiveMediaAssets(m, false).some((f) => file.path === `xhs-archive/items/${r.id}/${f.fileName}`)
          )
      );
  }
  if (module.id === "audio-library")
    valid = Boolean(
      file.entityKind === "audio-library-item" &&
      module.catalog?.items.some(
        (item) => item.id === file.entityId && file.path === `audio-library/items/${item.id}/${item.fileName}`
      )
    );
  if (module.id === "lan-transfer") {
    valid = module.records.some(
      (r) =>
        r.id === file.entityId &&
        ((r.kind === "lan-file" &&
          file.entityKind === "lan-file" &&
          file.path === `lan-transfer/files/${object(r.payload).storedName}`) ||
          (r.kind === "lan-note" &&
            file.entityKind === "lan-note-image" &&
            array(object(r.payload).images).some(
              (image) => file.path === `lan-transfer/notes/images/${image.storedName}`
            )))
    );
  }
  if (!valid) throw new Error("备份文件超出模块所有权范围");
}
