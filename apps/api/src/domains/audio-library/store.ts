/** 永久音频资产存储：清单、可恢复提交日志及共享 SQLite 镜像；所有变更串行提交。 */
import fs from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import type {
  AudioLibraryCatalog,
  AudioLibraryItem,
  AudioLibraryItemView,
  AudioLibraryEdit,
  AudioLibraryPresetInput
} from "@toolbox/shared";
import type { ToolboxDatabase } from "../../database/toolbox-database";
import { writeAtomicFile } from "../../storage/file-commit-gateway";

import { reject } from "./errors";
import {
  upsertAudioLibraryGroup,
  removeAudioLibraryGroup,
  moveAudioLibraryItems,
  undoAudioLibraryMove,
  type AudioLibraryGroupInput,
  type AudioLibraryMoveItem
} from "./groups";
import { saveAudioLibraryPreset, deleteAudioLibraryPreset, loadAudioLibraryPreset } from "./presets";
import { setAudioLibraryTrashState, stageAudioLibraryPurge, collectAudioLibraryGarbage } from "./recycle-bin";
import {
  audioLibraryUsedBytes,
  audioLibraryReservedBytes,
  assertAudioLibraryReservation,
  exceedsAudioLibraryCommitQuota
} from "./quota";
import { validateAudioLibraryCatalog, normalizeAudioLibraryText as normalized } from "./catalog";
import { recoverAudioLibraryCatalog, finalizeAudioLibraryRecovery } from "./startup-recovery";
import { mergeAudioLibraryBackup } from "./backup-merge";
export { readCatalog } from "./catalog";
export { AudioLibraryError, reject } from "./errors";
const clone = <T>(value: T): T => structuredClone(value);

