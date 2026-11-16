import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { PYTHON312_ARCHIVES, PYTHON312_HELP, parsePython312Arguments } from "./prepare-python-312-runtime.mjs";
import { stripMacPythonWindowsLaunchers } from "./prepare-python-runtime.mjs";

test("Python 3.12 preparation pins native Apple Silicon archive metadata", () => {
  const source = PYTHON312_ARCHIVES["darwin-arm64"];
  assert.equal(source.url.includes("aarch64-apple-darwin"), true);
  assert.equal(source.bytes, 25_017_789);
  assert.equal(source.sha256, "c2edb321cd32ec2b170df208db0446dccc4398db602ca27cf2079098fb1f7d9d");
});

test("Python 3.12 preparation CLI supports help and pnpm's separator", () => {
  assert.deepEqual(parsePython312Arguments(["--help"]), { help: true });
  assert.match(PYTHON312_HELP, /Apple Silicon 固定归档/u);
  assert.deepEqual(parsePython312Arguments(["--", "--archive", "/tmp/python.tar.gz", "--stage", "/tmp/python-stage"]), {
    archivePath: "/tmp/python.tar.gz",
    stagingDirectory: "/tmp/python-stage"
  });
});

test("Python 3.12 preparation CLI rejects missing, duplicate, and unknown arguments", () => {
  assert.throws(() => parsePython312Arguments([]), /用法/u);
  assert.throws(() => parsePython312Arguments(["--archive", "archive"]), /用法/u);
  assert.throws(() => parsePython312Arguments(["--archive", "a", "--archive", "b", "--stage", "c"]), /无效/u);
  assert.throws(() => parsePython312Arguments(["--archive", "a", "--stage", "b", "--extra", "c"]), /用法/u);
  assert.throws(() => parsePython312Arguments(["--help", "--archive", "a"]), /无效/u);
});

test("Mac Python preparation removes bundled distlib Windows launchers but preserves Python source modules", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-python312-mac-launchers-"));
  t.after(async () => fs.rm(root, { recursive: true, force: true }));
  const distlib = path.join(root, "python/lib/python3.12/site-packages/pip/_vendor/distlib");
  await fs.mkdir(distlib, { recursive: true });
  const launchers = ["t32.exe", "t64.exe", "t64-arm.exe", "w32.exe", "w64.exe", "w64-arm.exe"];
  await Promise.all(launchers.map((name) => fs.writeFile(path.join(distlib, name), "Windows-only launcher")));
  await fs.writeFile(path.join(distlib, "popen_spawn_win32.py"), "# inert stdlib helper\n");

  await stripMacPythonWindowsLaunchers(root, "3.12");

  for (const name of launchers) await assert.rejects(fs.access(path.join(distlib, name)), { code: "ENOENT" });
  await assert.doesNotReject(fs.access(path.join(distlib, "popen_spawn_win32.py")));
});
