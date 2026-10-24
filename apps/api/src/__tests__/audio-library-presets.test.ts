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

it.each(["sequence", "list", "single"] as const)(
  "keeps %s mode, gap and revision through save/reload",
  async (mode) => {
    const { store, asset, fixture, database } = context;
    const item = await asset("item", null);
    const saved = await store.savePreset({ name: " 合成队列 ", itemIds: [item.id], mode, gap: 300 });
    expect(saved).toMatchObject({ name: "合成队列", itemIds: [item.id], mode, gap: 300, revision: 1 });
    const restarted = new AudioLibraryStore(fixture.layout.storageRoot, database, 1024);
    expect(await restarted.presets()).toEqual([saved]);
    expect(database.list("audio-library-preset").map((row) => row.payload)).toEqual([saved]);
  }
);

it("preserves duplicate ordering while checking each distinct item once, and owns its saved copies", async () => {
  const { store, asset } = context;
  const one = await asset("one", null),
    two = await asset("two", null);
  const ids = [two.id, one.id, two.id],
    view = vi.spyOn(store, "view");
  const saved = await store.savePreset({ name: "ordered", itemIds: ids, mode: "list", gap: 0 });
  expect(view).toHaveBeenCalledTimes(2);
  ids.push("caller-only");
  saved.itemIds.length = 0;
  saved.name = "caller mutation";
  const stored = (await store.presets())[0];
  expect(stored).toMatchObject({ name: "ordered", itemIds: [two.id, one.id, two.id] });
  view.mockClear();
  const loaded = await store.loadPreset(stored.id);
  expect(view).toHaveBeenCalledTimes(2);
  expect(loaded.items.map((item) => item.id)).toEqual(stored.itemIds);
  expect(loaded.unavailableCount).toBe(0);
  loaded.preset.name = "changed projection";
  expect((await store.presets())[0].name).toBe("ordered");
});

it("permits renaming unchanged invalid references without rechecking or deleting the original queue", async () => {
  const { store, asset } = context;
  const item = await asset("item", null);
  const saved = await store.savePreset({ name: "original", itemIds: [item.id, item.id], mode: "single", gap: 1 });
  await store.trash([item.id]);
  await fs.rm(store.file(item));
  const view = vi.spyOn(store, "view");
  const renamed = await store.savePreset({ ...saved, name: "repair later", gap: 2 }, saved.id);
  expect(view).not.toHaveBeenCalled();
  expect(renamed).toMatchObject({ itemIds: saved.itemIds, revision: 2, createdAt: saved.createdAt, gap: 2 });
  expect(await store.loadPreset(saved.id)).toMatchObject({ unavailableCount: 2, items: [] });
  expect((await store.presets())[0].itemIds).toEqual(saved.itemIds);
});

it.each(["missing", "trashed", "missing-file"] as const)(
  "rejects newly selected %s items without committing",
  async (scenario) => {
    const { store, asset } = context;
    const item = await asset("item", null);
    if (scenario === "trashed") await store.trash([item.id]);
    if (scenario === "missing-file") await fs.rm(store.file(item));
    const before = await store.snapshot();
    await expect(
      store.savePreset({
        name: "invalid",
        itemIds: [scenario === "missing" ? "unknown" : item.id],
        mode: "list",
        gap: 1
      })
    ).rejects.toMatchObject({ code: "AUDIO_LIBRARY_PRESET_ITEM_UNAVAILABLE", status: 409 });
    expect(await store.snapshot()).toEqual(before);
  }
);

it.each(["save", "delete", "load"] as const)("keeps the missing preset contract for %s", async (operation) => {
  const { store } = context,
    before = await store.snapshot();
  const task =
    operation === "save"
      ? store.savePreset({ name: "none", itemIds: ["item"], mode: "list", gap: 1 }, "missing")
      : operation === "delete"
        ? store.deletePreset("missing", 1)
        : store.loadPreset("missing");
  await expect(task).rejects.toMatchObject({ code: "AUDIO_LIBRARY_PRESET_NOT_FOUND", status: 404 });
  expect(await store.snapshot()).toEqual(before);
});