export class AudioLibraryStore {
  private catalog!: AudioLibraryCatalog;
  private initialization?: Promise<void>;
  private tail: Promise<unknown> = Promise.resolve();
  private reservations = new Map<string, number>();
  private undos = new Map<string, { expires: number; items: AudioLibraryMoveItem[] }>();
  private pins = new Map<string, number>();
  readonly root: string;
  constructor(
    readonly storageRoot: string,
    private database: ToolboxDatabase,
    readonly maxBytes: number
  ) {
    this.root = path.join(storageRoot, "audio-library");
  }
  initialize() {
    return (this.initialization ??= this.load());
  }
  private async load() {
    const catalog = await recoverAudioLibraryCatalog(this.root, () => this.database.list("audio-library-item"));
    catalog.presets ??= [];
    this.validate(catalog);
    this.catalog = catalog;
    this.mirror(catalog);
    await finalizeAudioLibraryRecovery(this.root, catalog);
    await this.collectGarbage();
  }
  async snapshot() {
    await this.initialize();
    await this.tail;
    return clone(this.catalog);
  }
  get usedBytes() {
    return audioLibraryUsedBytes(this.catalog);
  }
  get reservedBytes() {
    return audioLibraryReservedBytes(this.reservations);
  }
  reserve(token: string, bytes: number) {
    assertAudioLibraryReservation(bytes, () => this.usedBytes + this.reservedBytes + bytes > this.maxBytes);
    this.reservations.set(token, (this.reservations.get(token) ?? 0) + bytes);
  }
  release(token: string) {
    this.reservations.delete(token);
  }
  async staging() {
    await this.initialize();
    const dir = path.join(this.root, "staging", nanoid());
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }
  file(item: AudioLibraryItem) {
    return path.join(this.root, "items", item.id, item.fileName);
  }
  async view(item: AudioLibraryItem): Promise<AudioLibraryItemView> {
    const stat = await fs.stat(this.file(item)).catch(() => undefined);
    const base = `/api/v1/tools/audio-library/items/${item.id}`;
    return {
      ...clone(item),
      audioUrl: `${base}/audio`,
      available: Boolean(stat?.isFile() && stat.size === item.bytes)
    };
  }
  async item(id: string) {
    return (
      (await this.snapshot()).items.find((x) => x.id === id) ?? reject("AUDIO_LIBRARY_NOT_FOUND", "音频素材不存在", 404)
    );
  }
  async list(query: Record<string, string | undefined>) {
    if (query.view && !["all", "ungrouped", "incomplete", "trash"].includes(query.view))
      reject("AUDIO_LIBRARY_VIEW_INVALID", "不支持的音频筛选类型");
    const c = await this.snapshot();
    const descendants = new Set<string>(query.groupId ? [query.groupId] : []);
    for (let i = 0; i < 3; i++)
      for (const group of c.groups) if (group.parentId && descendants.has(group.parentId)) descendants.add(group.id);
    const keyword = normalized(query.keyword ?? "");
    const items = c.items.filter((item) => {
      if ((query.view === "trash") !== Boolean(item.deletedAt)) return false;
      if (query.view === "ungrouped" && item.groupId !== null) return false;
      if (query.view === "incomplete" && item.foreignText.trim() && item.chineseText.trim()) return false;
      if (query.groupId && (!item.groupId || !descendants.has(item.groupId))) return false;
      return (
        (!query.language || item.language === query.language) &&
        (!query.source || item.source.kind === query.source) &&
        (!keyword ||
          normalized([item.title, item.foreignText, item.chineseText, item.note].join("\n")).includes(keyword))
      );
    });
    items.sort((a, b) =>
      query.sort === "title"
        ? a.title.localeCompare(b.title, "zh-CN")
        : query.sort === "duration"
          ? a.duration - b.duration
          : b.createdAt.localeCompare(a.createdAt)
    );
    const integer = (value: string | undefined, fallback: number, max: number) => {
      const number = Number(value);
      return Number.isSafeInteger(number) && number > 0 ? Math.min(max, number) : fallback;
    };
    const page = integer(query.page, 1, Number.MAX_SAFE_INTEGER),
      pageSize = integer(query.pageSize, 20, 100);
    return {
      libraryId: c.libraryId,
      revision: c.revision,
      groups: c.groups,
      items: await Promise.all(items.slice((page - 1) * pageSize, page * pageSize).map((x) => this.view(x))),
      total: items.length,
      page,
      pageSize,
      usedBytes: this.usedBytes,
      reservedBytes: this.reservedBytes,
      maxBytes: this.maxBytes,
      totalItems: c.items.filter((x) => !x.deletedAt).length
    };
  }
  private validate(c: AudioLibraryCatalog) {
    validateAudioLibraryCatalog(c);
  }
  private mirror(c: AudioLibraryCatalog) {
    this.database.transaction(() => {
      for (const kind of ["audio-library-item", "audio-library-group", "audio-library-preset"])
        for (const row of this.database.list(kind)) this.database.remove(kind, row.id);
      for (const file of this.database.listFiles({ entityKind: "audio-library-item" }))
        this.database.removeFile(file.id);
      const now = new Date().toISOString();
      for (const preset of c.presets ?? [])
        this.database.upsert({
          id: preset.id,
          kind: "audio-library-preset",
          payload: preset,
          createdAt: preset.createdAt,
          updatedAt: preset.updatedAt
        });
      for (const group of c.groups)
        this.database.upsert({
          id: group.id,
          kind: "audio-library-group",
          payload: group,
          createdAt: now,
          updatedAt: now
        });
      for (const item of c.items) {
        this.database.upsert({
          id: item.id,
          kind: "audio-library-item",
          payload: item,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          status: item.deletedAt ? "trashed" : "active"
        });
        this.database.upsertFile({
          id: `audio-library-${item.id}`,
          entityKind: "audio-library-item",
          entityId: item.id,
          relativePath: path.relative(this.storageRoot, this.file(item)).replaceAll("\\", "/"),
          byteSize: item.bytes,
          sha256: item.sha256,
          mediaType: item.mimeType,
          owner: "local",
          createdAt: item.createdAt
        });
      }
    });
  }
  private async commit(next: AudioLibraryCatalog, additions: Array<{ id: string; directory: string }> = []) {
    next.revision = this.catalog.revision + 1;
    this.validate(next);
    const previous = clone(this.catalog),
      primary = path.join(this.root, "library.json"),
      journal = path.join(this.root, "transaction.json");
    await writeAtomicFile(journal, JSON.stringify(previous), nanoid());
    const moved: string[] = [];
    try {
      for (const entry of additions) {
        const item = next.items.find((x) => x.id === entry.id)!;
        const handle = await fs.open(path.join(entry.directory, item.fileName), "r+");
        try {
          await handle.sync();
        } finally {
          await handle.close();
        }
        const target = path.join(this.root, "items", entry.id);
        await fs.rename(entry.directory, target);
        moved.push(target);
      }
      await writeAtomicFile(path.join(this.root, "library.json.bak"), JSON.stringify(previous), nanoid());
      await writeAtomicFile(primary, JSON.stringify(next), nanoid());
      this.mirror(next);
      await fs.rm(journal, { force: true });
      this.catalog = next;
    } catch (error) {
      // 恢复失败时保留日志；启动会重放旧清单，不能吞掉恢复错误并删除其依据。
      await writeAtomicFile(primary, JSON.stringify(previous), nanoid());
      this.mirror(previous);
      for (const target of moved) await fs.rm(target, { recursive: true, force: true });
      await fs.rm(journal, { force: true });
      throw error;
    }
  }
  async mutate<T>(
    operation: (next: AudioLibraryCatalog) => T | Promise<T>,
    additions: Array<{ id: string; directory: string }> = []
  ) {
    await this.initialize();
    const task = this.tail.then(async () => {
      const next = clone(this.catalog);
      const value = await operation(next);
      await this.commit(next, additions);
      return value;
    });
    this.tail = task.catch(() => undefined);
    return task;
  }
  async add(
    input: Omit<AudioLibraryItem, "id" | "revision" | "createdAt" | "updatedAt">,
    directory: string,
    token: string,
    keepDuplicate = false
  ) {
    await this.initialize();
    let result!: AudioLibraryItem;
    let existing = false;
    const task = this.tail.then(async () => {
      if (input.source.kind === "clip") {
        const source = this.catalog.items.find((x) => x.id === input.source.originalItemId && !x.deletedAt);
        if (!source) reject("AUDIO_LIBRARY_NOT_FOUND", "原音频不存在或已在回收站", 404);
        if (source.revision !== input.source.originalRevision)
          reject("AUDIO_LIBRARY_CONFLICT", "原音频已被修改，请刷新后重新裁剪", 409);
      }
      const duplicate = this.catalog.items.find((x) =>
        input.source.kind === "chatterbox" || input.source.kind === "edge-tts"
          ? x.source.kind === input.source.kind &&
            x.source.batchId === input.source.batchId &&
            x.source.itemId === input.source.itemId &&
            x.source.attempt === input.source.attempt &&
            x.sha256 === input.sha256
          : !keepDuplicate && x.sha256 === input.sha256
      );
      if (duplicate) {
        result = clone(duplicate);
        existing = true;
        return;
      }
      if (
        exceedsAudioLibraryCommitQuota(
          this.usedBytes,
          this.reservedBytes,
          this.reservations.get(token) ?? 0,
          input.bytes,
          this.maxBytes
        )
      )
        reject("AUDIO_LIBRARY_QUOTA_EXCEEDED", "音频库空间不足", 413);
      const now = new Date().toISOString();
      result = { ...input, id: nanoid(), revision: 1, createdAt: now, updatedAt: now };
      const next = clone(this.catalog);
      next.items.push(result);
      await this.commit(next, [{ id: result.id, directory }]);
    });
    this.tail = task.catch(() => undefined);
    await task;
    return { item: await this.view(result), existing };
  }
  async edit(id: string, patch: AudioLibraryEdit) {
    return this.mutate((c) => {
      const item = c.items.find((x) => x.id === id) ?? reject("AUDIO_LIBRARY_NOT_FOUND", "音频素材不存在", 404);
      if (patch.revision !== undefined && patch.revision !== item.revision)
        reject("AUDIO_LIBRARY_CONFLICT", "素材已被修改，请刷新后重试", 409);
      const { revision: _revision, ...fields } = patch;
      Object.assign(item, fields, { updatedAt: new Date().toISOString(), revision: item.revision + 1 });
      return clone(item);
    });
  }
  async group(input: AudioLibraryGroupInput) {
    return this.mutate((c) => upsertAudioLibraryGroup(c, input));
  }
  async removeGroup(id: string) {
    return this.mutate((c) => removeAudioLibraryGroup(c, id));
  }
  async move(ids: string[], groupId: string | null) {
    const undoToken = nanoid();
    await this.mutate((c) => {
      const previous = moveAudioLibraryItems(c, ids, groupId);
      this.undos.set(undoToken, { expires: Date.now() + 15000, items: previous });
    });
    for (const [key, undo] of this.undos) if (undo.expires < Date.now()) this.undos.delete(key);
    return undoToken;
  }
  async undo(token: string) {
    const action = this.undos.get(token);
    if (!action || action.expires < Date.now()) reject("AUDIO_LIBRARY_UNDO_EXPIRED", "撤销已过期", 409);
    await this.mutate((c) => undoAudioLibraryMove(c, action.items));
    this.undos.delete(token);
  }
  async trash(ids: string[], restore = false) {
    await this.mutate((c) => setAudioLibraryTrashState(c, ids, restore));
  }
  async purge(id: string) {
    await this.mutate((c) => stageAudioLibraryPurge(c, id, this.pins.has(id)));
    const cleanup = this.tail.then(() => this.collectGarbage());
    this.tail = cleanup.catch(() => undefined);
    await cleanup;
  }
  private async collectGarbage() {
    return collectAudioLibraryGarbage(this.root, () => this.catalog);
  }
  pin(ids: string[]) {
    for (const id of ids) this.pins.set(id, (this.pins.get(id) ?? 0) + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      for (const id of ids) {
        const count = (this.pins.get(id) ?? 1) - 1;
        if (count) this.pins.set(id, count);
        else this.pins.delete(id);
      }
    };
  }
  async presets() {
    return (await this.snapshot()).presets ?? [];
  }
  async savePreset(input: AudioLibraryPresetInput, id?: string) {
    return this.mutate((c) => saveAudioLibraryPreset(c, input, id, (item) => this.view(item)));
  }
  async deletePreset(id: string, revision: number) {
    await this.mutate((c) => deleteAudioLibraryPreset(c, id, revision));
  }
  async loadPreset(id: string) {
    const c = await this.snapshot();
    return loadAudioLibraryPreset(c, id, (item) => this.view(item));
  }
  async restore(backup: AudioLibraryCatalog, directory: string, token: string) {
    this.validate(backup);
    const additions: Array<{ id: string; directory: string }> = [];
    return this.mutate(
      (c) =>
        mergeAudioLibraryBackup(c, backup, directory, additions, (bytes) => {
          if (
            exceedsAudioLibraryCommitQuota(
              this.usedBytes,
              this.reservedBytes,
              this.reservations.get(token) ?? 0,
              bytes,
              this.maxBytes
            )
          )
            reject("AUDIO_LIBRARY_QUOTA_EXCEEDED", "恢复后的音频库超过容量上限", 413);
        }),
      additions
    );
  }
}
