/** Relocated, dist-only consumer: no source tree, .git, .env or workspace links. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

export async function smokeRuntimeCore(repoRoot) {
  const root = await mkdtemp(path.join(os.tmpdir(), "toolbox-runtime-core-smoke-"));
  try {
    const consumer = path.join(root, "其他 工作目录");
    const installed = path.join(consumer, "node_modules", "@toolbox", "runtime-core");
    await mkdir(installed, { recursive: true });
    const packageRoot = path.join(repoRoot, "packages", "runtime-core");
    await cp(path.join(packageRoot, "package.json"), path.join(installed, "package.json"));
    await cp(path.join(packageRoot, "dist"), path.join(installed, "dist"), { recursive: true });
    await readFile(path.join(installed, "dist", "index.d.ts"), "utf8");
    const before = await readdir(consumer);
    const result = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `
      import assert from 'node:assert/strict';
      import path from 'node:path';
      import { createRuntimeLayout, resolveRuntimePath, parseDotEnv, readInteger, DiagnosticJournal } from '@toolbox/runtime-core';
      const journal = new DiagnosticJournal(path.resolve('must-not-create-at-import'), 'isolated-boot');
      assert.equal(journal.bootId, 'isolated-boot');
      assert.deepEqual(journal.events, []);
      const appRoot = path.resolve('显式 应用');
      const layout = createRuntimeLayout({ appRoot });
      assert.deepEqual(layout, {
        appRoot, configRoot: appRoot, storageRoot: path.join(appRoot, 'storage'),
        runtimeRoot: path.join(appRoot, '.runtime'), modelsRoot: path.join(appRoot, 'models'),
        scriptsRoot: path.join(appRoot, 'scripts'), frontendDistRoot: path.join(appRoot, 'frontend', 'dist')
      });
      assert.equal(resolveRuntimePath(layout.configRoot, '媒体 文件'), path.join(appRoot, '媒体 文件'));
      assert.equal(parseDotEnv('API_PORT="4321"').API_PORT, '4321');
      assert.equal(readInteger('API_PORT', '4321', 3100, 1, 65535), 4321);
    `
      ],
      { cwd: consumer, encoding: "utf8", timeout: 30000 }
    );
    if (result.error) throw result.error;
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(await readdir(consumer), before, "Importing/calculating paths must not create writable data");

    // Default-root cases run in smokeProjectRoot's synthetic tree, never against a user's legacy roots.
    // Here the actual built app must still honor an explicit layout.
    const backendDist = path.join(repoRoot, "apps", "api", "dist");
    const chunks = (await readdir(backendDist)).filter((name) => /^chunk-.*\.js$/.test(name));
    const configChunks = [];
    for (const name of chunks) {
      const file = path.join(backendDist, name);
      if ((await readFile(file, "utf8")).includes("function getConfig(")) configChunks.push(file);
    }
    assert.equal(configChunks.length, 1, "Expected one built configuration implementation");
    const { getConfig } = await import(pathToFileURL(configChunks[0]).href);
    const explicit = path.join(root, "应用 资源");
    const { createRuntimeLayout } = await import(pathToFileURL(path.join(installed, "dist", "index.js")).href);
    const layout = createRuntimeLayout({ appRoot: explicit });
    assert.equal(getConfig({ layout, dotenvPath: false, environment: { NODE_ENV: "test" } }).runtime.appRoot, explicit);
    console.log("Runtime core dist smoke passed: isolated consumer, explicit paths, corrected compiled anchor.");
    return getConfig;
  } finally {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith("toolbox-runtime-core-smoke-"));
    await rm(root, { recursive: true, force: true });
  }
}
