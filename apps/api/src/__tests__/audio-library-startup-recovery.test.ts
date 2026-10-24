import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AudioLibraryStore } from "../domains/audio-library/store";
import { recoverAudioLibraryCatalog } from "../domains/audio-library/startup-recovery";
import { createAudioLibraryFixture } from "./helpers/audio-library";

let context: Awaited<ReturnType<typeof createAudioLibraryFixture>>;
beforeEach(async () => {
  context = await createAudioLibraryFixture();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await context.dispose();
});
const restarted = () => new AudioLibraryStore(context.fixture.layout.storageRoot, context.database, 1024);

it("does not read previous database items when the primary already supplies a catalog", async () => {
  const before = await context.store.snapshot(),
    previous = vi.fn(() => []);
  expect(await recoverAudioLibraryCatalog(context.store.root, previous)).toEqual(before);
  expect(previous).not.toHaveBeenCalled();
});

it("preserves a previous-item lookup failure before creating a replacement catalog", async () => {
  const root = path.join(context.fixture.root, "previous-items-failure");
  const previous = vi.fn(() => {
    throw new Error("synthetic previous-items failure");
  });
  await expect(recoverAudioLibraryCatalog(root, previous)).rejects.toThrow("synthetic previous-items failure");
  expect(previous).toHaveBeenCalledTimes(1);
  await expect(fs.stat(path.join(root, "library.json"))).rejects.toMatchObject({ code: "ENOENT" });
});

it("creates a fresh catalog only inside the explicit root and reuses its initialization promise", async () => {
  const root = path.join(context.fixture.root, "中文 空格", "fresh");
  const store = new AudioLibraryStore(root, context.database, 1024);
  await expect(fs.stat(root)).rejects.toMatchObject({ code: "ENOENT" });
  const task = store.initialize();
  expect(store.initialize()).toBe(task);
  await task;
  const catalog = await store.snapshot();
  expect(catalog).toMatchObject({ version: 1, revision: 0, groups: [], items: [], presets: [], pendingDeletes: [] });
  expect(JSON.parse(await fs.readFile(path.join(store.root, "library.json"), "utf8"))).toEqual(catalog);
  expect((await fs.readdir(store.root)).sort()).toEqual(["items", "library.json"]);
});

it("rolls back to a readable journal even when the primary is readable and newer", async () => {
  const { store, asset } = context;
  const item = await asset("item", null),
    old = await store.snapshot();
  await store.edit(item.id, { note: "newer-primary" });
  const journal = path.join(store.root, "transaction.json");
  await fs.writeFile(journal, JSON.stringify(old));
  expect(await restarted().snapshot()).toEqual(old);
  expect(JSON.parse(await fs.readFile(path.join(store.root, "library.json"), "utf8"))).toEqual(old);
  await expect(fs.stat(journal)).rejects.toMatchObject({ code: "ENOENT" });
  expect(await fs.readFile(store.file(item))).toEqual(Buffer.from(item.id));
});

it.each(["broken JSON", JSON.stringify({ version: 2, items: [] })])(
  "ignores unreadable journal %j and retains the valid primary",
  async (journal) => {
    const { store, asset } = context;
    await asset("item", null);
    const before = await store.snapshot();
    await fs.writeFile(path.join(store.root, "transaction.json"), journal);
    expect(await restarted().snapshot()).toEqual(before);
    await expect(fs.stat(path.join(store.root, "transaction.json"))).rejects.toMatchObject({ code: "ENOENT" });
  }
);

it.each(["broken", "missing"] as const)(
  "recovers from the backup after a %s primary while preserving damaged bytes when present",
  async (scenario) => {
    const { store, asset } = context;
    const item = await asset("item", null),
      before = await store.snapshot(),
      primary = path.join(store.root, "library.json");
    await fs.writeFile(path.join(store.root, "library.json.bak"), JSON.stringify(before));
    if (scenario === "broken") await fs.writeFile(primary, "damaged-primary");
    else await fs.rm(primary);
    vi.spyOn(Date, "now").mockReturnValue(123456);
    expect(await restarted().snapshot()).toEqual(before);
    const damaged = path.join(store.root, "library-damaged-123456.json");
    if (scenario === "broken") expect(await fs.readFile(damaged, "utf8")).toBe("damaged-primary");
    else await expect(fs.stat(damaged)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await fs.readFile(store.file(item))).toEqual(Buffer.from(item.id));
  }
);

