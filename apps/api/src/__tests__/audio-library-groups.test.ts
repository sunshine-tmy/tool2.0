import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AudioLibraryStore } from "../domains/audio-library/store";
import { createAudioLibraryFixture } from "./helpers/audio-library";

type Fixture = Awaited<ReturnType<typeof createAudioLibraryFixture>>;
let resources: Fixture;
let fixture: Fixture["fixture"];
let database: Fixture["database"];
let store: Fixture["store"];
let asset: Fixture["asset"];

beforeEach(async () => {
  resources = await createAudioLibraryFixture();
  ({ fixture, database, store, asset } = resources);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await resources.dispose();
});
it("creates and replaces a group in the same slot, preserving trimmed names and explicit parents", async () => {
  const top = await store.group({ name: " 一级 ", parentId: null });
  const child = await store.group({ name: " 二级 ", parentId: top.id });
  const updated = await store.group({ id: child.id, name: " 新名称 ", parentId: null });
  expect(updated).toEqual({ id: child.id, name: "新名称", parentId: null });
  expect((await store.snapshot()).groups).toEqual([top, updated]);
  expect(database.list("audio-library-group").map((row) => row.payload)).toEqual(
    expect.arrayContaining([top, updated])
  );
  expect(database.list("audio-library-group")).toHaveLength(2);
});

it("allows matching names in different sibling namespaces", async () => {
  const left = await store.group({ name: "left", parentId: null });
  const right = await store.group({ name: "right", parentId: null });
  await store.group({ name: "child", parentId: left.id });
  await store.group({ name: "child", parentId: right.id });
  expect((await store.snapshot()).groups).toHaveLength(4);
});

it.each([
  ["unknown-id", "AUDIO_LIBRARY_GROUP_NOT_FOUND", 404],
  ["unknown-parent", "AUDIO_LIBRARY_GROUP_NOT_FOUND", 404],
  ["fourth-level", "AUDIO_LIBRARY_GROUP_DEPTH", 400],
  ["cycle", "AUDIO_LIBRARY_GROUP_DEPTH", 400],
  ["normalized-duplicate", "AUDIO_LIBRARY_GROUP_DUPLICATE", 409],
  ["blank", "AUDIO_LIBRARY_INVALID", 400]
] as const)("keeps %s rejection atomic with the original error contract", async (scenario, code, status) => {
  const top = await store.group({ name: "TOP", parentId: null });
  const child = await store.group({ name: "child", parentId: top.id });
  const leaf = await store.group({ name: "leaf", parentId: child.id });
  const before = await store.snapshot();
  const input =
    scenario === "unknown-id"
      ? { id: "missing", name: "new", parentId: null }
      : scenario === "unknown-parent"
        ? { name: "new", parentId: "missing" }
        : scenario === "fourth-level"
          ? { name: "new", parentId: leaf.id }
          : scenario === "cycle"
            ? { id: top.id, name: "TOP", parentId: child.id }
            : scenario === "normalized-duplicate"
              ? { name: " ｔｏｐ ", parentId: null }
              : { name: "  ", parentId: null };
  await expect(store.group(input)).rejects.toMatchObject({ code, status });
  expect(await store.snapshot()).toEqual(before);
  expect(JSON.parse(await fs.readFile(path.join(store.root, "library.json"), "utf8"))).toEqual(before);
});

it("ungroups a deleted subtree's live and trashed items without removing audio or other groups", async () => {
  const top = await store.group({ name: "top", parentId: null });
  const child = await store.group({ name: "child", parentId: top.id });
  const leaf = await store.group({ name: "leaf", parentId: child.id });
  const other = await store.group({ name: "other", parentId: null });
  const live = await asset("live", leaf.id),
    trashed = await asset("trash", child.id, true);
  const untouched = await asset("other", other.id),
    before = await store.snapshot(),
    used = store.usedBytes;
  vi.spyOn(Date.prototype, "toISOString").mockReturnValue("2026-02-01T00:00:00.000Z");
  await store.removeGroup(top.id);
  const after = await store.snapshot();
  expect(after.groups).toEqual([other]);
  for (const item of [live, trashed]) {
    expect(await store.item(item.id)).toEqual({
      ...item,
      groupId: null,
      revision: 2,
      updatedAt: "2026-02-01T00:00:00.000Z"
    });
    expect(await fs.readFile(store.file(item))).toEqual(Buffer.from(item.id));
  }
  expect(await store.item(untouched.id)).toEqual(untouched);
  expect(after.presets).toEqual(before.presets);
  expect(after.pendingDeletes).toEqual(before.pendingDeletes);
  expect(store.usedBytes).toBe(used);
});

