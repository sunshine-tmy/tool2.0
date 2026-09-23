import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  chooseFreshDesktopData,
  migrateLegacyDesktopData,
  prepareStartupDataMigration
} from "./desktop-root-migration";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("desktop root migration", () => {
  it("automatically marks a clean first run without requiring a migration choice", async () => {
    const { dataRoot, legacyDataRoot } = await makeRoots();

    const state = await prepareStartupDataMigration({ dataRoot, legacyDataRoot });

    expect(state).toMatchObject({ required: false, destinationDirectory: dataRoot, sourceBytes: 0, sourceFiles: 0 });
  });

  it("shows a capacity estimate, migrates all managed data and preserves the old source", async () => {
    const { dataRoot, legacyDataRoot } = await makeRoots();
    await put(legacyDataRoot, "config/preferences.json", '{"theme":"dark"}');
    await put(legacyDataRoot, "data/toolbox.db", "sqlite-data");
    await put(legacyDataRoot, "components/ffmpeg/bin/ffmpeg.exe", "ffmpeg-runtime");
    await put(legacyDataRoot, "models/whisper/model.bin", "model-data");
    await put(legacyDataRoot, "profile/Local Storage/leveldb/000001.log", "browser-login-state");
    await put(legacyDataRoot, "logs/desktop-startup.log", "old-log");
    await put(legacyDataRoot, "migration-backups/old-snapshot.db", "backup");
    await put(dataRoot, "data/current-empty-db.marker", "pre-migration target");

    const estimate = await prepareStartupDataMigration({ dataRoot, legacyDataRoot });
    expect(estimate.required).toBe(true);
    expect(estimate.sourceFiles).toBe(7);
    expect(estimate.sourceBytes).toBeGreaterThan(0);

    const result = await migrateLegacyDesktopData({ dataRoot, legacyDataRoot });

    expect(result.files).toBe(7);
    expect(await fs.readFile(path.join(dataRoot, "data", "toolbox.db"), "utf8")).toBe("sqlite-data");
    expect(await fs.readFile(path.join(dataRoot, "profile", "Local Storage", "leveldb", "000001.log"), "utf8")).toBe(
      "browser-login-state"
    );
    expect(await fs.readFile(path.join(legacyDataRoot, "data", "toolbox.db"), "utf8")).toBe("sqlite-data");
    expect(
      await fs.readFile(
        path.join(dataRoot, ".desktop-migration-recovery", result.id, "data", "current-empty-db.marker"),
        "utf8"
      )
    ).toBe("pre-migration target");
    expect(await fs.readFile(path.join(dataRoot, ".desktop-data-location.json"), "utf8")).toContain("migrated");
  });

  it("preserves the source and destination when a legacy managed path has an unexpected type", async () => {
    const { dataRoot, legacyDataRoot } = await makeRoots();
    await fs.mkdir(legacyDataRoot, { recursive: true });
    await fs.writeFile(path.join(legacyDataRoot, "data"), "not a directory");
    await put(dataRoot, "data/target.txt", "target");

    await expect(migrateLegacyDesktopData({ dataRoot, legacyDataRoot })).rejects.toThrow("目录类型无效");
    expect(await fs.readFile(path.join(legacyDataRoot, "data"), "utf8")).toBe("not a directory");
    expect(await fs.readFile(path.join(dataRoot, "data", "target.txt"), "utf8")).toBe("target");
  });

  it("records the explicit fresh-start choice while leaving old data untouched", async () => {
    const { dataRoot, legacyDataRoot } = await makeRoots();
    await put(legacyDataRoot, "data/old.db", "old");

    await chooseFreshDesktopData({ dataRoot, legacyDataRoot });

    const state = await prepareStartupDataMigration({ dataRoot, legacyDataRoot });
    expect(state.required).toBe(false);
    expect(await fs.readFile(path.join(legacyDataRoot, "data", "old.db"), "utf8")).toBe("old");
  });

  it("rolls back a journaled directory switch on restart and keeps the source available", async () => {
    const { dataRoot, legacyDataRoot } = await makeRoots();
    const id = "a".repeat(24);
    const stagingRoot = path.join(dataRoot, `.desktop-migration-staging-${id}`);
    const backupRoot = path.join(dataRoot, ".desktop-migration-recovery", id);
    await put(legacyDataRoot, "data/source.db", "source");
    await put(dataRoot, "data/source.db", "partially switched");
    await put(backupRoot, "data/previous.db", "previous target");
    await fs.mkdir(stagingRoot, { recursive: true });
    await fs.writeFile(
      path.join(dataRoot, ".desktop-root-migration.json"),
      JSON.stringify({
        schemaVersion: 1,
        id,
        state: "switching",
        dataRoot,
        sourceRoot: legacyDataRoot,
        stagingRoot,
        backupRoot,
        directories: [{ name: "data", existed: true, entries: [{ relativePath: "source.db", bytes: 6 }] }],
        files: 1,
        bytes: 6
      })
    );

    const state = await prepareStartupDataMigration({ dataRoot, legacyDataRoot });

    expect(state.required).toBe(true);
    expect(await fs.readFile(path.join(dataRoot, "data", "previous.db"), "utf8")).toBe("previous target");
    expect(await fs.readFile(path.join(legacyDataRoot, "data", "source.db"), "utf8")).toBe("source");
    expect(
      await fs.readFile(
        path.join(dataRoot, ".desktop-migration-recovery", id, "failed-target", "data", "source.db"),
        "utf8"
      )
    ).toBe("partially switched");
  });

  it("finalizes a committed migration journal after restart instead of offering a duplicate migration", async () => {
    const { dataRoot, legacyDataRoot } = await makeRoots();
    const id = "b".repeat(24);
    const stagingRoot = path.join(dataRoot, `.desktop-migration-staging-${id}`);
    const backupRoot = path.join(dataRoot, ".desktop-migration-recovery", id);
    await put(legacyDataRoot, "data/source.db", "source");
    await put(dataRoot, "data/source.db", "source");
    await fs.writeFile(
      path.join(dataRoot, ".desktop-root-migration.json"),
      JSON.stringify({
        schemaVersion: 1,
        id,
        state: "committed",
        dataRoot,
        sourceRoot: legacyDataRoot,
        stagingRoot,
        backupRoot,
        directories: [{ name: "data", existed: false, entries: [{ relativePath: "source.db", bytes: 6 }] }],
        files: 1,
        bytes: 6
      })
    );

    const state = await prepareStartupDataMigration({ dataRoot, legacyDataRoot });

    expect(state.required).toBe(false);
    expect(await fs.readFile(path.join(dataRoot, ".desktop-data-location.json"), "utf8")).toContain("migrated");
    expect(await fs.readFile(path.join(legacyDataRoot, "data", "source.db"), "utf8")).toBe("source");
  });

  it("rejects overlapping source and destination roots", async () => {
    const { dataRoot } = await makeRoots();

    await expect(prepareStartupDataMigration({ dataRoot, legacyDataRoot: path.dirname(dataRoot) })).rejects.toThrow(
      "不能重叠"
    );
  });
});

async function makeRoots() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-root-migration-"));
  temporaryRoots.push(root);
  return {
    dataRoot: path.join(root, "install", "data"),
    legacyDataRoot: path.join(root, "legacy")
  };
}

async function put(root: string, relativePath: string, contents: string) {
  const destination = path.join(root, relativePath);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, contents);
}
