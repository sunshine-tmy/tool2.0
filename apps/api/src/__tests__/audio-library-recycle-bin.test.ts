import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AudioLibraryStore } from "../domains/audio-library/store";
import { collectAudioLibraryGarbage } from "../domains/audio-library/recycle-bin";
import { createAudioLibraryFixture } from "./helpers/audio-library";

let context: Awaited<ReturnType<typeof createAudioLibraryFixture>>;
beforeEach(async () => {
  context = await createAudioLibraryFixture();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await context.dispose();
});

it("trashes and restores only selected metadata, preserving files, presets and capacity", async () => {
  const { store, asset, database } = context;
  const first = await asset("first", null),
    other = await asset("other", null);
  const preset = await store.savePreset({ name: "permanent", itemIds: [first.id], mode: "list", gap: 1 });
  const used = store.usedBytes;
  vi.spyOn(Date.prototype, "toISOString").mockReturnValue("2026-02-01T00:00:00.000Z");
  await store.trash([first.id]);
  expect(await store.item(first.id)).toEqual({
    ...first,
    deletedAt: "2026-02-01T00:00:00.000Z",
    revision: 2,
    updatedAt: "2026-02-01T00:00:00.000Z"
  });
  expect(database.get("audio-library-item", first.id)?.status).toBe("trashed");
  await store.trash([first.id], true);
  const restored = await store.item(first.id);
  expect(restored).toEqual({ ...first, revision: 3, updatedAt: "2026-02-01T00:00:00.000Z", deletedAt: undefined });
  expect(database.get("audio-library-item", first.id)?.status).toBe("active");
  expect(await store.item(other.id)).toEqual(other);
  expect(await store.presets()).toEqual([preset]);
  expect(store.usedBytes).toBe(used);
  expect(await fs.readFile(store.file(first))).toEqual(Buffer.from(first.id));
});

it.each([false, true])("keeps a partially missing trash batch atomic (restore=%s)", async (restore) => {
  const { store, asset } = context;
  const item = await asset("item", null, restore),
    before = await store.snapshot();
  await expect(store.trash([item.id, "missing"], restore)).rejects.toMatchObject({
    code: "AUDIO_LIBRARY_NOT_FOUND",
    status: 404
  });
  expect(await store.snapshot()).toEqual(before);
  expect(JSON.parse(await fs.readFile(path.join(store.root, "library.json"), "utf8"))).toEqual(before);
  expect(await fs.readFile(store.file(item))).toEqual(Buffer.from(item.id));
});

it("preserves existing empty and repeated trash/restore revision behavior", async () => {
  const { store, asset } = context;
  const item = await asset("item", null),
    before = await store.snapshot();
  await store.trash([]);
  expect((await store.snapshot()).revision).toBe(before.revision + 1);
  await store.trash([item.id]);
  await store.trash([item.id]);
  await store.trash([item.id], true);
  await store.trash([item.id], true);
  expect(await store.item(item.id)).toMatchObject({ revision: 5, deletedAt: undefined });
});

it.each(["active", "missing", "pinned-missing"] as const)(
  "keeps %s purge rejection and original priority",
  async (scenario) => {
    const { store, asset } = context;
    const item = await asset("item", null),
      before = await store.snapshot();
    const id = scenario === "active" ? item.id : "missing";
    const release = store.pin(scenario === "pinned-missing" ? [id] : []);
    try {
      await expect(store.purge(id)).rejects.toMatchObject({
        code: scenario === "pinned-missing" ? "AUDIO_LIBRARY_BUSY" : "AUDIO_LIBRARY_NOT_IN_TRASH",
        status: scenario === "pinned-missing" ? 409 : 400
      });
    } finally {
      release();
    }
    expect(await store.snapshot()).toEqual(before);
    expect(await fs.readFile(store.file(item))).toEqual(Buffer.from(item.id));
  }
);