it("serializes conflicting group creation and permits later commits after rejection", async () => {
  const results = await Promise.allSettled([
    store.group({ name: "same", parentId: null }),
    store.group({ name: " SAME ", parentId: null })
  ]);
  expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected"]);
  expect(await store.group({ name: "later", parentId: null })).toMatchObject({ name: "later" });
  expect((await store.snapshot()).groups.map((g) => g.name)).toEqual(["same", "later"]);
});

it("rolls back group changes after mirror failure and keeps the same commit queue usable", async () => {
  const group = await store.group({ name: "old", parentId: null }),
    before = await store.snapshot();
  vi.spyOn(database, "upsert").mockImplementationOnce(() => {
    throw new Error("synthetic mirror failure");
  });
  await expect(store.group({ id: group.id, name: "new", parentId: null })).rejects.toThrow("synthetic mirror failure");
  expect(await store.snapshot()).toEqual(before);
  expect(database.list("audio-library-group").map((row) => row.payload)).toEqual([group]);
  const restarted = new AudioLibraryStore(fixture.layout.storageRoot, database, 1024);
  expect(await restarted.snapshot()).toEqual(before);
  expect(await store.group({ id: group.id, name: "retry", parentId: null })).toMatchObject({ name: "retry" });
});

it("moves multiple live/trashed items and undoes only their groups while incrementing revisions", async () => {
  const original = await store.group({ name: "original", parentId: null });
  const target = await store.group({ name: "target", parentId: null });
  const first = await asset("first", original.id),
    second = await asset("second", null, true);
  const token = await store.move([first.id, second.id], target.id);
  for (const item of [first, second])
    expect(await store.item(item.id)).toMatchObject({ groupId: target.id, revision: 2 });
  await store.undo(token);
  for (const item of [first, second]) {
    const after = await store.item(item.id);
    expect(after).toEqual({ ...item, revision: 3, updatedAt: after.updatedAt });
    expect(await fs.readFile(store.file(item))).toEqual(Buffer.from(item.id));
  }
  await expect(store.undo(token)).rejects.toMatchObject({ code: "AUDIO_LIBRARY_UNDO_EXPIRED", status: 409 });
});

it.each(["unknown-group", "partly-missing-items"] as const)("keeps a %s move atomic", async (scenario) => {
  const item = await asset("first", null),
    before = await store.snapshot();
  await expect(
    store.move(
      scenario === "unknown-group" ? [item.id] : [item.id, "missing"],
      scenario === "unknown-group" ? "missing" : null
    )
  ).rejects.toMatchObject({
    code: scenario === "unknown-group" ? "AUDIO_LIBRARY_GROUP_NOT_FOUND" : "AUDIO_LIBRARY_NOT_FOUND",
    status: 404
  });
  expect(await store.snapshot()).toEqual(before);
});

it("preserves the existing empty move and no-op group removal commits", async () => {
  const before = await store.snapshot();
  const token = await store.move([], null);
  await store.undo(token);
  await store.removeGroup("missing");
  expect(await store.snapshot()).toEqual({ ...before, revision: before.revision + 3 });
});

it("accepts an undo at exactly 15 seconds and rejects it only after the original boundary", async () => {
  const item = await asset("item", null);
  const clock = vi.spyOn(Date, "now").mockReturnValue(1000);
  const first = await store.move([item.id], null);
  clock.mockReturnValue(16000);
  await store.undo(first);
  const second = await store.move([item.id], null);
  clock.mockReturnValue(31001);
  await expect(store.undo(second)).rejects.toMatchObject({ code: "AUDIO_LIBRARY_UNDO_EXPIRED", status: 409 });
  await expect(store.undo("unknown")).rejects.toMatchObject({ code: "AUDIO_LIBRARY_UNDO_EXPIRED", status: 409 });
});

it.each(["edited-item", "missing-original-group", "missing-item"] as const)(
  "preserves undo conflict for %s",
  async (scenario) => {
    const group = await store.group({ name: "original", parentId: null });
    const item = await asset("item", group.id),
      token = await store.move([item.id], null);
    if (scenario === "edited-item") await store.edit(item.id, { note: "changed" });
    else if (scenario === "missing-original-group") await store.removeGroup(group.id);
    else
      await store.mutate((c) => {
        c.items = [];
      });
    const before = await store.snapshot();
    await expect(store.undo(token)).rejects.toMatchObject({ code: "AUDIO_LIBRARY_CONFLICT", status: 409 });
    expect(await store.snapshot()).toEqual(before);
  }
);
