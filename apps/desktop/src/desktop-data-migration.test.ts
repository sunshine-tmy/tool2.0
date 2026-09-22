import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  importDesktopData,
  recoverDesktopDataMigrations,
  rollbackDesktopData,
  type DesktopDataMigrationOptions
} from "./desktop-data-migration";

let root: string | undefined;

afterEach(async () => {
  if (root) await fs.rm(root, { recursive: true, force: true });
  root = undefined;
});

describe("desktop data migration", () => {
  it("copies verified legacy data, atomically switches the live root, and retains an isolated rollback backup", async () => {
    const { options, sourceRoot } = await createFixture();
    await fs.mkdir(path.join(options.storageRoot, "outputs"), { recursive: true });
    await fs.writeFile(path.join(options.storageRoot, "outputs", "current.txt"), "current", "utf8");

    const result = await importDesktopData(options, sourceRoot);

    expect(result.source).toMatchObject({ files: 2 });
    expect(await fs.readFile(path.join(options.storageRoot, "lan-transfer", "index.json"), "utf8")).toContain(
      "legacy-file"
    );
    await expect(fs.access(path.join(options.storageRoot, "outputs", "current.txt"))).rejects.toMatchObject({
      code: "ENOENT"
    });
    expect(
      await fs.readFile(
        path.join(
          options.dataRoot,
          "migration-backups",
          "desktop",
          result.id,
          "previous-data",
          "outputs",
          "current.txt"
        ),
        "utf8"
      )
    ).toBe("current");
    expect(await fs.readFile(path.join(sourceRoot, "lan-transfer", "index.json"), "utf8")).toContain("legacy-file");
  });

  it("verifies the backup and preserves post-import data before restoring the previous data set", async () => {
    const { options, sourceRoot } = await createFixture();
    await fs.mkdir(path.join(options.storageRoot, "outputs"), { recursive: true });
    await fs.writeFile(path.join(options.storageRoot, "outputs", "before.txt"), "before", "utf8");
    const imported = await importDesktopData(options, sourceRoot);
    await fs.writeFile(path.join(options.storageRoot, "after.txt"), "after", "utf8");

    const rollback = await rollbackDesktopData(options, imported.id);

    expect(rollback.restored.files).toBeGreaterThan(0);
    expect(await fs.readFile(path.join(options.storageRoot, "outputs", "before.txt"), "utf8")).toBe("before");
    expect(
      await fs.readFile(
        path.join(options.dataRoot, "migration-backups", "desktop", imported.id, "rollback-current-data", "after.txt"),
        "utf8"
      )
    ).toBe("after");
  });

  it("refuses data roots that overlap the live user data tree or do not look like legacy toolbox data", async () => {
    const { options, sourceRoot } = await createFixture();
    await expect(importDesktopData(options, options.dataRoot)).rejects.toThrow("不能与当前用户数据目录重叠");
    const unrelated = path.join(root!, "unrelated");
    await fs.mkdir(unrelated);
    await expect(importDesktopData(options, unrelated)).rejects.toThrow("不包含可识别");
    await expect(fs.access(path.join(sourceRoot, "lan-transfer", "index.json"))).resolves.toBeUndefined();
  });

  it("recovers a crash after the old directory has been moved by restoring the previous root", async () => {
    const { options } = await createFixture();
    const id = "b".repeat(24);
    const backupRoot = path.join(options.dataRoot, "migration-backups", "desktop", id);
    const previousRoot = path.join(backupRoot, "previous-data");
    const stagingRoot = path.join(options.dataRoot, `.data-import-${id}`);
    const journalRoot = path.join(options.configRoot, "desktop-migrations");
    await fs.mkdir(path.join(previousRoot, "outputs"), { recursive: true });
    await fs.writeFile(path.join(previousRoot, "outputs", "before.txt"), "before", "utf8");
    await fs.mkdir(stagingRoot, { recursive: true });
    await fs.mkdir(journalRoot, { recursive: true });
    await fs.writeFile(
      path.join(journalRoot, `${id}.json`),
      JSON.stringify({
        schemaVersion: 1,
        id,
        state: "previous-backed-up",
        storageRoot: options.storageRoot,
        stagingRoot,
        backupRoot,
        createdAt: "2026-09-22T00:00:00.000Z"
      }),
      "utf8"
    );

    await recoverDesktopDataMigrations(options);

    expect(await fs.readFile(path.join(options.storageRoot, "outputs", "before.txt"), "utf8")).toBe("before");
    await expect(fs.access(stagingRoot)).rejects.toMatchObject({ code: "ENOENT" });
  });
});

async function createFixture() {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-desktop-migration-"));
  const dataRoot = path.join(root, "user-data");
  const sourceRoot = path.join(root, "legacy-storage");
  const options: DesktopDataMigrationOptions = {
    dataRoot,
    storageRoot: path.join(dataRoot, "data"),
    configRoot: path.join(dataRoot, "config")
  };
  await fs.mkdir(path.join(sourceRoot, "lan-transfer"), { recursive: true });
  await fs.mkdir(path.join(sourceRoot, "xhs-archive"), { recursive: true });
  await fs.writeFile(path.join(sourceRoot, "lan-transfer", "index.json"), '[{"id":"legacy-file"}]', "utf8");
  await fs.writeFile(path.join(sourceRoot, "xhs-archive", "index.json"), '[{"id":"legacy-note"}]', "utf8");
  return { options, sourceRoot };
}