it("commits the pending marker and removes mirror entries before physically deleting only its target", async () => {
  const { store, asset, database } = context;
  const item = await asset("target", null, true),
    other = await asset("other", null);
  const remove = fs.rm.bind(fs),
    target = path.dirname(store.file(item)),
    order: string[] = [];
  vi.spyOn(fs, "rm").mockImplementation(async (file, options) => {
    if (String(file) === path.join(store.root, "transaction.json")) order.push("journal");
    if (String(file) === target) {
      order.push("asset");
      const persisted = JSON.parse(await fs.readFile(path.join(store.root, "library.json"), "utf8"));
      expect(persisted.items.map((x: { id: string }) => x.id)).not.toContain(item.id);
      expect(persisted.pendingDeletes).toEqual([{ id: item.id, bytes: item.bytes }]);
      expect(database.get("audio-library-item", item.id)).toBeUndefined();
      expect(database.listFiles({ entityKind: "audio-library-item" }).map((x) => x.entityId)).not.toContain(item.id);
    }
    return remove(file, options);
  });
  await store.purge(item.id);
  expect(order).toEqual(["journal", "asset"]);
  expect((await store.snapshot()).pendingDeletes).toEqual([]);
  expect(store.usedBytes).toBe(other.bytes);
  await expect(fs.stat(store.file(item))).rejects.toMatchObject({ code: "ENOENT" });
  expect(await fs.readFile(store.file(other))).toEqual(Buffer.from(other.id));
});

it("does not collect any media when purge commit fails, and can retry through the same queue", async () => {
  const { store, asset, database } = context;
  const item = await asset("target", null, true),
    before = await store.snapshot();
  vi.spyOn(database, "remove").mockImplementationOnce(() => {
    throw new Error("synthetic mirror failure");
  });
  await expect(store.purge(item.id)).rejects.toThrow("synthetic mirror failure");
  expect(await store.snapshot()).toEqual(before);
  expect(await fs.readFile(store.file(item))).toEqual(Buffer.from(item.id));
  expect(database.get("audio-library-item", item.id)?.status).toBe("trashed");
  await store.purge(item.id);
  expect(store.usedBytes).toBe(0);
});

it("retains a locked pending file and its bytes, then collects it on restart without quarantining it", async () => {
  const { store, asset, fixture, database } = context;
  const item = await asset("target", null, true),
    target = path.dirname(store.file(item)),
    remove = fs.rm.bind(fs);
  const spy = vi.spyOn(fs, "rm").mockImplementation(async (file, options) => {
    if (String(file) === target) throw Object.assign(new Error("synthetic locked file"), { code: "EBUSY" });
    return remove(file, options);
  });
  await store.purge(item.id);
  expect((await store.snapshot()).items).toEqual([]);
  expect((await store.snapshot()).pendingDeletes).toEqual([{ id: item.id, bytes: item.bytes }]);
  expect(store.usedBytes).toBe(item.bytes);
  expect(await fs.readFile(store.file(item))).toEqual(Buffer.from(item.id));
  spy.mockRestore();
  const restarted = new AudioLibraryStore(fixture.layout.storageRoot, database, 1024);
  expect((await restarted.snapshot()).pendingDeletes).toEqual([]);
  expect(restarted.usedBytes).toBe(0);
  await expect(fs.stat(target)).rejects.toMatchObject({ code: "ENOENT" });
  await expect(fs.stat(path.join(store.root, "recovery"))).rejects.toMatchObject({ code: "ENOENT" });
});

it("continues collecting other pending files after one file removal fails", async () => {
  const { store, asset } = context;
  const first = await asset("first", null, true),
    second = await asset("second", null, true);
  const remove = fs.rm.bind(fs),
    target = path.dirname(store.file(first));
  vi.spyOn(fs, "rm").mockImplementation(async (file, options) => {
    if (String(file) === target) throw new Error("synthetic locked file");
    return remove(file, options);
  });
  await store.purge(first.id);
  await store.purge(second.id);
  expect((await store.snapshot()).pendingDeletes).toEqual([{ id: first.id, bytes: first.bytes }]);
  expect(store.usedBytes).toBe(first.bytes);
  expect(await fs.readFile(store.file(first))).toEqual(Buffer.from(first.id));
  await expect(fs.stat(store.file(second))).rejects.toMatchObject({ code: "ENOENT" });
});

