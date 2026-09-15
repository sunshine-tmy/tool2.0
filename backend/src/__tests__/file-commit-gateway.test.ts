import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { commitStagedFile, createStagingPath, writeAtomicFile } from "../storage/file-commit-gateway";

let root: string | undefined;

afterEach(async () => {
  if (root) await fsp.rm(root, { recursive: true, force: true });
  root = undefined;
});

describe("file commit gateway", () => {
  it("writes buffers and streams through same-directory staging", async () => {
    root = await fsp.mkdtemp(path.join(os.tmpdir(), "toolbox-atomic-"));
    const target = path.join(root, "nested", "result.bin");
    await writeAtomicFile(target, Buffer.from("first"), "one");
    await writeAtomicFile(target, Readable.from([Buffer.from("second")]), "two");

    expect(await fsp.readFile(target, "utf8")).toBe("second");
    expect(await fsp.readdir(path.dirname(target))).toEqual(["result.bin"]);
  });

  it("rejects cross-directory commits and leaves the staged file available for recovery", async () => {
    root = await fsp.mkdtemp(path.join(os.tmpdir(), "toolbox-atomic-"));
    const staging = path.join(root, "staged.bin");
    const target = path.join(root, "nested", "target.bin");
    await fsp.writeFile(staging, "pending");

    await expect(commitStagedFile(staging, target)).rejects.toThrow("share the target directory");
    expect(await fsp.readFile(staging, "utf8")).toBe("pending");
    expect(createStagingPath(target, "abc")).toBe(path.join(root, "nested", ".target.bin.staging-abc"));
  });
});
