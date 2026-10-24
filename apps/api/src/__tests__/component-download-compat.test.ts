import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { downloadComponentArchive, type ComponentPackageManifest } from "../modules/components/component-manager";

let root: string;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "component-download-compat-"));
});
afterEach(async () => {
  expect(path.dirname(root)).toBe(path.resolve(os.tmpdir()));
  expect(path.basename(root)).toMatch(/^component-download-compat-/);
  await fs.rm(root, { recursive: true, force: true });
});
function manifest(bytes: number): ComponentPackageManifest {
  return {
    protocolVersion: 1,
    id: "fixture",
    moduleId: "fixture",
    groupId: "shared",
    displayName: "fixture",
    purpose: "synthetic transport test",
    dependencyIds: [],
    taskToolIds: [],
    installConditions: [],
    version: "1.0.0",
    platform: "win32-x64",
    archive: { url: "https://fixture.test/archive.tar.gz", bytes, sha256: "a".repeat(64), format: "tar.gz" },
    installedBytes: 1,
    files: [{ path: "fixture", bytes: 1, sha256: "b".repeat(64) }],
    sbom: { url: "https://fixture.test/sbom", sha256: "c".repeat(64) },
    keyId: "test",
    signature: "synthetic"
  };
}
it.each(["short", "long"])(
  "rejects a %s full-response fallback and removes only its partial destination",
  async (kind) => {
    const destination = path.join(root, "archive.partial");
    const body = Buffer.from(kind === "short" ? "123" : "123456");
    await expect(
      downloadComponentArchive(manifest(5), destination, {}, async () => new Response(body))
    ).rejects.toMatchObject({ code: "COMPONENT_INSTALL_FAILED" });
    await expect(fs.access(destination)).rejects.toMatchObject({ code: "ENOENT" });
  }
);
it("keeps the first-range 200 fallback and exact streamed progress", async () => {
  const destination = path.join(root, "archive.partial"),
    onProgress = vi.fn();
  const fetcher = vi.fn(async (_url: string | URL, init?: RequestInit) => {
    expect(new Headers(init?.headers).get("range")).toBe("bytes=0-2");
    return new Response(Buffer.from("123"), { headers: { "content-length": "3" } });
  });
  await downloadComponentArchive(manifest(3), destination, { onProgress }, fetcher);
  expect(await fs.readFile(destination, "utf8")).toBe("123");
  expect(fetcher).toHaveBeenCalledOnce();
  expect(onProgress).toHaveBeenLastCalledWith(3);
});
it("does not request an already-cancelled download or retain a new destination", async () => {
  const destination = path.join(root, "archive.partial"),
    fetcher = vi.fn();
  await expect(
    downloadComponentArchive(manifest(3), destination, { signal: AbortSignal.abort() }, fetcher)
  ).rejects.toThrow("download cancelled");
  expect(fetcher).not.toHaveBeenCalled();
  await expect(fs.access(destination)).rejects.toMatchObject({ code: "ENOENT" });
});