it("keeps the persisted marker if the final cleanup write fails and converges after restart", async () => {
  const { store, asset, fixture, database } = context;
  const item = await asset("target", null, true),
    target = path.dirname(store.file(item));
  const remove = fs.rm.bind(fs),
    write = fs.writeFile.bind(fs);
  let removed = false;
  vi.spyOn(fs, "rm").mockImplementation(async (file, options) => {
    await remove(file, options);
    if (String(file) === target) removed = true;
  });
  const fail = vi.spyOn(fs, "writeFile").mockImplementation(async (file, data, options) => {
    if (removed && String(file).startsWith(path.join(store.root, ".library.json.staging-")))
      throw new Error("synthetic cleanup write failure");
    return write(file, data, options);
  });
  await expect(store.purge(item.id)).rejects.toThrow("synthetic cleanup write failure");
  expect(removed).toBe(true);
  expect(JSON.parse(await fs.readFile(path.join(store.root, "library.json"), "utf8")).pendingDeletes).toEqual([
    { id: item.id, bytes: item.bytes }
  ]);
  await expect(fs.stat(target)).rejects.toMatchObject({ code: "ENOENT" });
  fail.mockRestore();
  const restarted = new AudioLibraryStore(fixture.layout.storageRoot, database, 1024);
  expect((await restarted.snapshot()).pendingDeletes).toEqual([]);
  expect(restarted.usedBytes).toBe(0);
});

it("reads the current catalog again after awaited removal, without widening its original work list", async () => {
  const { fixture, store } = context;
  const root = path.join(fixture.root, "中文 空格", "cleanup");
  const first = path.join(root, "items", "first"),
    second = path.join(root, "items", "second");
  for (const directory of [first, second]) {
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, "audio.wav"), "fixture");
  }
  const initial = { ...(await store.snapshot()), pendingDeletes: [{ id: "first", bytes: 7 }] };
  const current = {
    ...structuredClone(initial),
    libraryId: "current-library",
    pendingDeletes: [...initial.pendingDeletes, { id: "second", bytes: 7 }]
  };
  let active = initial;
  const remove = fs.rm.bind(fs);
  vi.spyOn(fs, "rm").mockImplementation(async (file, options) => {
    await remove(file, options);
    if (String(file) === first) active = current;
  });
  await collectAudioLibraryGarbage(root, () => active);
  expect(initial.pendingDeletes).toEqual([{ id: "first", bytes: 7 }]);
  expect(current.pendingDeletes).toEqual([{ id: "second", bytes: 7 }]);
  expect(JSON.parse(await fs.readFile(path.join(root, "library.json"), "utf8"))).toEqual(current);
  await expect(fs.stat(first)).rejects.toMatchObject({ code: "ENOENT" });
  expect(await fs.readFile(path.join(second, "audio.wav"), "utf8")).toBe("fixture");
});

it("keeps independent pin reference counts and idempotent releases", async () => {
  const { store, asset } = context;
  const item = await asset("target", null, true);
  const first = store.pin([item.id]),
    second = store.pin([item.id]);
  first();
  first();
  await expect(store.purge(item.id)).rejects.toMatchObject({ code: "AUDIO_LIBRARY_BUSY", status: 409 });
  second();
  second();
  await store.purge(item.id);
  expect(store.usedBytes).toBe(0);
});

it.each([true, false])("checks pin state only inside the queued purge operation (pinned=%s)", async (pinned) => {
  const { store, asset } = context;
  const item = await asset("target", null, true);
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
  const release = store.pin(pinned ? [] : [item.id]);
  const purging = store.purge(item.id);
  const outcome = purging.then(
    () => undefined,
    (error: unknown) => error
  );
  const lateRelease = store.pin(pinned ? [item.id] : []);
  if (!pinned) release();
  unlock();
  try {
    await held;
    if (pinned) expect(await outcome).toMatchObject({ code: "AUDIO_LIBRARY_BUSY", status: 409 });
    else expect(await outcome).toBeUndefined();
  } finally {
    release();
    lateRelease();
    unlock();
    await Promise.allSettled([held, purging]);
  }
});
