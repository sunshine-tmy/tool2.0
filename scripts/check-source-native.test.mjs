/** 原生依赖必须使用随包预编译文件，不得隐式要求干净机器安装 Python/MSVC。 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { checkSourceNative } from "./check-source-native.mjs";

test("SQLite installation uses shipped prebuilds without disabling other dependency scripts", async () => {
  const workspace = await fs.readFile(new URL("../pnpm-workspace.yaml", import.meta.url), "utf8");
  assert.match(workspace, /better-sqlite3: false/);
  assert.doesNotMatch(workspace, /^\s*- better-sqlite3\s*$/m);
  for (const name of ["electron", "esbuild", "sharp"]) assert.match(workspace, new RegExp(`${name}: true`));
  const requireBackend = createRequire(new URL("../apps/api/package.json", import.meta.url));
  const sqlite = requireBackend("better-sqlite3/package.json");
  assert.match(sqlite.version, /^13\./);
  assert.equal(sqlite.gypfile, false);
});

test("real SQLite writes/reads and Sharp PNG work without accessing business files", async () => {
  await checkSourceNative();
});

test("a missing native module is not reported as ready", async () => {
  await assert.rejects(
    checkSourceNative(() => {
      throw new Error("native binary missing");
    }),
    /native binary missing/
  );
});

test(
  "clean pnpm installation recovers from implicit node-gyp without Python",
  {
    skip: !process.env.TOOLBOX_TEST_PNPM_CLI || process.platform !== "win32",
    timeout: 180_000
  },
  async () => {
    const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-native-install-"));
    const cwd = path.join(scratch, "tool2.0-main (2)");
    try {
      await fs.mkdir(cwd);
      // Repack installed upstream files into local tarballs: exercise a fresh store without
      // relying on registry availability, global Python, or an existing native build cache.
      const requireBackend = createRequire(new URL("../apps/api/package.json", import.meta.url));
      const sqliteRoot = path.dirname(requireBackend.resolve("better-sqlite3/package.json"));
      const requireSqlite = createRequire(path.join(sqliteRoot, "package.json"));
      const addonRoot = path.dirname(requireSqlite.resolve("node-addon-api/package.json"));
      const tar = requireBackend("tar");
      await tar.c({ gzip: true, prefix: "package", file: path.join(cwd, "sqlite.tgz"), cwd: sqliteRoot }, [
        "package.json",
        "binding.gyp",
        "lib",
        "prebuilds",
        "deps",
        "src"
      ]);
      const addonFiles = (await fs.readdir(addonRoot)).filter((name) => name !== "node_modules" && name !== "build");
      await tar.c({ gzip: true, prefix: "package", file: path.join(cwd, "addon.tgz"), cwd: addonRoot }, addonFiles);
      await fs.writeFile(
        path.join(cwd, "package.json"),
        JSON.stringify({
          name: "native-install-fixture",
          private: true,
          packageManager: "pnpm@11.7.0",
          dependencies: { "better-sqlite3": "file:./sqlite.tgz" }
        })
      );
      const workspace = path.join(cwd, "pnpm-workspace.yaml");
      const execute = () =>
        spawnSync(
          process.execPath,
          [
            process.env.TOOLBOX_TEST_PNPM_CLI,
            "install",
            "--store-dir",
            path.join(scratch, "store"),
            "--reporter=append-only",
            "--offline"
          ],
          {
            cwd,
            encoding: "utf8",
            timeout: 80_000,
            windowsHide: true,
            env: { ...process.env, CI: "true", NODE_GYP_FORCE_PYTHON: path.join(scratch, "no-system-python.exe") }
          }
        );
      // pnpm identifies local-tarball build approvals by their full dep path.
      const fixtureConfig =
        "packages:\n  - .\noverrides:\n  node-addon-api: file:./addon.tgz\nallowBuilds:\n  'better-sqlite3@file:sqlite.tgz': ";
      await fs.writeFile(workspace, fixtureConfig + "true\n");
      const before = execute();
      assert.notEqual(before.status, 0, "old build policy must expose the clean-machine failure");
      assert.match(before.stdout + before.stderr, /node-gyp/);
      assert.match(before.stdout + before.stderr, /Python/);
      await fs.writeFile(workspace, fixtureConfig + "false\n");
      const after = execute();
      assert.equal(after.status, 0, after.stdout + after.stderr);
      const smoke = spawnSync(
        process.execPath,
        [
          "-e",
          "const D=require('better-sqlite3');const db=new D(':memory:');if(db.prepare('SELECT 42 AS n').get().n!==42)process.exit(1);db.close();console.log('clean SQLite ready')"
        ],
        { cwd, encoding: "utf8", windowsHide: true }
      );
      assert.equal(smoke.status, 0, smoke.stderr);
      assert.match(smoke.stdout, /clean SQLite ready/);
    } finally {
      await fs.rm(scratch, { recursive: true, force: true });
    }
  }
);
