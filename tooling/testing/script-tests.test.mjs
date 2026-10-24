import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { discoverScriptTests, runScriptTests } from "./script-tests.mjs";
import { readBootstrapArchives } from "../source/bootstrap-pins.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));

async function fixture(run) {
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-script-tests-"));
  try {
    for (const directory of ["scripts/nested", "tooling/testing", "apps/desktop/scripts"])
      await fs.mkdir(path.join(scratch, directory), { recursive: true });
    return await run(scratch);
  } finally {
    await fs.rm(scratch, { recursive: true, force: true });
  }
}

test("discovers nested Node tests across engineering owners without collecting smoke commands or Python/model tests", () =>
  fixture(async (scratch) => {
    for (const file of [
      "scripts/a.test.mjs",
      "scripts/nested/b.test.mjs",
      "tooling/testing/c.test.mjs",
      "apps/desktop/scripts/d.test.mjs",
      "scripts/test-model.mjs",
      "scripts/worker.test.py",
      "scripts/model.test.ts"
    ])
      await fs.writeFile(path.join(scratch, file), "throw new Error('discovery must never import this file');\n");
    assert.deepEqual(discoverScriptTests(scratch), [
      "apps/desktop/scripts/d.test.mjs",
      "scripts/a.test.mjs",
      "scripts/nested/b.test.mjs",
      "tooling/testing/c.test.mjs"
    ]);
  }));

test("runner refuses empty collection, forwards Node test arguments and preserves child failure or signal", () =>
  fixture(async (scratch) => {
    assert.throws(() => runScriptTests(scratch), /No engineering tests/);
    await fs.writeFile(path.join(scratch, "scripts/a.test.mjs"), "");
    const calls = [];
    const spawn = (...args) => {
      calls.push(args);
      return { status: 7 };
    };
    assert.equal(runScriptTests(scratch, ["--test-name-pattern=Chinese space"], spawn), 7);
    assert.deepEqual(calls[0][1], ["--test", "--test-name-pattern=Chinese space", "scripts/a.test.mjs"]);
    assert.equal(calls[0][2].cwd, scratch);
    assert.equal(calls[0][2].windowsHide, true);
    assert.equal(
      runScriptTests(scratch, [], () => ({ status: null, signal: "SIGTERM" })),
      1
    );
    assert.throws(
      () => runScriptTests(scratch, [], () => ({ error: new Error("cannot start test runner") })),
      /cannot start/
    );
  }));

test("all previous engineering test files and separately invoked contract/architecture/runner tests remain discovered", async () => {
  const files = discoverScriptTests(root);
  const scripts = (await fs.readdir(path.join(root, "scripts")))
    .filter((name) => name.endsWith(".test.mjs"))
    .map((name) => "scripts/" + name);
  for (const file of scripts) assert.ok(files.includes(file), file);
  assert.ok(files.includes("apps/desktop/scripts/smoke-installed-desktop.test.mjs"));
  assert.ok(files.includes("tooling/testing/script-tests.test.mjs"));
  assert.equal(files.length, new Set(files).size);
});

test("bootstrap documentation and resource metadata derive exact pins from PowerShell rather than parallel literals", async () => {
  const shell = (await fs.readFile(path.join(root, "tooling/source/bootstrap-windows.ps1"), "utf8")).replaceAll(
    "\r\n",
    "\n"
  );
  const plan = JSON.parse(await fs.readFile(path.join(root, "scripts/source-resources.generated.json"), "utf8"));
  assert.deepEqual(readBootstrapArchives(shell), plan.bootstrap);
  assert.throws(() => readBootstrapArchives(shell.replace("$NodeVersion =", "$Other =")), /NodeVersion/);
  assert.throws(() => readBootstrapArchives(shell + "\n$NodeVersion = '24.22.1'\n"), /NodeVersion/);
  assert.throws(
    () => readBootstrapArchives(shell.replace(/\$NodeHash = '[^']+'/g, "$NodeHash = 'invalid'")),
    /NodeHash/
  );
  assert.throws(
    () => readBootstrapArchives(shell.replace(/\$PnpmHash = '[^']+'/g, "$PnpmHash = 'invalid'")),
    /PnpmHash/
  );
});
