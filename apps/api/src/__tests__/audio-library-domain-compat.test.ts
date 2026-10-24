import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { ToolboxDatabase } from "../database/toolbox-database";
import { AudioLibraryStore, AudioLibraryError, readCatalog, reject } from "../domains/audio-library/store";
import { createIsolatedAppFixture } from "./helpers/isolated-app";

let fixture: Awaited<ReturnType<typeof createIsolatedAppFixture>>;
let database: ToolboxDatabase;

beforeEach(async () => {
  fixture = await createIsolatedAppFixture();
  database = new ToolboxDatabase(":memory:");
});
afterEach(async () => {
  database.close();
  await fixture.dispose();
});

it("constructs without creating files and keeps the explicit Chinese/spaced storage root", async () => {
  const root = path.join(fixture.root, "中文 空格", "永久素材");
  const store = new AudioLibraryStore(root, database, 1024);
  expect(store.storageRoot).toBe(root);
  expect(store.root).toBe(path.join(root, "audio-library"));
  expect(store.maxBytes).toBe(1024);
  await expect(fs.stat(root)).rejects.toMatchObject({ code: "ENOENT" });
});

it("retains fixed manifest, backup and item directories and reloads the same library identity", async () => {
  const root = path.join(fixture.root, "中文 空格", "永久素材");
  const store = new AudioLibraryStore(root, database, 1024);
  const initialization = store.initialize();
  expect(store.initialize()).toBe(initialization);
  await initialization;
  const initial = await store.snapshot();
  expect(initial).toMatchObject({ version: 1, revision: 0, groups: [], items: [], presets: [], pendingDeletes: [] });
  const group = await store.group({ name: "合成分组", parentId: null });
  expect((await fs.readdir(store.root)).sort()).toEqual(["items", "library.json", "library.json.bak"]);
  expect(JSON.parse(await fs.readFile(path.join(store.root, "library.json.bak"), "utf8"))).toEqual(initial);
  const restarted = new AudioLibraryStore(root, database, 1024);
  expect(await restarted.snapshot()).toEqual({ ...initial, revision: 1, groups: [group] });
  expect(database.list("audio-library-group").map((row) => row.payload)).toEqual([group]);
});

it("reads compatible legacy catalogs without mutating their input", async () => {
  const catalog = await new AudioLibraryStore(fixture.layout.storageRoot, database, 1024).snapshot();
  const legacy = { ...catalog, tags: ["历史标签"] };
  expect(readCatalog(legacy)).toEqual(catalog);
  expect(legacy.tags).toEqual(["历史标签"]);
});

it("continues rejecting unknown catalog fields and malformed legacy fields", async () => {
  const catalog = await new AudioLibraryStore(fixture.layout.storageRoot, database, 1024).snapshot();
  expect(readCatalog({ ...catalog, unexpected: true })).toBeUndefined();
  expect(readCatalog({ ...catalog, tags: [1] })).toBeUndefined();
  expect(readCatalog(null)).toBeUndefined();
});

it("preserves the shared error identity, code, message and default/explicit status", () => {
  expect(() => reject("AUDIO_LIBRARY_INVALID", "合成错误")).toThrow(AudioLibraryError);
  expect(new AudioLibraryError("CODE", "合成错误")).toMatchObject({ code: "CODE", message: "合成错误", status: 400 });
  expect(new AudioLibraryError("CODE", "合成错误", 409)).toMatchObject({ code: "CODE", status: 409 });
});
