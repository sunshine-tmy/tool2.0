/** 永久音频资产存储：清单、可恢复提交日志及共享 SQLite 镜像；所有变更串行提交。 */
import fs from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import { Value } from "@sinclair/typebox/value";
import {
  AudioLibraryCatalogSchema,
  type AudioLibraryCatalog,
  type AudioLibraryItem,
  type AudioLibraryItemView,
  type AudioLibraryEdit,
  type AudioLibraryPresetInput,
  type AudioLibraryGroup
} from "@toolbox/shared";
import type { ToolboxDatabase } from "../../database/toolbox-database";
import { writeAtomicFile } from "../../storage/file-commit-gateway";

export class AudioLibraryError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400
  ) {
    super(message);
  }
}
export function reject(code: string, message: string, status = 400): never {
  throw new AudioLibraryError(code, message, status);
}
const clone = <T>(value: T): T => structuredClone(value);
const normalized = (value: string) => value.normalize("NFKC").trim().toLocaleLowerCase();
export const validCatalog = (value: unknown): value is AudioLibraryCatalog =>
  Value.Check(AudioLibraryCatalogSchema, value);
/** 仅读取旧清单/备份时移除退役字段，其他未知字段仍交由严格 Schema 拒绝。 */
export function readCatalog(value: unknown): AudioLibraryCatalog | undefined {
  if (!value || typeof value !== "object" || !Array.isArray((value as { items?: unknown }).items)) return undefined;
  const candidate = clone(value) as { items: unknown[]; tags?: unknown };
  const legacyTags = (tags: unknown): tags is string[] =>
    Array.isArray(tags) && tags.every((tag) => typeof tag === "string" && tag.length >= 1 && tag.length <= 30);
  if (Object.hasOwn(candidate, "tags")) {
    if (!legacyTags(candidate.tags)) return undefined;
    delete candidate.tags;
  }
  for (const item of candidate.items) {
    if (item && typeof item === "object" && Object.hasOwn(item, "tags")) {
      const legacy = item as { tags?: unknown };
      if (!legacyTags(legacy.tags) || legacy.tags.length > 20 || new Set(legacy.tags).size !== legacy.tags.length)
        return undefined;
      delete legacy.tags;
    }
    if (item && typeof item === "object" && Object.hasOwn(item, "favorite")) {
      if (typeof (item as { favorite: unknown }).favorite !== "boolean") return undefined;
      delete (item as { favorite?: boolean }).favorite;
    }
  }
  return validCatalog(candidate) ? candidate : undefined;
}