it.each(["primary", "assets", "mirror"] as const)(
  "refuses a new empty library when %s evidence exists, without deleting that evidence",
  async (scenario) => {
    const root = path.join(context.fixture.root, "refuse-empty");
    const store = new AudioLibraryStore(root, context.database, 1024);
    await fs.mkdir(store.root, { recursive: true });
    const evidence =
      scenario === "primary"
        ? path.join(store.root, "library.json")
        : scenario === "assets"
          ? path.join(store.root, "items", "kept", "audio.wav")
          : path.join(store.root, "sentinel.txt");
    if (scenario === "mirror") await context.asset("mirror-item", null);
    await fs.mkdir(path.dirname(evidence), { recursive: true });
    await fs.writeFile(evidence, "preserved-evidence");
    await expect(store.initialize()).rejects.toMatchObject({ code: "AUDIO_LIBRARY_RECOVERY_REQUIRED", status: 503 });
    expect(await fs.readFile(evidence, "utf8")).toBe("preserved-evidence");
    if (scenario !== "primary")
      await expect(fs.stat(path.join(store.root, "library.json"))).rejects.toMatchObject({ code: "ENOENT" });
  }
);

it("normalizes legacy fields and absent presets only at the original startup stage", async () => {
  const { store, asset, database } = context;
  const item = await asset("item", null),
    before = await store.snapshot();
  const legacy = {
    ...structuredClone(before),
    tags: ["legacy"],
    items: [{ ...before.items[0], tags: ["legacy"], favorite: false }]
  };
  delete legacy.presets;
  await fs.writeFile(path.join(store.root, "library.json"), JSON.stringify(legacy, null, 2));
  expect(await restarted().snapshot()).toEqual(before);
  expect(JSON.parse(await fs.readFile(path.join(store.root, "library.json"), "utf8"))).toEqual(before);
  expect(database.get("audio-library-item", item.id)?.payload).toEqual(before.items[0]);
  expect(legacy.items[0]).toMatchObject({ tags: ["legacy"], favorite: false });
});

it("mirrors before cleanup, quarantines only orphan directories, then collects known pending assets", async () => {
  const { store, asset, database } = context;
  const item = await asset("known", null),
    before = await store.snapshot();
  before.pendingDeletes = [{ id: "pending", bytes: 7 }];
  const orphan = path.join(store.root, "items", "orphan"),
    pending = path.join(store.root, "items", "pending");
  const staging = path.join(store.root, "staging"),
    recovery = path.join(store.root, "recovery");
  for (const dir of [orphan, pending, staging, recovery]) await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(orphan, "audio.wav"), "orphan-bytes");
  await fs.writeFile(path.join(pending, "audio.wav"), "pending");
  await fs.writeFile(path.join(staging, "unfinished"), "temporary");
  await fs.writeFile(path.join(recovery, "keep.txt"), "existing-recovery");
  const loose = path.join(store.root, "items", "loose.bin");
  await fs.writeFile(loose, "loose-file");
  await fs.writeFile(path.join(store.root, "library.json"), JSON.stringify(before));
  const next = restarted(),
    remove = fs.rm.bind(fs),
    rename = fs.rename.bind(fs),
    order: string[] = [];
  vi.spyOn(fs, "rm").mockImplementation(async (file, options) => {
    if (String(file) === staging) {
      order.push("staging");
      expect(next.usedBytes).toBe(item.bytes + 7);
      expect(database.get("audio-library-item", item.id)?.payload).toEqual(before.items[0]);
    }
    if (String(file) === pending) order.push("pending");
    return remove(file, options);
  });
  vi.spyOn(fs, "rename").mockImplementation(async (from, to) => {
    if (String(from) === orphan) order.push("quarantine");
    return rename(from, to);
  });
  expect(await next.snapshot()).toEqual({ ...before, pendingDeletes: [] });
  expect(order).toEqual(["staging", "quarantine", "pending"]);
  expect(next.usedBytes).toBe(item.bytes);
  const moved = (await fs.readdir(recovery)).filter((name) => name.startsWith("orphan-"));
  expect(moved).toHaveLength(1);
  expect(await fs.readFile(path.join(recovery, moved[0], "audio.wav"), "utf8")).toBe("orphan-bytes");
  expect(await fs.readFile(path.join(recovery, "keep.txt"), "utf8")).toBe("existing-recovery");
  expect(await fs.readFile(loose, "utf8")).toBe("loose-file");
  expect(await fs.readFile(store.file(item))).toEqual(Buffer.from(item.id));
  await expect(fs.stat(staging)).rejects.toMatchObject({ code: "ENOENT" });
  await expect(fs.stat(pending)).rejects.toMatchObject({ code: "ENOENT" });
});

it("does not silently fall back from a Schema-valid but semantically invalid primary", async () => {
  const { store, asset } = context;
  const item = await asset("item", null),
    before = await store.snapshot(),
    primary = path.join(store.root, "library.json");
  await fs.writeFile(path.join(store.root, "library.json.bak"), JSON.stringify(before));
  const invalid = { ...before, items: [before.items[0], structuredClone(before.items[0])] };
  await fs.writeFile(primary, JSON.stringify(invalid));
  await expect(restarted().initialize()).rejects.toMatchObject({
    code: "AUDIO_LIBRARY_INVALID",
    message: "音频库标识重复",
    status: 400
  });
  expect(JSON.parse(await fs.readFile(primary, "utf8"))).toEqual(invalid);
  expect(await fs.readFile(store.file(item))).toEqual(Buffer.from(item.id));
});

