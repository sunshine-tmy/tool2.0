import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AudioLibraryCatalog, AudioLibraryItem, AudioLibraryPreset } from "@toolbox/shared";
import { createAudioLibraryFixture } from "./helpers/audio-library";
import { mergeAudioLibraryBackup } from "../domains/audio-library/backup-merge";

let context: Awaited<ReturnType<typeof createAudioLibraryFixture>>;
let original: AudioLibraryItem;
beforeEach(async () => {
  context = await createAudioLibraryFixture();
  original = await context.asset("existing", null);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await context.dispose();
});

function item(id: string, patch: Partial<AudioLibraryItem> = {}): AudioLibraryItem {
  return {
    ...structuredClone(original),
    id,
    title: id,
    bytes: Buffer.byteLength(id),
    sha256: "b".repeat(64),
    ...patch
  };
}
function preset(id: string, itemIds: string[], name = id): AudioLibraryPreset {
  return { id, itemIds, name, mode: "list", gap: 1, revision: 7, createdAt: "2026-01-01", updatedAt: "2026-01-02" };
}
async function backup(
  items: AudioLibraryItem[],
  groups: AudioLibraryCatalog["groups"] = [],
  presets: AudioLibraryPreset[] = []
): Promise<AudioLibraryCatalog> {
  return { ...(await context.store.snapshot()), groups, items, presets, pendingDeletes: [] };
}
async function stage(value: AudioLibraryCatalog, omit: string[] = []) {
  const directory = await context.store.staging();
  for (const source of value.items) {
    if (omit.includes(source.id)) continue;
    const file = path.join(directory, "items", source.id, source.fileName);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, Buffer.alloc(source.bytes, 1));
  }
  return directory;
}

it("keeps the merger synchronous and checks capacity after item mapping but before merging presets", async () => {
  const { store, fixture } = context;
  const before = await store.snapshot(),
    draft = structuredClone(before);
  const value = await backup([item("incoming")], [], [preset("queue", ["incoming"])]);
  const additions: Array<{ id: string; directory: string }> = [],
    directory = path.join(fixture.root, "中文 暂存");
  const check = vi.fn((bytes: number) => {
    expect(bytes).toBe(value.items[0].bytes);
    expect(draft.items.map((x) => x.id)).toEqual([original.id, "incoming"]);
    expect(draft.presets).toEqual(before.presets);
    expect(additions).toEqual([{ id: "incoming", directory: path.join(directory, "items", "incoming") }]);
  });
  expect(mergeAudioLibraryBackup(draft, value, directory, additions, check)).toEqual({ added: 1, skipped: 0 });
  expect(check).toHaveBeenCalledTimes(1);
  expect(draft.presets?.[0].itemIds).toEqual(["incoming"]);
  expect(await store.snapshot()).toEqual(before);
  await expect(fs.stat(directory)).rejects.toMatchObject({ code: "ENOENT" });
});

it("reuses complete normalized group paths regardless of backup order, and keeps source metadata independent", async () => {
  const { store } = context;
  const root = await store.group({ name: "ROOT", parentId: null });
  const child = await store.group({ name: "child", parentId: root.id });
  const value = await backup(
    [item("incoming", { groupId: "backup-leaf" })],
    [
      { id: "backup-leaf", name: "Leaf", parentId: "backup-child" },
      { id: "backup-child", name: " ｃｈｉｌｄ ", parentId: "backup-root" },
      { id: "backup-root", name: " root ", parentId: null }
    ]
  );
  const input = structuredClone(value),
    directory = await stage(value);
  expect(await store.restore(value, directory, "restore")).toEqual({ added: 1, skipped: 0 });
  const after = await store.snapshot(),
    leaf = after.groups.find((g) => g.name === "Leaf")!;
  expect(after.libraryId).toBe(value.libraryId);
  expect(after.groups).toEqual([root, child, { id: leaf.id, name: "Leaf", parentId: child.id }]);
  expect(await store.item("incoming")).toMatchObject({ groupId: leaf.id });
  expect(value).toEqual(input);
  expect(await fs.readFile(store.file(original))).toEqual(Buffer.from(original.id));
});

