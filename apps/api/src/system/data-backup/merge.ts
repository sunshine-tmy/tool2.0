import path from "node:path";
import { hashText } from "./package-io";
import type { BackupMode, BackupModuleId } from "@toolbox/shared/system";
import type { ContentArchiveItem } from "@toolbox/shared";
import type { ToolboxDatabase } from "../../database/toolbox-database";
import type { StoredEntity, FileMetadata } from "../../database/types";
import type { AppConfig } from "../../config";
import type { BackupBundle, ModuleData, RestoreDraft, RestoreChange } from "./types";
import {
  assertOwnedRecord,
  assertFileOwnership,
  keyOf,
  object,
  array,
  portablePaths,
  ownership,
  text
} from "./registry";
import { mapped, mapFilePath, rewriteRecord, taskKind, type IdMapping } from "./references";
import { mergeAudioLibraryBackup } from "../../domains/audio-library/backup-merge";
import { normalizeAudioLibraryText, validateAudioLibraryCatalog } from "../../domains/audio-library/catalog";

export type ImportReceipt = { mappings: IdMapping; targets: Record<string, string> };
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(object(value))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)])
    );
  return value;
}
export const fingerprint = (modules: ModuleData[]) =>
  hashText(
    JSON.stringify(
      canonical(
        modules
          .map((m) => ({
            id: m.id,
            records: [...m.records].sort((a, b) => `${a.kind}/${a.id}`.localeCompare(`${b.kind}/${b.id}`)),
            catalog: m.catalog,
            files: [...m.files].sort((a, b) => a.path.localeCompare(b.path))
          }))
          .sort((a, b) => a.id.localeCompare(b.id))
      )
    )
  );
