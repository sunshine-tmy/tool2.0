import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readCurrent, restoreCurrent, switchCurrent } from "../modules/components/package-generation";
import type { CurrentRecord, ComponentPackageManifest } from "../modules/components/types";

let root: string;
const record: CurrentRecord = {
  protocolVersion: 1,
  id: "fixture",
  version: "1.0.0",
  directory: "1.0.0",
  installedAt: "2026-01-01T00:00:00.000Z",
  manifestSha256: "a".repeat(64)
};
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "component-current-"));
});
afterEach(async () => {
  vi.restoreAllMocks();
  expect(path.dirname(root)).toBe(path.resolve(os.tmpdir()));
  expect(path.basename(root)).toMatch(/^component-current-/);
  await fs.rm(root, { recursive: true, force: true });
});
it.each([
  { protocolVersion: 2 },
  { id: "other" },
  { version: "../escaped" },
  { directory: "../escaped" },
  { installedBytes: -1 },
  { previousVersion: "/" },
  { installedAt: "not-a-date" },
  { manifestSha256: "bad" }
])("rejects an invalid current marker without changing it: %j", async (patch) => {
  const file = path.join(root, "current.json"),
    text = JSON.stringify({ ...record, ...patch });
  await fs.writeFile(file, text);
  expect(await readCurrent(root, "fixture")).toBeUndefined();
  expect(await fs.readFile(file, "utf8")).toBe(text);
});
it("accepts legacy optional fields and leaves missing/corrupt markers untouched", async () => {
  expect(await readCurrent(root, "fixture")).toBeUndefined();
  const file = path.join(root, "current.json");
  await fs.writeFile(file, "{invalid");
  expect(await readCurrent(root, "fixture")).toBeUndefined();
  expect(await fs.readFile(file, "utf8")).toBe("{invalid");
  await fs.writeFile(file, JSON.stringify(record));
  expect(await readCurrent(root, "fixture")).toEqual(record);
});
it.each(["switch", "restore"] as const)(
  "keeps the old marker and removes only its pending file when %s rename fails",
  async (operation) => {
    const file = path.join(root, "current.json"),
      before = JSON.stringify(record),
      failure = new Error("injected rename");
    await fs.writeFile(file, before);
    const rename = fs.rename.bind(fs);
    vi.spyOn(fs, "rename").mockImplementation((source, destination) =>
      String(destination) === file ? Promise.reject(failure) : rename(source, destination)
    );
    // The switch adapter only serializes the manifest; no download, verification or model task is invoked.
    const manifest: ComponentPackageManifest = {
      protocolVersion: 1,
      id: "fixture",
      moduleId: "fixture",
      groupId: "shared",
      displayName: "fixture",
      purpose: "fixture",
      dependencyIds: [],
      taskToolIds: [],
      installConditions: [],
      version: "2.0.0",
      platform: "win32-x64",
      archive: { url: "https://fixture.test/file.tar.gz", bytes: 1, sha256: "a".repeat(64), format: "tar.gz" },
      installedBytes: 1,
      files: [{ path: "fixture", bytes: 1, sha256: "b".repeat(64) }],
      sbom: { url: "https://fixture.test/sbom", sha256: "c".repeat(64) },
      keyId: "test",
      signature: "synthetic"
    };
    const work = operation === "switch" ? switchCurrent(root, manifest, "2.0.0", record) : restoreCurrent(root, record);
    await expect(work).rejects.toBe(failure);
    expect(await fs.readFile(file, "utf8")).toBe(before);
    expect(await fs.readdir(root)).toEqual(["current.json"]);
  }
);
it("restores exact marker bytes and removes only current when there was no previous generation", async () => {
  const previous = { ...record, installedBytes: 7, previousVersion: "0.9.0" };
  await restoreCurrent(root, previous);
  expect(await fs.readFile(path.join(root, "current.json"), "utf8")).toBe(JSON.stringify(previous, null, 2) + "\n");
  expect(await readCurrent(root, "fixture")).toEqual(previous);
  await fs.writeFile(path.join(root, "keep.bin"), "keep");
  await restoreCurrent(root);
  expect(await fs.readdir(root)).toEqual(["keep.bin"]);
});
