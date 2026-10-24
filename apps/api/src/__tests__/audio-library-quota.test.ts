import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AudioLibraryStore } from "../domains/audio-library/store";
import { createAudioLibraryFixture } from "./helpers/audio-library";

let context: Awaited<ReturnType<typeof createAudioLibraryFixture>>;
beforeEach(async () => {
  context = await createAudioLibraryFixture();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await context.dispose();
});

it.each([-1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, Number.MIN_VALUE])(
  "rejects invalid reservation %s before reading an uninitialized catalog",
  async (bytes) => {
    const root = path.join(context.fixture.root, "uninitialized");
    const store = new AudioLibraryStore(root, context.database, 1024);
    expect(() => store.reserve("invalid", bytes)).toThrow(
      expect.objectContaining({ code: "AUDIO_LIBRARY_QUOTA_EXCEEDED", status: 413 })
    );
    expect(store.reservedBytes).toBe(0);
    await expect(fs.stat(root)).rejects.toMatchObject({ code: "ENOENT" });
  }
);

it("preserves the existing initialized-state requirement for a valid positive reservation", () => {
  const store = new AudioLibraryStore(path.join(context.fixture.root, "uninitialized"), context.database, 1024);
  expect(() => store.reserve("valid", 1)).toThrow(TypeError);
  expect(store.reservedBytes).toBe(0);
});

it("counts active, trashed and pending bytes together without counting metadata or presets", async () => {
  const { store, asset } = context;
  const active = await asset("active", null),
    trash = await asset("trash", null, true);
  await store.savePreset({ name: "queue", itemIds: [active.id], mode: "list", gap: 1 });
  await store.mutate((c) => c.pendingDeletes.push({ id: "pending", bytes: 11 }));
  expect(store.usedBytes).toBe(active.bytes + trash.bytes + 11);
  expect(store.reservedBytes).toBe(0);
  const before = await store.snapshot();
  store.reserve("one", 10);
  store.reserve("one", 20);
  store.reserve("two", 5);
  expect(store.reservedBytes).toBe(35);
  expect(store.usedBytes).toBe(active.bytes + trash.bytes + 11);
  store.release("one");
  store.release("one");
  store.release("missing");
  expect(store.reservedBytes).toBe(5);
  store.release("two");
  expect(store.reservedBytes).toBe(0);
  expect(await store.snapshot()).toEqual(before);
});

it("permits exact-capacity and zero reservations but does not mutate tokens on overflow", async () => {
  const { store, asset } = context;
  await asset("item", null);
  const before = await store.snapshot(),
    remaining = store.maxBytes - store.usedBytes;
  store.reserve("full", remaining);
  store.reserve("zero", 0);
  store.reserve("minus-zero", -0);
  expect(store.reservedBytes).toBe(remaining);
  for (const token of ["full", "new"]) {
    expect(() => store.reserve(token, 1)).toThrow(
      expect.objectContaining({ code: "AUDIO_LIBRARY_QUOTA_EXCEEDED", status: 413 })
    );
    expect(store.reservedBytes).toBe(remaining);
  }
  store.release("full");
  store.release("zero");
  store.release("minus-zero");
  expect(store.reservedBytes).toBe(0);
  expect(await store.snapshot()).toEqual(before);
});

async function incoming(operation: "add" | "restore") {
  const { store, asset } = context;
  const original = await asset("original", null);
  const item = { ...original, id: "incoming", bytes: store.maxBytes - store.usedBytes, sha256: "b".repeat(64) };
  const directory = await store.staging(),
    token = "incoming-token";
  const file =
    operation === "restore"
      ? path.join(directory, "items", item.id, item.fileName)
      : path.join(directory, item.fileName);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, Buffer.alloc(item.bytes, 1));
  const backup = { ...(await store.snapshot()), groups: [], items: [item], presets: [], pendingDeletes: [] };
  return {
    original,
    item,
    directory,
    file,
    token,
    run: () => (operation === "add" ? store.add(item, directory, token, true) : store.restore(backup, directory, token))
  };
}

it.each(["add", "restore"] as const)(
  "subtracts its own reservation during %s and keeps release with the caller",
  async (operation) => {
    const { store } = context,
      prepared = await incoming(operation);
    store.reserve(prepared.token, prepared.item.bytes);
    await prepared.run();
    expect(store.usedBytes).toBe(store.maxBytes);
    expect(store.reservedBytes).toBe(prepared.item.bytes);
    const items = (await store.snapshot()).items;
    expect(items).toHaveLength(2);
    const imported = items.find((item) => item.id !== prepared.original.id)!;
    expect((await fs.stat(store.file(imported))).size).toBe(prepared.item.bytes);
    store.release(prepared.token);
    expect(store.reservedBytes).toBe(0);
  }
);

it.each(["add", "restore"] as const)("does not subtract another token's reservation during %s", async (operation) => {
  const { store } = context,
    prepared = await incoming(operation),
    before = await store.snapshot();
  store.reserve(prepared.token, prepared.item.bytes - 1);
  store.reserve("other", 1);
  await expect(prepared.run()).rejects.toMatchObject({
    code: "AUDIO_LIBRARY_QUOTA_EXCEEDED",
    status: 413,
    message: operation === "add" ? "音频库空间不足" : "恢复后的音频库超过容量上限"
  });
  expect(await store.snapshot()).toEqual(before);
  expect(store.reservedBytes).toBe(prepared.item.bytes);
  expect((await fs.stat(prepared.file)).size).toBe(prepared.item.bytes);
  store.release(prepared.token);
  store.release("other");
});

it("resolves an existing upload before capacity checks and leaves its independent staging copy to the caller", async () => {
  const { store, asset } = context;
  const item = await asset("original", null),
    before = await store.snapshot();
  const directory = await store.staging(),
    file = path.join(directory, item.fileName);
  await fs.writeFile(file, Buffer.from(item.id));
  store.reserve("other", store.maxBytes - store.usedBytes);
  const result = await store.add(item, directory, "unreserved");
  expect(result.existing).toBe(true);
  expect(result.item.id).toBe(item.id);
  expect(await store.snapshot()).toEqual(before);
  expect(await fs.readFile(file)).toEqual(Buffer.from(item.id));
  store.release("other");
});

it("restores a fully duplicated backup without adding its bytes again", async () => {
  const { store, asset } = context;
  const item = await asset("original", null),
    backup = await store.snapshot(),
    directory = await store.staging();
  store.reserve("other", store.maxBytes - store.usedBytes);
  expect(await store.restore(backup, directory, "unreserved")).toEqual({ added: 0, skipped: 1 });
  expect(store.usedBytes).toBe(item.bytes);
  expect((await store.snapshot()).items).toEqual(backup.items);
  expect(await fs.readFile(store.file(item))).toEqual(Buffer.from(item.id));
  store.release("other");
});