export class AudioLibraryStore {
  private catalog!: AudioLibraryCatalog;
  private initialization?: Promise<void>;
  private tail: Promise<unknown> = Promise.resolve();
  private reservations = new Map<string, number>();
  private undos = new Map<
    string,
    { expires: number; items: Array<{ id: string; groupId: string | null; revision: number }> }
  >();
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
    await fs.mkdir(this.root, { recursive: true });
    const primary = path.join(this.root, "library.json");
    const read = async (name: string) => {
      try {
        const value: unknown = JSON.parse(await fs.readFile(path.join(this.root, name), "utf8"));
        return readCatalog(value);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
        return undefined;
      }
    };
    let catalog = await read("library.json");
    const journal = await read("transaction.json");
    // 日志保留的是提交前清单。未完成提交一律回滚；没有日志时主清单是已确认版本。
    if (journal) {
      catalog = journal;
      await writeAtomicFile(primary, JSON.stringify(journal), nanoid());
    }
    if (!catalog) {
      catalog = await read("library.json.bak");
      if (catalog) {
        await fs.copyFile(primary, path.join(this.root, `library-damaged-${Date.now()}.json`)).catch(() => undefined);
        await writeAtomicFile(primary, JSON.stringify(catalog), nanoid());
      } else {
        const files = await fs.readdir(this.root);
        const previous = this.database.list("audio-library-item");
        if (files.includes("library.json") || files.includes("items") || previous.length)
          reject("AUDIO_LIBRARY_RECOVERY_REQUIRED", "音频库清单异常，请从备份恢复；现有文件已保留", 503);
        catalog = {
          version: 1,
          libraryId: nanoid(),
          revision: 0,
          groups: [],
          items: [],
          presets: [],
          pendingDeletes: []
        };
        await writeAtomicFile(primary, JSON.stringify(catalog), nanoid());
      }
    }
    catalog.presets ??= [];
    this.validate(catalog);
    this.catalog = catalog;
    this.mirror(catalog);
    // 将兼容读取后的清单落盘，SQLite 镜像、后续导出均不再携带退役字段。
    const serialized = JSON.stringify(catalog);
    if ((await fs.readFile(primary, "utf8")) !== serialized) await writeAtomicFile(primary, serialized, nanoid());
    await fs.rm(path.join(this.root, "transaction.json"), { force: true });
    await fs.mkdir(path.join(this.root, "items"), { recursive: true });
    // 启动期间没有活动导入，清理上次意外退出留下的临时副本；永久资产目录不在此范围。
    await fs.rm(path.join(this.root, "staging"), { recursive: true, force: true });
    // 未被任何有效清单引用的文件保留到恢复区，绝不把永久资产当作缓存删除。
    const known = new Set([...catalog.items.map((x) => x.id), ...catalog.pendingDeletes.map((x) => x.id)]);
    for (const entry of await fs.readdir(path.join(this.root, "items"), { withFileTypes: true })) {
      if (!entry.isDirectory() || known.has(entry.name)) continue;
      await fs.mkdir(path.join(this.root, "recovery"), { recursive: true });
      await fs.rename(
        path.join(this.root, "items", entry.name),
        path.join(this.root, "recovery", `${entry.name}-${nanoid(6)}`)
      );
    }
    await this.collectGarbage();
  }
  async snapshot() {
    await this.initialize();
    await this.tail;
    return clone(this.catalog);
  }
  get usedBytes() {
    return (
      this.catalog.items.reduce((sum, item) => sum + item.bytes, 0) +
      this.catalog.pendingDeletes.reduce((sum, item) => sum + item.bytes, 0)
    );
  }
  get reservedBytes() {
    return [...this.reservations.values()].reduce((a, b) => a + b, 0);
  }
  reserve(token: string, bytes: number) {
    if (!Number.isSafeInteger(bytes) || bytes < 0 || this.usedBytes + this.reservedBytes + bytes > this.maxBytes)
      reject("AUDIO_LIBRARY_QUOTA_EXCEEDED", "音频库空间不足，请清理回收站或调整容量", 413);
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
    if (!validCatalog(c)) reject("AUDIO_LIBRARY_INVALID", "音频库数据不符合约定");
    if (
      new Set(c.items.map((x) => x.id)).size !== c.items.length ||
      new Set(c.groups.map((x) => x.id)).size !== c.groups.length
    )
      reject("AUDIO_LIBRARY_INVALID", "音频库标识重复");
    const presets = c.presets ?? [];
    if (
      new Set(presets.map((x) => x.id)).size !== presets.length ||
      new Set(presets.map((x) => normalized(x.name))).size !== presets.length ||
      presets.some((x) => !normalized(x.name))
    )
      reject("AUDIO_LIBRARY_PRESET_DUPLICATE", "预设队列名称不能为空或重复", 409);
    for (const item of c.items)
      if (item.groupId && !c.groups.some((g) => g.id === item.groupId))
        reject("AUDIO_LIBRARY_GROUP_NOT_FOUND", "目标分组不存在", 404);
    const siblingNames = new Set<string>();
    for (const g of c.groups) {
      const key = `${g.parentId ?? ""}:${normalized(g.name)}`;
      if (siblingNames.has(key)) reject("AUDIO_LIBRARY_GROUP_DUPLICATE", "同级分组名称不可重复", 409);
      siblingNames.add(key);
      const seen = new Set([g.id]);
      let parent = g.parentId;
      while (parent) {
        if (seen.has(parent) || seen.size >= 3) reject("AUDIO_LIBRARY_GROUP_DEPTH", "分组最多三级，不能循环嵌套");
        seen.add(parent);
        const node = c.groups.find((x) => x.id === parent);
        if (!node) reject("AUDIO_LIBRARY_GROUP_NOT_FOUND", "父分组不存在", 404);
        parent = node.parentId;
      }
    }
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
      if (this.usedBytes + this.reservedBytes - (this.reservations.get(token) ?? 0) + input.bytes > this.maxBytes)
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
  async group(input: { id?: string; name: string; parentId: string | null }) {
    return this.mutate((c) => {
      const group: AudioLibraryGroup = { id: input.id ?? nanoid(), name: input.name.trim(), parentId: input.parentId };
      const existing = c.groups.findIndex((x) => x.id === group.id);
      if (input.id && existing < 0) reject("AUDIO_LIBRARY_GROUP_NOT_FOUND", "分组不存在", 404);
      if (existing < 0) c.groups.push(group);
      else c.groups[existing] = group;
      return group;
    });
  }
  async removeGroup(id: string) {
    return this.mutate((c) => {
      const ids = new Set([id]);
      for (let i = 0; i < 3; i++) for (const g of c.groups) if (g.parentId && ids.has(g.parentId)) ids.add(g.id);
      c.groups = c.groups.filter((g) => !ids.has(g.id));
      for (const item of c.items)
        if (item.groupId && ids.has(item.groupId)) {
          item.groupId = null;
          item.revision++;
          item.updatedAt = new Date().toISOString();
        }
    });
  }
  async move(ids: string[], groupId: string | null) {
    const undoToken = nanoid();
    await this.mutate((c) => {
      if (groupId && !c.groups.some((g) => g.id === groupId))
        reject("AUDIO_LIBRARY_GROUP_NOT_FOUND", "目标分组不存在", 404);
      const previous = ids.map((id) => {
        const item =
          c.items.find((x) => x.id === id) ?? reject("AUDIO_LIBRARY_NOT_FOUND", "部分素材已不存在，请刷新", 404);
        const old = { id, groupId: item.groupId, revision: item.revision + 1 };
        item.groupId = groupId;
        item.revision++;
        item.updatedAt = new Date().toISOString();
        return old;
      });
      this.undos.set(undoToken, { expires: Date.now() + 15000, items: previous });
    });
    for (const [key, undo] of this.undos) if (undo.expires < Date.now()) this.undos.delete(key);
    return undoToken;
  }
  async undo(token: string) {
    const action = this.undos.get(token);
    if (!action || action.expires < Date.now()) reject("AUDIO_LIBRARY_UNDO_EXPIRED", "撤销已过期", 409);
    await this.mutate((c) => {
      for (const old of action.items) {
        const item = c.items.find((x) => x.id === old.id);
        if (!item || item.revision !== old.revision || (old.groupId && !c.groups.some((g) => g.id === old.groupId)))
          reject("AUDIO_LIBRARY_CONFLICT", "素材或原分组已改变，不能撤销", 409);
        item.groupId = old.groupId;
        item.revision++;
        item.updatedAt = new Date().toISOString();
      }
    });
    this.undos.delete(token);
  }
  async trash(ids: string[], restore = false) {
    await this.mutate((c) => {
      for (const id of ids) {
        const item = c.items.find((x) => x.id === id) ?? reject("AUDIO_LIBRARY_NOT_FOUND", "素材不存在", 404);
        item.deletedAt = restore ? undefined : new Date().toISOString();
        item.revision++;
        item.updatedAt = new Date().toISOString();
      }
    });
  }
  async purge(id: string) {
    await this.mutate((c) => {
      if (this.pins.has(id)) reject("AUDIO_LIBRARY_BUSY", "素材正在导出，请稍后再删除", 409);
      const item = c.items.find((x) => x.id === id);
      if (!item?.deletedAt) reject("AUDIO_LIBRARY_NOT_IN_TRASH", "请先将素材移入回收站");
      c.items = c.items.filter((x) => x.id !== id);
      c.pendingDeletes.push({ id, bytes: item.bytes });
    });
    const cleanup = this.tail.then(() => this.collectGarbage());
    this.tail = cleanup.catch(() => undefined);
    await cleanup;
  }
  private async collectGarbage() {
    for (const entry of [...this.catalog.pendingDeletes]) {
      try {
        await fs.rm(path.join(this.root, "items", entry.id), { recursive: true, force: true });
      } catch {
        continue;
      }
      // 文件已删除，清单即使尚未更新也只会暂时多计空间，重启可再次清理。
      this.catalog.pendingDeletes = this.catalog.pendingDeletes.filter((x) => x.id !== entry.id);
    }
    await writeAtomicFile(path.join(this.root, "library.json"), JSON.stringify(this.catalog), nanoid());
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
    return this.mutate(async (c) => {
      c.presets ??= [];
      const existing = id ? c.presets.find((x) => x.id === id) : undefined;
      if (id && !existing) reject("AUDIO_LIBRARY_PRESET_NOT_FOUND", "预设队列不存在", 404);
      if (existing && input.revision !== existing.revision)
        reject("AUDIO_LIBRARY_CONFLICT", "预设已被修改，请刷新后重试", 409);
      if (!existing && c.presets.length >= 200) reject("AUDIO_LIBRARY_PRESET_LIMIT", "最多保存 200 个预设队列");
      if (!existing || JSON.stringify(input.itemIds) !== JSON.stringify(existing.itemIds)) {
        for (const itemId of new Set(input.itemIds)) {
          const item = c.items.find((x) => x.id === itemId && !x.deletedAt);
          if (!item || !(await this.view(item)).available)
            reject("AUDIO_LIBRARY_PRESET_ITEM_UNAVAILABLE", "队列中有已删除或不可用的音频，请整理后再保存", 409);
        }
      }
      const now = new Date().toISOString();
      const preset = {
        id: id ?? nanoid(),
        name: input.name.trim(),
        itemIds: [...input.itemIds],
        mode: input.mode,
        gap: input.gap,
        revision: (existing?.revision ?? 0) + 1,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      };
      if (existing) c.presets[c.presets.indexOf(existing)] = preset;
      else c.presets.push(preset);
      return clone(preset);
    });
  }
  async deletePreset(id: string, revision: number) {
    await this.mutate((c) => {
      const preset =
        c.presets?.find((x) => x.id === id) ?? reject("AUDIO_LIBRARY_PRESET_NOT_FOUND", "预设队列不存在", 404);
      if (preset.revision !== revision) reject("AUDIO_LIBRARY_CONFLICT", "预设已被修改，请刷新后重试", 409);
      c.presets = c.presets!.filter((x) => x.id !== id);
    });
  }
  async loadPreset(id: string) {
    const c = await this.snapshot(),
      preset = c.presets?.find((x) => x.id === id) ?? reject("AUDIO_LIBRARY_PRESET_NOT_FOUND", "预设队列不存在", 404);
    const available = new Map<string, AudioLibraryItemView>();
    for (const itemId of new Set(preset.itemIds)) {
      const item = c.items.find((x) => x.id === itemId && !x.deletedAt);
      if (item) {
        const view = await this.view(item);
        if (view.available) available.set(itemId, view);
      }
    }
    const items = preset.itemIds.flatMap((itemId) => available.get(itemId) ?? []);
    return { preset, items, unavailableCount: preset.itemIds.length - items.length };
  }
  async restore(backup: AudioLibraryCatalog, directory: string, token: string) {
    this.validate(backup);
    const additions: Array<{ id: string; directory: string }> = [];
    return this.mutate((c) => {
      const groupMap = new Map<string, string>();
      const adopt = (id: string): string => {
        if (groupMap.has(id)) return groupMap.get(id)!;
        const group = backup.groups.find((x) => x.id === id)!;
        const parentId = group.parentId ? adopt(group.parentId) : null;
        let target = c.groups.find((x) => x.parentId === parentId && normalized(x.name) === normalized(group.name));
        if (!target) {
          target = { id: nanoid(), name: group.name, parentId };
          c.groups.push(target);
        }
        groupMap.set(id, target.id);
        return target.id;
      };
      for (const group of backup.groups) adopt(group.id);
      const itemMap = new Map<string, string>();
      let added = 0,
        skipped = 0,
        bytes = 0;
      for (const source of backup.items) {
        if (c.items.some((x) => x.id === source.id && x.sha256 === source.sha256)) {
          itemMap.set(source.id, source.id);
          skipped++;
          continue;
        }
        const item = clone(source);
        if (c.items.some((x) => x.id === item.id)) item.id = nanoid();
        itemMap.set(source.id, item.id);
        item.groupId = source.groupId ? groupMap.get(source.groupId)! : null;
        c.items.push(item);
        bytes += item.bytes;
        added++;
        additions.push({ id: item.id, directory: path.join(directory, "items", source.id) });
      }
      for (const addition of additions) {
        const item = c.items.find((x) => x.id === addition.id)!;
        const originalId = item.source.originalItemId;
        if (item.source.kind !== "clip" || !originalId) continue;
        // 迁移时原素材可能因 ID 冲突而重命名；不把孤立来源错误关联到目标库的同名素材。
        if (!itemMap.has(originalId))
          itemMap.set(originalId, c.items.some((x) => x.id === originalId) ? nanoid() : originalId);
        item.source.originalItemId = itemMap.get(originalId);
      }
      if (this.usedBytes + this.reservedBytes - (this.reservations.get(token) ?? 0) + bytes > this.maxBytes)
        reject("AUDIO_LIBRARY_QUOTA_EXCEEDED", "恢复后的音频库超过容量上限", 413);
      c.presets ??= [];
      for (const source of backup.presets ?? []) {
        const preset = clone(source);
        preset.itemIds = source.itemIds.map((id) => {
          if (!itemMap.has(id)) itemMap.set(id, c.items.some((x) => x.id === id) ? nanoid() : id);
          return itemMap.get(id)!;
        });
        const existing = c.presets.find((x) => x.id === preset.id);
        if (
          existing &&
          existing.name === preset.name &&
          existing.mode === preset.mode &&
          existing.gap === preset.gap &&
          JSON.stringify(existing.itemIds) === JSON.stringify(preset.itemIds)
        )
          continue;
        if (existing) preset.id = nanoid();
        let suffix = 1;
        while (c.presets.some((x) => normalized(x.name) === normalized(preset.name)))
          preset.name = `${source.name.slice(0, 65)}（导入${++suffix}）`;
        c.presets.push(preset);
      }
      return { added, skipped };
    }, additions);
  }
}