it.each(["save", "delete"] as const)("rejects a stale revision during %s", async (operation) => {
  const { store, asset } = context;
  const item = await asset("item", null);
  const saved = await store.savePreset({ name: "original", itemIds: [item.id], mode: "list", gap: 1 });
  const before = await store.snapshot();
  await expect(
    operation === "save" ? store.savePreset({ ...saved, revision: 2 }, saved.id) : store.deletePreset(saved.id, 2)
  ).rejects.toMatchObject({ code: "AUDIO_LIBRARY_CONFLICT", status: 409 });
  expect(await store.snapshot()).toEqual(before);
});

it("retains normalized name rejection and permits valid update without changing the preset slot", async () => {
  const { store, asset } = context;
  const item = await asset("item", null);
  const first = await store.savePreset({ name: "FIRST", itemIds: [item.id], mode: "list", gap: 1 });
  const second = await store.savePreset({ name: "second", itemIds: [item.id], mode: "list", gap: 1 });
  const before = await store.snapshot();
  await expect(store.savePreset({ ...second, name: " ｆｉｒｓｔ " }, second.id)).rejects.toMatchObject({
    code: "AUDIO_LIBRARY_PRESET_DUPLICATE",
    status: 409
  });
  expect(await store.snapshot()).toEqual(before);
  const changed = await store.savePreset({ ...second, name: "renamed" }, second.id);
  expect(await store.presets()).toEqual([first, changed]);
  expect(changed.revision).toBe(2);
  expect(changed.createdAt).toBe(second.createdAt);
});

it("enforces the existing 200 preset limit but permits an update at the limit", async () => {
  const { store, asset } = context;
  const item = await asset("item", null);
  const first = await store.savePreset({ name: "preset-0", itemIds: [item.id], mode: "list", gap: 1 });
  await store.mutate((c) => {
    c.presets = Array.from({ length: 200 }, (_, i) => ({ ...first, id: `preset-${i}`, name: `preset-${i}` }));
  });
  const before = await store.snapshot();
  await expect(store.savePreset({ ...first, name: "new" })).rejects.toMatchObject({
    code: "AUDIO_LIBRARY_PRESET_LIMIT",
    status: 400
  });
  expect(await store.snapshot()).toEqual(before);
  expect(await store.savePreset({ ...first, name: "updated" }, "preset-0")).toMatchObject({
    revision: 2,
    name: "updated"
  });
  expect(await store.presets()).toHaveLength(200);
});

it("counts unavailable duplicate entries without editing the preset or deleting any additional file", async () => {
  const { store, asset } = context;
  const one = await asset("one", null),
    two = await asset("two", null),
    three = await asset("three", null);
  const saved = await store.savePreset({
    name: "mixed",
    itemIds: [one.id, two.id, one.id, three.id],
    mode: "sequence",
    gap: 1
  });
  await store.trash([two.id]);
  await fs.rm(store.file(three));
  const before = await store.snapshot();
  expect(await store.loadPreset(saved.id)).toMatchObject({
    preset: saved,
    unavailableCount: 2,
    items: [{ id: one.id }, { id: one.id }]
  });
  expect(await store.snapshot()).toEqual(before);
  expect(await fs.readFile(store.file(two))).toEqual(Buffer.from(two.id));
});

it("keeps the commit coordinator usable after availability and mirror failures", async () => {
  const { store, asset, database } = context;
  const item = await asset("item", null),
    before = await store.snapshot();
  const input = { name: "saved", itemIds: [item.id], mode: "list" as const, gap: 1 };
  vi.spyOn(store, "view").mockRejectedValueOnce(new Error("synthetic view failure"));
  await expect(store.savePreset(input)).rejects.toThrow("synthetic view failure");
  expect(await store.snapshot()).toEqual(before);
  vi.spyOn(database, "upsert").mockImplementationOnce(() => {
    throw new Error("synthetic mirror failure");
  });
  await expect(store.savePreset(input)).rejects.toThrow("synthetic mirror failure");
  expect(await store.snapshot()).toEqual(before);
  const saved = await store.savePreset(input);
  await store.deletePreset(saved.id, saved.revision);
  expect(await store.presets()).toEqual([]);
  expect(await fs.readFile(store.file(item))).toEqual(Buffer.from(item.id));
  expect(await fs.readdir(store.root)).not.toContain("transaction.json");
  expect(JSON.parse(await fs.readFile(path.join(store.root, "library.json"), "utf8")).items).toEqual(before.items);
});