export function receiptKey(bundle: BackupBundle) {
  return hashText(JSON.stringify([bundle.manifest.id, bundle.manifest.modules]));
}
function rowHash(row: StoredEntity) {
  return hashText(JSON.stringify(canonical(row)));
}
function recordHash(row: StoredEntity, module: ModuleData) {
  const mediaIds = row.kind === "xhs-archive" ? (row.payload as ContentArchiveItem).media.map((m) => m.id) : [];
  const files = module.files
    .filter((f) => f.entityId === row.id || mediaIds.includes(f.entityId))
    .map((f) => ({ path: f.path, sha256: f.sha256, bytes: f.bytes }))
    .sort((a, b) => a.path.localeCompare(b.path));
  return hashText(JSON.stringify([rowHash(row), files]));
}
function entityOwner(file: ModuleData["files"][number], module: ModuleData) {
  if (module.id === "image-ai") return "image-ai-task";
  if (file.entityKind === "image-compress") return "task";
  if (file.entityKind === "lan-note-image") return "lan-note";
  return file.entityKind;
}
/** All planning occurs against immutable snapshots. No FS/DB writes are permitted here. */
export function planRestore(
  bundle: BackupBundle,
  current: ModuleData[],
  mode: BackupMode,
  config: AppConfig,
  database: ToolboxDatabase,
  receipt?: ImportReceipt
): RestoreDraft {
  const map: IdMapping = {};
  const skip = new Set<string>();
  const counts: RestoreDraft["counts"] = new Map();
  const imported = bundle.modules.map((m) => structuredClone(m));
  const currentRows = new Map(
    current.flatMap((module) => module.records.map((row) => [keyOf(module.id, row.kind, row.id), row] as const))
  );
  const reserved = new Set<string>();
  for (const module of imported) {
    counts.set(module.id, { added: 0, skipped: 0, conflicts: 0 });
    for (const row of module.records) {
      assertOwnedRecord(module.id, row);
      reserved.add(keyOf(module.id, row.kind, row.id));
    }
    for (const file of module.files) assertFileOwnership(module, file);
    for (const file of module.files) reserved.add(keyOf(module.id, entityOwner(file, module), file.entityId));
    for (const row of module.records.filter((r) => r.kind === "xhs-archive"))
      for (const media of (row.payload as ContentArchiveItem).media)
        reserved.add(keyOf(module.id, "xhs-media", media.id));
    if (module.id === "audio-library") {
      if (!module.catalog) throw new Error("备份缺少音频库清单");
      validateAudioLibraryCatalog(module.catalog);
    }
  }
  const allocate = (module: BackupModuleId, kind: string, id: string) => {
    for (let n = 0; ; n++) {
      const candidate = hashText(`${receiptKey(bundle)}/${module}/${kind}/${id}/${n}`).slice(0, 12);
      const key = keyOf(module, kind, candidate);
      if (!reserved.has(key) && !database.get(kind, candidate)) {
        reserved.add(key);
        return candidate;
      }
    }
  };
  for (const module of imported)
    if (module.id === "image-compress")
      for (const file of module.files) {
        if (module.records.some((row) => row.kind === "task" && row.id === file.entityId)) continue;
        const target = current.find((m) => m.id === module.id)?.files.find((f) => f.entityId === file.entityId);
        const key = keyOf(module.id, "task", file.entityId);
        const previousId = receipt?.mappings[key];
        const previousFile = previousId
          ? current.find((m) => m.id === module.id)?.files.find((f) => f.entityId === previousId)
          : undefined;
        if (mode === "merge" && previousFile?.sha256 === file.sha256 && previousFile.bytes === file.bytes) {
          map[key] = previousId!;
          skip.add(key);
          continue;
        }
        if (mode === "merge" && target) {
          if (target.sha256 === file.sha256 && target.bytes === file.bytes) {
            map[key] = file.entityId;
            skip.add(key);
          } else {
            map[key] = allocate(module.id, "task", file.entityId);
            counts.get(module.id)!.conflicts++;
          }
        }
        map[key] ??= file.entityId;
      }
  // Mapping is scoped to the entity type; unrelated records with identical IDs are independent.
  for (const module of imported)
    for (const row of module.records) {
      const key = keyOf(module.id, row.kind, row.id);
      const target = receipt?.mappings[key];
      const previous = target ? currentRows.get(keyOf(module.id, row.kind, target)) : undefined;
      if (
        mode === "merge" &&
        previous &&
        receipt?.targets[key] ===
          recordHash(
            previous,
            current.find((m) => m.id === module.id)!
          )
      ) {
        map[key] = target!;
        skip.add(key);
        continue;
      }
      if (row.kind === "archive-group-member" || row.kind === "archive-publication" || row.kind === "xhs-media")
        continue;
      const existing = currentRows.get(key);
      if (
        mode === "merge" &&
        module.id === "audio-library" &&
        row.kind === "audio-library-item" &&
        existing &&
        object(existing.payload).sha256 === object(row.payload).sha256
      ) {
        map[key] = row.id;
        skip.add(key);
        continue;
      }
      if (mode === "merge" && row.kind === "xhs-archive") {
        const p = object(row.payload);
        const same = current
          .find((m) => m.id === module.id)
          ?.records.find(
            (r) =>
              r.kind === row.kind &&
              object(r.payload).platform === p.platform &&
              object(r.payload).contentId === p.contentId
          );
        if (same) {
          map[key] = same.id;
          skip.add(key);
          continue;
        }
      }
      if (mode === "merge" && row.kind === "archive-group") {
        const name = text(object(row.payload).name).trim().toLowerCase();
        const same = current
          .find((m) => m.id === module.id)
          ?.records.find((r) => r.kind === row.kind && text(object(r.payload).name).trim().toLowerCase() === name);
        if (same) {
          map[key] = same.id;
          skip.add(key);
          continue;
        }
      }
      if (mode === "merge" && row.kind === "archive-watermark-library") {
        const same = current
          .find((m) => m.id === module.id)
          ?.records.find((r) => r.kind === row.kind && object(r.payload).checksum === object(row.payload).checksum);
        if (same) {
          map[key] = same.id;
          skip.add(key);
          continue;
        }
      }
      if (mode === "merge" && row.kind === "archive-watermark-preset") {
        const p = object(row.payload);
        const presets = current.find((m) => m.id === module.id)!.records.filter((r) => r.kind === row.kind);
        const same = presets.find(
          (r) => text(object(r.payload).name).trim().toLowerCase() === text(p.name).trim().toLowerCase()
        );
        if (same && JSON.stringify(canonical(object(same.payload).points)) === JSON.stringify(canonical(p.points))) {
          map[key] = same.id;
          skip.add(key);
          continue;
        }
        if (same) {
          const names = new Set(
            [...presets, ...module.records.filter((r) => r.kind === row.kind)].map((r) =>
              text(object(r.payload).name).trim().toLowerCase()
            )
          );
          for (let n = 1; ; n++) {
            const name = `${text(p.name).slice(0, 45)}（导入 ${n}）`;
            if (!names.has(name.toLowerCase())) {
              p.name = name;
              break;
            }
          }
        }
      }
      if (
        mode === "merge" &&
        existing &&
        recordHash(
          existing,
          current.find((m) => m.id === module.id)!
        ) === recordHash(row, module)
      ) {
        map[key] = row.id;
        skip.add(key);
        continue;
      }
      const collides =
        mode === "merge"
          ? Boolean(existing)
          : row.kind === "task" &&
            Boolean(database.get("task", row.id)) &&
            !ownership[module.id].tools.includes(String(object(database.get("task", row.id)!.payload).toolId));
      map[key] = collides ? allocate(module.id, row.kind, row.id) : row.id;
      if (collides) counts.get(module.id)!.conflicts++;
    }
  // Match child media by the stable archived-work parent. Target's edit closure wins together.
  const occupiedMedia = new Set(
    current.flatMap((module) =>
      module.records
        .filter((row) => row.kind === "xhs-archive")
        .flatMap((row) => (row.payload as ContentArchiveItem).media.map((media) => media.id))
    )
  );
  for (const module of imported)
    if (module.id === "content-archive")
      for (const row of module.records.filter((r) => r.kind === "xhs-archive")) {
        const source = row.payload as ContentArchiveItem;
        const targetId = mapped(map, module.id, row.kind, row.id);
        const kept = skip.has(keyOf(module.id, row.kind, row.id));
        const target = currentRows.get(keyOf(module.id, row.kind, targetId))?.payload as ContentArchiveItem | undefined;
        for (const media of source.media) {
          const key = keyOf(module.id, "xhs-media", media.id);
          map[key] = kept
            ? (target?.media.find((m) => m.id === media.id)?.id ?? media.id)
            : (mode === "merge" && occupiedMedia.has(media.id)) || database.get("xhs-media", media.id)
              ? allocate(module.id, "xhs-media", media.id)
              : media.id;
          if (kept) skip.add(key);
        }
        if (kept)
          for (const kind of ["archive-publication", "archive-group-member"]) skip.add(keyOf(module.id, kind, row.id));
      }
  // A task and its domain representation must share one ID; global task table collisions take precedence.
  const projectionKinds = new Set([
    "image-ai-task",
    "edge-tts-task",
    "chatterbox-task",
    "chatterbox-batch",
    "archive-fetch-task",
    "archive-video-edit-job"
  ]);
  for (const module of imported)
    for (const row of module.records.filter((r) => projectionKinds.has(r.kind))) {
      const task = database.get("task", row.id);
      if (task && !ownership[module.id].tools.includes(String(object(task.payload).toolId))) {
        const key = keyOf(module.id, row.kind, row.id);
        if (map[key] === row.id) {
          map[key] = allocate(module.id, row.kind, row.id);
          counts.get(module.id)!.conflicts++;
        }
      }
    }
  for (const module of imported)
    for (const row of module.records.filter((r) => r.kind === "task")) {
      const kind = taskKind(String(object(row.payload).toolId));
      if (kind !== "task") {
        const k = keyOf(module.id, kind, row.id),
          t = keyOf(module.id, "task", row.id);
        const mappedDomain = map[k];
        if (mappedDomain && mappedDomain !== row.id) map[t] = mappedDomain;
        else if (map[t] && map[t] !== row.id) map[k] = map[t];
        else if (mappedDomain) map[t] = mappedDomain;
      }
    }
  const files: RestoreChange[] = [],
    metadata: FileMetadata[] = [],
    removeFiles: string[] = [],
    output: ModuleData[] = [];
  for (const module of imported)
    if (module.id === "audio-library")
      mergeAudio(
        module,
        current.find((m) => m.id === module.id)!,
        mode,
        map,
        skip,
        config
      );
  for (const module of imported) {
    const target = current.find((m) => m.id === module.id)!;
    if (mode === "replace") removeFiles.push(...target.files.map((f) => f.path));
    const addedRows =
      module.id === "audio-library"
        ? module.records
        : module.records
            .filter((row) => !skip.has(keyOf(module.id, row.kind, row.id)))
            .map((row) => rewriteRecord(row, module, map));
    const activeRecords =
      mode === "replace" || module.id === "audio-library" ? addedRows : [...target.records, ...addedRows];
    // One canonical key per kind; audio mirror and relational projections replace only their own draft keys.
    // Saved copies remain independent. Weak provenance must not select an unrelated target music item.
    if (module.id === "audio-library")
      for (const source of bundle.modules.find((m) => m.id === module.id)?.catalog?.items ?? []) {
        if (mode === "merge" && skip.has(keyOf(module.id, "audio-library-item", source.id))) continue;
        const item = module.catalog?.items.find(
          (item) => item.id === mapped(map, module.id, "audio-library-item", source.id)
        );
        if (!item?.source.batchId || !["chatterbox", "edge-tts"].includes(item.source.kind)) continue;
        const kind = `${item.source.kind}-batch`,
          reference = keyOf("speech", kind, item.source.batchId);
        if (map[reference]) {
          item.source.batchId = map[reference];
          if (item.source.kind === "chatterbox" && item.source.itemId)
            item.source.itemId = mapped(map, "speech", "chatterbox-item", item.source.itemId);
        } else if (database.get(kind, item.source.batchId)) {
          delete item.source.batchId;
          delete item.source.itemId;
        }
      }
    for (const row of addedRows)
      if (row.kind === "xhs-archive")
        for (const media of (row.payload as ContentArchiveItem).media) {
          const music = media.audioEdit?.music;
          if (!music?.libraryItemId) continue;
          const sourceKey = keyOf("audio-library", "audio-library-item", music.libraryItemId);
          if (map[sourceKey]) music.libraryItemId = map[sourceKey];
          else {
            const targetMusic = database.get("audio-library-item", music.libraryItemId)?.payload as
              { sha256?: string } | undefined;
            if (targetMusic?.sha256 !== music.checksum) {
              delete music.libraryItemId;
              delete music.libraryRevision;
            }
          }
        }
    const dedup = new Map(activeRecords.map((row) => [`${row.kind}/${row.id}`, row]));
    const next: ModuleData = { ...module, records: [...dedup.values()], files: [], catalog: module.catalog };
    for (const file of module.files) {
      const kind = entityOwner(file, module),
        key = keyOf(module.id, kind, file.entityId);
      if (mode === "merge" && skip.has(key)) continue;
      const relative = mapFilePath(file, module, map),
        entityId = mapped(map, module.id, kind, file.entityId);
      if (mode === "merge" && target.files.some((f) => f.path.toLowerCase() === relative.toLowerCase()))
        throw new Error("恢复文件与已有素材路径冲突，请使用替换或整理现有素材");
      const collision = database.listFiles().find((f) => f.relativePath.toLowerCase() === relative.toLowerCase());
      if (mode === "merge" && collision && !target.files.some((f) => f.path === collision.relativePath))
        throw new Error("恢复文件与其他模块冲突");
      files.push({ path: relative, source: path.join(bundle.directory, "objects", file.sha256) });
      next.files.push({ ...file, path: relative, entityId });
      metadata.push({
        id: hashText(`${file.entityKind}\0${entityId}\0${relative}`),
        entityKind: file.entityKind,
        entityId,
        relativePath: relative,
        byteSize: file.bytes,
        sha256: file.sha256,
        mediaType: file.mediaType,
        createdAt: file.createdAt,
        owner: module.id === "lan-transfer" ? "lan" : "local"
      });
    }
    if (mode === "merge") next.files.push(...target.files);
    // Manifests are derived after IDs and paths have been rewritten, never copied stale from the source.
    for (const row of next.records) {
      if (mode === "merge" && !addedRows.includes(row)) continue;
      let filename: string | undefined;
      if (row.kind === "xhs-archive") filename = `xhs-archive/items/${row.id}/manifest.json`;
      if (["chatterbox-voice", "chatterbox-batch", "chatterbox-task", "edge-tts-task"].includes(row.kind)) {
        const engine = row.kind.startsWith("edge") ? "edge-tts" : "chatterbox";
        const group = row.kind.endsWith("voice") ? "voices" : row.kind.endsWith("batch") ? "batches" : "tasks";
        filename = `${engine}/${group}/${row.id}/meta.json`;
      }
      if (filename) files.push({ path: filename, content: JSON.stringify(portablePaths(row.payload, config, true)) });
    }
    if (module.id === "audio-library")
      for (const name of ["library.json", "library.json.bak"])
        files.push({ path: `audio-library/${name}`, content: JSON.stringify(module.catalog) });
    const count = counts.get(module.id)!;
    count.added =
      module.id === "audio-library"
        ? addedRows.filter((row) => !target.records.some((r) => r.kind === row.kind && r.id === row.id)).length
        : addedRows.length;
    count.skipped =
      module.id === "audio-library"
        ? Math.max(0, module.records.length - count.added)
        : module.records.length - addedRows.length;
    validateReferences(next, config);
    output.push(next);
  }
  for (const module of output)
    for (const file of module.files) {
      if (metadata.some((m) => m.relativePath === file.path)) continue;
      const original = database.listFiles().find((m) => m.relativePath === file.path);
      metadata.push(
        original ?? {
          id: hashText(`${file.entityKind}\0${file.entityId}\0${file.path}`),
          entityKind: file.entityKind,
          entityId: file.entityId,
          relativePath: file.path,
          byteSize: file.bytes,
          sha256: file.sha256,
          createdAt: file.createdAt,
          mediaType: file.mediaType,
          owner: module.id === "lan-transfer" ? "lan" : "local"
        }
      );
    }
  const selected = new Set(output.map((module) => module.id));
  const remaining = Object.entries(ownership).filter(([id]) => !selected.has(id as BackupModuleId));
  const unselectedTools = new Set(remaining.flatMap(([, spec]) => spec.tools));
  const unselectedTasks = database
    .list("task")
    .filter((row) => unselectedTools.has(String(object(row.payload).toolId)));
  const projected = new Set([
    ...unselectedTasks.map((row) => row.id),
    ...output.flatMap((module) =>
      module.records.filter((row) => row.kind === "task" || projectionKinds.has(row.kind)).map((row) => row.id)
    ),
    ...remaining.flatMap(([, spec]) =>
      spec.kinds.filter((kind) => projectionKinds.has(kind)).flatMap((kind) => database.list(kind).map((row) => row.id))
    )
  ]);
  if (unselectedTasks.length && projected.size > 1000)
    throw new Error(
      "启动后的公共任务进度预计超过 1000 条，可能影响未选模块记录；请扩大所选模块范围或先备份整理历史，现有业务数据未修改"
    );
  return {
    mode,
    modules: output,
    files,
    removeFiles,
    counts,
    mappings: map,
    fingerprint: fingerprint(current),
    metadata
  };
}

