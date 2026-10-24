import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fileExists, replaceFile } from "../domains/speech/shared/file-replacement";

let root: string;
let source: string;
let target: string;
let backup: string;
beforeEach(async () => {
  root = await fsp.mkdtemp(path.join(os.tmpdir(), "toolbox-speech-replace-"));
  source = path.join(root, "new.tmp");
  target = path.join(root, "audio.mp3");
  backup = `${target}.backup`;
  await fsp.writeFile(source, "new");
  await fsp.writeFile(target, "old");
});
afterEach(async () => {
  vi.restoreAllMocks();
  if (!root) return;
  expect(path.dirname(root)).toBe(path.resolve(os.tmpdir()));
  expect(path.basename(root)).toMatch(/^toolbox-speech-replace-/);
  await fsp.rm(root, { recursive: true, force: true });
});

describe("speech backup replacement semantics", () => {
  it("replaces the target and discards only the obsolete backup", async () => {
    await fsp.writeFile(backup, "stale");
    await replaceFile(source, target);
    expect(await fsp.readFile(target, "utf8")).toBe("new");
    expect(await fsp.readdir(root)).toEqual(["audio.mp3"]);
  });

  it("supports a first write without an existing target", async () => {
    await fsp.rm(target);
    await replaceFile(source, target);
    expect(await fsp.readFile(target, "utf8")).toBe("new");
    expect(await fileExists(backup)).toBe(false);
    expect(await fileExists(source)).toBe(false);
  });

  it("restores the old target when the staged source is absent", async () => {
    await fsp.rm(source);
    await expect(replaceFile(source, target)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await fsp.readFile(target, "utf8")).toBe("old");
    expect(await fileExists(backup)).toBe(false);
  });

  it("does not create a target or backup when both target and source are absent", async () => {
    await fsp.rm(source);
    await fsp.rm(target);
    await expect(replaceFile(source, target)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await fsp.readdir(root)).toEqual([]);
  });

  it("preserves source and target when backing up the target fails", async () => {
    const rename = fsp.rename.bind(fsp);
    const error = new Error("backup rename failed");
    vi.spyOn(fsp, "rename").mockImplementation(async (from, to) => {
      if (from === target && to === backup) throw error;
      return rename(from, to);
    });
    await expect(replaceFile(source, target)).rejects.toBe(error);
    expect(await fsp.readFile(source, "utf8")).toBe("new");
    expect(await fsp.readFile(target, "utf8")).toBe("old");
  });

  it("restores the old target if final backup removal fails", async () => {
    const remove = fsp.rm.bind(fsp);
    const error = new Error("final backup cleanup failed");
    let attempts = 0;
    vi.spyOn(fsp, "rm").mockImplementation(async (file, options) => {
      if (file === backup && ++attempts === 2) throw error;
      return remove(file, options);
    });
    await expect(replaceFile(source, target)).rejects.toBe(error);
    expect(await fsp.readFile(target, "utf8")).toBe("old");
    expect(await fileExists(source)).toBe(false);
    expect(await fileExists(backup)).toBe(false);
  });

  it("keeps the recoverable backup and existing error precedence if restoration fails", async () => {
    await fsp.rm(source);
    const rename = fsp.rename.bind(fsp);
    const recoveryError = new Error("restore failed");
    vi.spyOn(fsp, "rename").mockImplementation(async (from, to) => {
      if (from === backup && to === target) throw recoveryError;
      return rename(from, to);
    });
    await expect(replaceFile(source, target)).rejects.toBe(recoveryError);
    expect(await fsp.readFile(backup, "utf8")).toBe("old");
    expect(await fileExists(target)).toBe(false);
  });

  it("does not attempt restoration when the backup cannot be observed", async () => {
    const stat = fsp.stat.bind(fsp);
    vi.spyOn(fsp, "stat").mockImplementation((...args) => {
      if (args[0] === backup) return Promise.reject(new Error("backup stat failed"));
      return stat(...args);
    });
    await fsp.rm(source);
    await expect(replaceFile(source, target)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await fsp.readFile(backup, "utf8")).toBe("old");
    expect(await fileExists(target)).toBe(false);
  });

  it("retains file-only existence checks and maps stat failures to false", async () => {
    expect(await fileExists(source)).toBe(true);
    expect(await fileExists(root)).toBe(false);
    expect(await fileExists(path.join(root, "absent"))).toBe(false);
    vi.spyOn(fsp, "stat").mockRejectedValue(new Error("stat denied"));
    expect(await fileExists(source)).toBe(false);
  });
});
