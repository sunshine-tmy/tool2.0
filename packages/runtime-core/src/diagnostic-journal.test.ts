import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DiagnosticJournal } from "./diagnostic-journal";

const roots: string[] = [];
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "toolbox-r09-journal-"));
  roots.push(root);
  return root;
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  for (const root of roots.splice(0)) {
    expect(path.dirname(path.resolve(root))).toBe(path.resolve(os.tmpdir()));
    expect(path.basename(root)).toMatch(/^toolbox-r09-journal-/);
    fs.rmSync(root, { recursive: true, force: true });
  }
});
describe("shared Node diagnostic journal", () => {
  it("does not create data at construction and keeps explicit/inherited boot ID rules", () => {
    const directory = path.join(fixture(), "not-created");
    vi.stubEnv("TOOLBOX_BOOT_ID", "inherited-boot");
    expect(new DiagnosticJournal(directory).bootId).toBe("inherited-boot");
    expect(new DiagnosticJournal(directory, "explicit-boot").bootId).toBe("explicit-boot");
    expect(new DiagnosticJournal(directory, "unsafe/path").bootId).toMatch(/^[0-9a-f-]{36}$/);
    expect(fs.existsSync(directory)).toBe(false);
  });
  it("persists the original event envelope, rejecting unsafe phases/codes before I/O", () => {
    const root = fixture(),
      journal = new DiagnosticJournal(root, "boot");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-24T00:00:00.000Z"));
    journal.record("backend", "SERVICE_STARTING");
    journal.record("../private", "SERVICE_STARTING");
    journal.record("backend", "message with user text");
    expect(journal.events).toEqual([
      { at: "2026-10-24T00:00:00.000Z", bootId: "boot", phase: "backend", code: "SERVICE_STARTING" }
    ]);
    expect(fs.readFileSync(path.join(root, "diagnostics.jsonl"), "utf8")).toBe(
      JSON.stringify(journal.events[0]) + "\n"
    );
  });
  it("rotates only the existing two backups at the unchanged five-MiB boundary", () => {
    const root = fixture(),
      file = path.join(root, "diagnostics.jsonl");
    fs.writeFileSync(file, Buffer.alloc(5 * 1024 * 1024, 65));
    fs.writeFileSync(file + ".1", "previous");
    fs.writeFileSync(file + ".2", "oldest");
    new DiagnosticJournal(root, "boot").record("backend", "SERVICE_STARTING");
    expect(fs.readFileSync(file + ".2", "utf8")).toBe("previous");
    expect(fs.statSync(file + ".1").size).toBe(5 * 1024 * 1024);
    expect(JSON.parse(fs.readFileSync(file, "utf8")).code).toBe("SERVICE_STARTING");
  });
  it("retains at most 500 memory events even when the log directory is not writable", () => {
    const journal = new DiagnosticJournal(fixture(), "boot");
    vi.spyOn(fs, "appendFileSync").mockImplementation(() => {
      throw new Error("EACCES");
    });
    for (let index = 0; index < 501; index++) journal.record("backend", "CODE_" + index);
    expect(journal.events).toHaveLength(500);
    expect(journal.events[0].code).toBe("CODE_1");
    expect(journal.events.at(-1)?.code).toBe("CODE_500");
  });
  it("consumes both pipes without retaining raw output or matching partial error words", () => {
    const journal = new DiagnosticJournal(fixture(), "boot");
    journal.consume("backend", "private-token C:\\Users\\private HELLO_EACCES_SUFFIX");
    expect(journal.events).toEqual([]);
    for (const code of ["EACCES", "EPERM", "ENOSPC", "EADDRINUSE", "ECONNREFUSED", "CUDA_OUT_OF_MEMORY"])
      journal.consume("backend", Buffer.from("private-token " + code + " user text"));
    expect(journal.events.map((event) => event.code)).toEqual([
      "EACCES",
      "EPERM",
      "ENOSPC",
      "EADDRINUSE",
      "ECONNREFUSED",
      "CUDA_OUT_OF_MEMORY"
    ]);
    expect(JSON.stringify(journal.events)).not.toMatch(/private-token|user text|Users/);
  });
});