function mergeAudio(
  module: ModuleData,
  target: ModuleData,
  mode: BackupMode,
  map: IdMapping,
  skip: Set<string>,
  config: AppConfig
) {
  const source = module.catalog!,
    previous = structuredClone(target.catalog!);
  const additions: Array<{ id: string; directory: string }> = [];
  const incoming = structuredClone(source);
  const m = (kind: string, id: string) => mapped(map, module.id, kind, id);
  for (const item of incoming.items) {
    item.id = m("audio-library-item", item.id);
    if (item.source.kind === "clip" && item.source.originalItemId)
      item.source.originalItemId = m("audio-library-item", item.source.originalItemId);
  }
  // Receipts cover prior renamed presets as well as files. Do not create another suffix on re-import.
  incoming.presets = incoming.presets?.filter((p) => {
    if (!skip.has(keyOf(module.id, "audio-library-preset", p.id))) return true;
    const existing = previous.presets?.find((item) => item.id === m("audio-library-preset", p.id));
    return (
      !existing ||
      JSON.stringify(existing.itemIds) !== JSON.stringify(p.itemIds.map((id) => m("audio-library-item", id)))
    );
  });
  for (const preset of incoming.presets ?? []) preset.itemIds = preset.itemIds.map((id) => m("audio-library-item", id));
  incoming.items.forEach((item) => {
    const original = source.items.find((x) => m("audio-library-item", x.id) === item.id)!;
    if (original.groupId) item.groupId = original.groupId;
  });
  if (mode === "merge") {
    mergeAudioLibraryBackup(previous, incoming, "backup", additions, () => {
      if (previous.items.reduce((n, item) => n + item.bytes, 0) > config.audioLibraryMaxStorageBytes)
        throw new Error("导入将超出音频素材库配额");
    });
    const adopt = (id: string): string => {
      const group = source.groups.find((g) => g.id === id)!;
      const parent = group.parentId ? adopt(group.parentId) : null;
      return previous.groups.find(
        (g) => g.parentId === parent && normalizeAudioLibraryText(g.name) === normalizeAudioLibraryText(group.name)
      )!.id;
    };
    for (const group of source.groups) map[keyOf(module.id, "audio-library-group", group.id)] = adopt(group.id);
    for (const item of source.items) {
      const incomingId = m("audio-library-item", item.id),
        addition = additions.find((a) => a.directory === path.join("backup", "items", incomingId));
      const key = keyOf(module.id, "audio-library-item", item.id);
      if (addition) {
        map[key] = addition.id;
        skip.delete(key);
      } else {
        map[key] = incomingId;
        skip.add(key);
      }
    }
    const newPresets = previous.presets?.slice(target.catalog!.presets?.length ?? 0) ?? [];
    incoming.presets?.forEach((preset, index) => {
      const match = newPresets.find((p) => p.id === preset.id) || newPresets[index];
      if (match) map[keyOf(module.id, "audio-library-preset", preset.id)] = match.id;
    });
    previous.revision++;
    module.catalog = previous;
  }
  validateAudioLibraryCatalog(module.catalog!);
  // A canonical library catalog is authoritative; SQLite is rebuilt from exactly this catalog.
  const now = new Date().toISOString();
  const c = module.catalog!;
  module.records = [
    ...c.groups.map((payload) => ({
      kind: "audio-library-group",
      id: payload.id,
      payload,
      createdAt: now,
      updatedAt: now
    })),
    ...c.items.map((payload) => ({
      kind: "audio-library-item",
      id: payload.id,
      payload,
      status: payload.deletedAt ? "trashed" : "active",
      createdAt: payload.createdAt,
      updatedAt: payload.updatedAt
    })),
    ...(c.presets ?? []).map((payload) => ({
      kind: "audio-library-preset",
      id: payload.id,
      payload,
      createdAt: payload.createdAt,
      updatedAt: payload.updatedAt
    }))
  ];
  // These records already use final IDs. File mappings still use original IDs.
  // Final catalog records are already rewritten; do not overwrite original-ID mappings here.
}
function validateReferences(module: ModuleData, config: AppConfig) {
  const has = (kind: string, id: unknown) =>
    typeof id === "string" && module.records.some((r) => r.kind === kind && r.id === id);
  for (const row of module.records) {
    assertOwnedRecord(module.id, row);
    const p = object(row.payload);
    if (row.kind === "archive-group-member" && (!has("archive-group", p.groupId) || !has("xhs-archive", row.id)))
      throw new Error("作品分组强引用缺失");
    if (row.kind === "archive-publication" && !has("xhs-archive", row.id)) throw new Error("发布标记归档缺失");
    if (["xhs-media", "translation"].includes(row.kind) && !has("xhs-archive", p.archiveId ?? p.archive_id))
      throw new Error("归档媒体或译文缺少所属作品");
    if (row.kind === "chatterbox-batch" && p.voiceId && !has("chatterbox-voice", p.voiceId))
      throw new Error("参考音色强引用缺失");
    if (row.kind === "chatterbox-item" && !has("chatterbox-batch", p.batchId)) throw new Error("配音片段缺少批次");
    if (row.kind === "edge-tts-batch" && array(p.items).some((item) => !has("edge-tts-task", item.taskId)))
      throw new Error("在线配音批次缺少任务");
  }
  const bytes = module.files.reduce((n, f) => n + f.bytes, 0);
  if (module.id === "content-archive") {
    if (bytes > config.xhsArchiveMaxStorageBytes) throw new Error("导入将超出多媒体归档配额");
    if (
      module.files
        .filter((file) => file.entityKind === "archive-watermark-library")
        .reduce((sum, file) => sum + file.bytes, 0) >
      256 * 1024 ** 2
    )
      throw new Error("导入将超出水印库 256 MiB 配额");
    for (const kind of ["archive-group", "archive-watermark-library", "archive-watermark-preset"])
      if (module.records.filter((r) => r.kind === kind).length > 200)
        throw new Error("导入将超出分组、水印库或轨迹预设数量限制");
  }
  if (module.id === "lan-transfer" && bytes > config.lanTransferMaxStorageBytes)
    throw new Error("导入将超出局域网存储配额");
}
export function makeReceipt(bundle: BackupBundle, draft: RestoreDraft): ImportReceipt {
  const targets: Record<string, string> = {};
  for (const module of bundle.modules)
    for (const row of module.records) {
      const key = keyOf(module.id, row.kind, row.id),
        id = draft.mappings[key] ?? row.id;
      const target = draft.modules
        .find((m) => m.id === module.id)
        ?.records.find((r) => r.kind === row.kind && r.id === id);
      if (target)
        targets[key] = recordHash(
          target,
          draft.modules.find((m) => m.id === module.id)!
        );
    }
  return { mappings: draft.mappings, targets };
}
