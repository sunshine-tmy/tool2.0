import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runLint } from "./lint.mjs";
import { listProjectFiles } from "./check-format.mjs";

test("lint keeps JS, TS, Vue and engineering tests, forwards options and preserves zero warning tolerance", () => {
  const files = [
    "source.ts",
    "new.vue",
    "script.mjs",
    "contract.test.js",
    "config.cjs",
    "fixture.json",
    "README.md",
    "worker.py"
  ];
  const calls = [];
  assert.equal(
    runLint({
      args: ["--fix"],
      listFiles: () => files,
      spawn: (...args) => {
        calls.push(args);
        return { status: 0 };
      }
    }),
    0
  );
  assert.deepEqual(calls[0][1].slice(1), ["--max-warnings", "0", "--fix", ...files.slice(0, 5)]);
  assert.equal(calls[0][2].windowsHide, true);
});

test("lint batches without losing files and reports errors, signals and spawn failures", () => {
  const files = Array.from({ length: 1000 }, (_, index) => `${"long-directory/".repeat(8)}file-${index}.ts`);
  const checked = [];
  assert.equal(
    runLint({
      listFiles: () => files,
      spawn: (_command, args) => {
        checked.push(...args.slice(3));
        return { status: 0 };
      }
    }),
    0
  );
  assert.deepEqual(checked, files);
  assert.equal(runLint({ listFiles: () => files, spawn: () => ({ status: 2 }) }), 2);
  assert.equal(runLint({ listFiles: () => files, spawn: () => ({ status: null }) }), 1);
  assert.throws(
    () => runLint({ listFiles: () => files, spawn: () => ({ error: new Error("spawn failed") }) }),
    /spawn failed/
  );
  assert.equal(
    runLint({
      listFiles: () => [],
      spawn: () => {
        throw new Error("must not spawn");
      }
    }),
    0
  );
});

test("real Git selection omits ignored local scratch files but still lints untracked and force-tracked source", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-lint-project-"));
  const git = (args) => execFileSync("git", args, { cwd: root, windowsHide: true, encoding: "utf8" });
  try {
    git(["init", "--quiet"]);
    await fs.writeFile(path.join(root, ".gitignore"), "output/playwright/**\n");
    await fs.writeFile(
      path.join(root, "eslint.config.mjs"),
      `export {default} from ${JSON.stringify(new URL("../../eslint.config.js", import.meta.url).href)};\n`
    );
    const scratch = path.join(root, "output/playwright");
    await fs.mkdir(scratch, { recursive: true });
    await fs.writeFile(path.join(scratch, "local.js"), "intentionally invalid javascript @@@");
    await fs.writeFile(path.join(root, "source.ts"), "export const value = 1;\n");
    const spawn = (command, args, options) => {
      // Preserve status while keeping expected negative-test diagnostics out of the test stream.
      return execLint(command, args, { ...options, stdio: "pipe" });
    };
    assert.ok(!listProjectFiles({ repositoryRoot: root }).some((file) => file.endsWith("local.js")));
    assert.equal(runLint({ repositoryRoot: root, spawn }), 0);
    await fs.writeFile(path.join(root, "new.vue"), '<script setup lang="ts">const value: any = 1;</script>');
    assert.equal(
      runLint({ repositoryRoot: root, spawn }),
      1,
      "untracked Vue source must retain no-explicit-any checks"
    );
    await fs.writeFile(path.join(root, "new.vue"), "<template><div>Valid</div></template>\n");
    assert.equal(runLint({ repositoryRoot: root, spawn }), 0);
    git(["add", "--force", "output/playwright/local.js"]);
    assert.ok(listProjectFiles({ repositoryRoot: root }).some((file) => file.endsWith("local.js")));
    assert.equal(runLint({ repositoryRoot: root, spawn }), 1, "Git ignore cannot conceal already tracked files");
  } finally {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith("toolbox-lint-project-"));
    await fs.rm(root, { recursive: true, force: true });
  }
});

function execLint(command, args, options) {
  try {
    execFileSync(command, args, options);
    return { status: 0 };
  } catch (error) {
    if (typeof error.status === "number") return { status: error.status };
    throw error;
  }
}