it("skips same-id/same-hash assets without overwriting current metadata or consuming their staged copy", async () => {
  const { store } = context;
  const value = await backup([{ ...original, title: "old-backup", note: "different", deletedAt: "2026-01-02" }]);
  const directory = await stage(value),
    before = await store.snapshot();
  expect(await store.restore(value, directory, "restore")).toEqual({ added: 0, skipped: 1 });
  expect(await store.snapshot()).toEqual({ ...before, revision: before.revision + 1 });
  expect((await fs.stat(path.join(directory, "items", original.id, original.fileName))).size).toBe(original.bytes);
});

it("renames a colliding asset and maps clip lineage and repeated preset entries to the restored identity", async () => {
  const { store } = context;
  const source = item(original.id, { title: "restored-source" });
  const clip = item("clip", {
    source: { kind: "clip", originalItemId: original.id, originalRevision: 1, startSeconds: 0, endSeconds: 1 }
  });
  const value = await backup([source, clip], [], [preset("queue", [source.id, clip.id, source.id])]);
  const input = structuredClone(value);
  expect(await store.restore(value, await stage(value), "restore")).toEqual({ added: 2, skipped: 0 });
  const after = await store.snapshot(),
    restored = after.items.find((x) => x.title === "restored-source")!;
  expect(restored.id).not.toBe(original.id);
  expect(await store.item(clip.id)).toMatchObject({ source: { originalItemId: restored.id, originalRevision: 1 } });
  expect(after.presets?.[0].itemIds).toEqual([restored.id, clip.id, restored.id]);
  expect(await store.item(original.id)).toEqual(original);
  expect(await fs.readFile(store.file(original))).toEqual(Buffer.from(original.id));
  expect(value).toEqual(input);
});

it.each(["existing", "missing"])(
  "keeps orphan clip origin %s from incorrectly linking to an unrelated target item",
  async (originalId) => {
    const { store } = context;
    const clip = item("clip", { source: { kind: "clip", originalItemId: originalId, originalRevision: 1 } });
    const value = await backup([clip], [], [preset("queue", [originalId, clip.id, originalId])]);
    await store.restore(value, await stage(value), "restore");
    const imported = await store.item(clip.id),
      reference = imported.source.originalItemId;
    if (originalId === "existing") expect(reference).not.toBe(original.id);
    else expect(reference).toBe("missing");
    expect((await store.presets())[0].itemIds).toEqual([reference, clip.id, reference]);
    expect(await store.loadPreset("queue")).toMatchObject({ unavailableCount: 2, items: [{ id: clip.id }] });
  }
);

it.each(["non-clip", "no-origin"] as const)(
  "leaves %s source fields under the original mapping rule",
  async (scenario) => {
    const source =
      scenario === "non-clip" ? { kind: "upload" as const, originalItemId: original.id } : { kind: "clip" as const };
    const incoming = item("incoming", { source }),
      value = await backup([incoming]);
    await context.store.restore(value, await stage(value), "restore");
    expect((await context.store.item(incoming.id)).source).toEqual(source);
  }
);

it("retains an identical preset even when the backup carries different revision and timestamps", async () => {
  const { store } = context;
  const saved = await store.savePreset({ name: "Queue", itemIds: [original.id, original.id], mode: "list", gap: 1 });
  const value = await backup([original], [], [{ ...saved, revision: 50, updatedAt: "backup-date" }]);
  expect(await store.restore(value, await stage(value), "restore")).toEqual({ added: 0, skipped: 1 });
  expect(await store.presets()).toEqual([saved]);
});

