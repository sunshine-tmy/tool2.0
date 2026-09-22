import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { desktopSettingsPath, readDesktopSettings, updateDesktopSettings } from "./desktop-settings";

let root: string | undefined;

afterEach(async () => {
  if (root) await fs.rm(root, { recursive: true, force: true });
  root = undefined;
});

describe("desktop settings", () => {
  it("creates explicit safe defaults without writing until the user changes a setting", async () => {
    const configRoot = await createConfigRoot();
    await expect(readDesktopSettings(configRoot)).resolves.toMatchObject({
      schemaVersion: 1,
      startAtLogin: false,
      automaticUpdateChecks: true
    });
    await expect(fs.access(desktopSettingsPath(configRoot))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("atomically persists only the supported desktop preferences and migration summary", async () => {
    const configRoot = await createConfigRoot();
    const settings = await updateDesktopSettings(configRoot, {
      startAtLogin: true,
      automaticUpdateChecks: false,
      lastMigration: {
        id: "a".repeat(24),
        status: "imported",
        completedAt: "2026-09-22T00:00:00.000Z",
        files: 3,
        bytes: 42
      }
    });
    expect(settings).toMatchObject({ startAtLogin: true, automaticUpdateChecks: false });
    await expect(readDesktopSettings(configRoot)).resolves.toMatchObject({
      startAtLogin: true,
      automaticUpdateChecks: false,
      lastMigration: { id: "a".repeat(24), files: 3, bytes: 42 }
    });
    expect((await fs.readdir(configRoot)).filter((name) => name.endsWith(".tmp"))).toEqual([]);
  });

  it("refuses malformed persisted settings instead of silently changing user intent", async () => {
    const configRoot = await createConfigRoot();
    await fs.mkdir(configRoot, { recursive: true });
    await fs.writeFile(desktopSettingsPath(configRoot), '{"schemaVersion":1,"startAtLogin":"yes"}', "utf8");
    await expect(readDesktopSettings(configRoot)).rejects.toThrow("桌面设置文件无效");
  });
});

async function createConfigRoot() {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-desktop-settings-"));
  return path.join(root, "config");
}