it("retains journal and media if the rollback write fails before the mirror stage", async () => {
  const { store, asset, database } = context;
  const item = await asset("item", null),
    before = await store.snapshot(),
    journal = path.join(store.root, "transaction.json");
  await fs.writeFile(journal, JSON.stringify(before));
  const write = fs.writeFile.bind(fs),
    mirror = vi.spyOn(database, "upsert");
  vi.spyOn(fs, "writeFile").mockImplementation(async (file, data, options) => {
    if (String(file).startsWith(path.join(store.root, ".library.json.staging-")))
      throw new Error("synthetic rollback write failure");
    return write(file, data, options);
  });
  const next = restarted(),
    task = next.initialize();
  expect(next.initialize()).toBe(task);
  await expect(task).rejects.toThrow("synthetic rollback write failure");
  expect(mirror).not.toHaveBeenCalled();
  expect(JSON.parse(await fs.readFile(journal, "utf8"))).toEqual(before);
  expect(await fs.readFile(store.file(item))).toEqual(Buffer.from(item.id));
});

it("does not remove the recovery journal or staging before a failed mirror succeeds on a new instance", async () => {
  const { store, asset, database } = context;
  const item = await asset("item", null),
    before = await store.snapshot(),
    journal = path.join(store.root, "transaction.json");
  const stageFile = path.join(await store.staging(), "kept");
  await fs.writeFile(stageFile, "temporary");
  await fs.writeFile(journal, JSON.stringify(before));
  vi.spyOn(database, "upsert").mockImplementationOnce(() => {
    throw new Error("synthetic mirror failure");
  });
  await expect(restarted().initialize()).rejects.toThrow("synthetic mirror failure");
  expect(JSON.parse(await fs.readFile(journal, "utf8"))).toEqual(before);
  expect(await fs.readFile(stageFile, "utf8")).toBe("temporary");
  expect(await fs.readFile(store.file(item))).toEqual(Buffer.from(item.id));
  expect(await restarted().snapshot()).toEqual(before);
  await expect(fs.stat(journal)).rejects.toMatchObject({ code: "ENOENT" });
});

it("keeps staging and media if the post-mirror normalization write fails", async () => {
  const { store, asset, database } = context;
  const item = await asset("item", null),
    before = await store.snapshot(),
    primary = path.join(store.root, "library.json");
  const pretty = JSON.stringify(before, null, 2),
    stageFile = path.join(await store.staging(), "kept");
  await fs.writeFile(primary, pretty);
  await fs.writeFile(stageFile, "temporary");
  const write = fs.writeFile.bind(fs),
    mirror = vi.spyOn(database, "upsert");
  vi.spyOn(fs, "writeFile").mockImplementation(async (file, data, options) => {
    if (String(file).startsWith(path.join(store.root, ".library.json.staging-")))
      throw new Error("synthetic normalization failure");
    return write(file, data, options);
  });
  const next = restarted();
  await expect(next.initialize()).rejects.toThrow("synthetic normalization failure");
  expect(mirror).toHaveBeenCalled();
  expect(next.usedBytes).toBe(item.bytes);
  expect(await fs.readFile(primary, "utf8")).toBe(pretty);
  expect(await fs.readFile(stageFile, "utf8")).toBe("temporary");
  expect(await fs.readFile(store.file(item))).toEqual(Buffer.from(item.id));
});

it("propagates an orphan quarantine failure without removing that orphan or known media", async () => {
  const { store, asset } = context;
  const item = await asset("known", null),
    orphan = path.join(store.root, "items", "orphan");
  await fs.mkdir(orphan);
  await fs.writeFile(path.join(orphan, "audio.wav"), "orphan");
  const rename = fs.rename.bind(fs);
  const spy = vi.spyOn(fs, "rename").mockImplementation(async (from, to) => {
    if (String(from) === orphan) throw new Error("synthetic quarantine failure");
    return rename(from, to);
  });
  await expect(restarted().initialize()).rejects.toThrow("synthetic quarantine failure");
  expect(await fs.readFile(path.join(orphan, "audio.wav"), "utf8")).toBe("orphan");
  expect(await fs.readFile(store.file(item))).toEqual(Buffer.from(item.id));
  spy.mockRestore();
  expect((await restarted().snapshot()).items).toHaveLength(1);
  await expect(fs.stat(orphan)).rejects.toMatchObject({ code: "ENOENT" });
});