it.each(["Queue", "x".repeat(80)])(
  "preserves preset ID collisions, suffix numbering and truncation for %j",
  async (name) => {
    const { store } = context;
    const first = await store.savePreset({ name, itemIds: [original.id], mode: "list", gap: 1 });
    const second = await store.savePreset({
      name: `${name.slice(0, 65)}（导入2）`,
      itemIds: [original.id],
      mode: "list",
      gap: 1
    });
    const incoming = { ...first, gap: 2, revision: 10 },
      value = await backup([original], [], [incoming]);
    await store.restore(value, await stage(value), "restore");
    const presets = await store.presets();
    expect(presets).toHaveLength(3);
    expect(presets.slice(0, 2)).toEqual([first, second]);
    expect(presets[2]).toMatchObject({
      name: `${name.slice(0, 65)}（导入3）`,
      gap: 2,
      revision: 10,
      createdAt: incoming.createdAt
    });
    expect([first.id, second.id]).not.toContain(presets[2].id);
  }
);

it("retains old optional presets and ignores backup pending-delete intent instead of deleting target data", async () => {
  const { store } = context;
  const value = await backup([item("incoming")]);
  delete value.presets;
  value.pendingDeletes = [{ id: original.id, bytes: original.bytes }];
  const input = structuredClone(value);
  expect(await store.restore(value, await stage(value), "restore")).toEqual({ added: 1, skipped: 0 });
  const after = await store.snapshot();
  expect(after.presets).toEqual([]);
  expect(after.pendingDeletes).toEqual([]);
  expect(await fs.readFile(store.file(original))).toEqual(Buffer.from(original.id));
  expect(value).toEqual(input);
});

it("keeps trashed imported metadata and unavailable duplicate preset entries without reactivating media", async () => {
  const { store } = context;
  const incoming = item("trashed", {
    deletedAt: "2026-01-02",
    source: { kind: "edge-tts", batchId: "batch", itemId: "segment", attempt: 2 }
  });
  const value = await backup([incoming], [], [preset("queue", [incoming.id, incoming.id])]);
  await store.restore(value, await stage(value), "restore");
  expect(await store.item(incoming.id)).toEqual(incoming);
  expect(await store.loadPreset("queue")).toMatchObject({ unavailableCount: 2, items: [] });
  expect((await fs.stat(store.file(incoming))).size).toBe(incoming.bytes);
});

it("rolls back a partial file move if a later staged file is missing, preserving the current catalog and media", async () => {
  const { store } = context;
  const value = await backup([item("first"), item("missing")]),
    input = structuredClone(value);
  const directory = await stage(value, ["missing"]),
    before = await store.snapshot();
  await expect(store.restore(value, directory, "restore")).rejects.toMatchObject({ code: "ENOENT" });
  expect(await store.snapshot()).toEqual(before);
  expect(JSON.parse(await fs.readFile(path.join(store.root, "library.json"), "utf8"))).toEqual(before);
  expect(await fs.readdir(path.join(store.root, "items"))).toEqual([original.id]);
  expect(await fs.readFile(store.file(original))).toEqual(Buffer.from(original.id));
  expect(value).toEqual(input);
});

it("checks current reservations inside the queued merge rather than capturing usage when restore is requested", async () => {
  const { store } = context;
  const value = await backup([item("incoming")]),
    directory = await stage(value),
    before = await store.snapshot();
  let enter!: () => void, unlock!: () => void;
  const entered = new Promise<void>((resolve) => {
    enter = resolve;
  });
  const held = store.mutate(async () => {
    enter();
    await new Promise<void>((resolve) => {
      unlock = resolve;
    });
  });
  await entered;
  const restoring = store.restore(value, directory, "restore"),
    outcome = restoring.then(
      () => undefined,
      (error: unknown) => error
    );
  store.reserve("late-reservation", store.maxBytes - store.usedBytes);
  unlock();
  try {
    await held;
    expect(await outcome).toMatchObject({
      code: "AUDIO_LIBRARY_QUOTA_EXCEEDED",
      message: "恢复后的音频库超过容量上限",
      status: 413
    });
    expect(await store.snapshot()).toEqual({ ...before, revision: before.revision + 1 });
    expect((await fs.stat(path.join(directory, "items", "incoming", "audio.wav"))).size).toBe(value.items[0].bytes);
  } finally {
    unlock();
    store.release("late-reservation");
    await Promise.allSettled([held, restoring]);
  }
});
