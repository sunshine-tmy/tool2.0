/** Compiled helper in a copied resources layout. The parent-port transport is emulated; no Electron installer or user data. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

export async function smokeDataBackup(repoRoot) {
  const root = await mkdtemp(path.join(os.tmpdir(), "toolbox-backup-dist-"));
  const resources = path.join(root, "分发 资源"),
    backend = path.join(resources, "backend"),
    dependencies = path.join(backend, "node_modules");
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => /^(?:SystemRoot|WINDIR|COMSPEC|PATH|PATHEXT|TEMP|TMP)$/i.test(key))
  );
  env.NODE_ENV = "production";
  const layout = (name) => ({
    appRoot: resources,
    configRoot: path.join(root, name, "config"),
    storageRoot: path.join(root, name, "data"),
    runtimeRoot: path.join(root, name, "components"),
    modelsRoot: path.join(root, name, "models"),
    scriptsRoot: path.join(resources, "scripts"),
    frontendDistRoot: path.join(resources, "frontend")
  });
  const source = layout("来源"),
    target = layout("目标");
  function node(code, extra = {}) {
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", code], {
      cwd: root,
      env: { ...env, ...extra },
      encoding: "utf8",
      timeout: 30000,
      windowsHide: true
    });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
    return result.stdout;
  }
  function helper(runtime, command) {
    const output = node(
      `
      let listener;
      process.parentPort = {
        on: (_event, callback) => { listener = callback; },
        postMessage: message => {
          if (message.type === 'ready') queueMicrotask(() => listener({data: {type: 'run', command: ${JSON.stringify(command)}}}));
          if (message.type === 'result') console.log('BACKUP_RESULT ' + JSON.stringify(message.result));
          if (message.type === 'error') console.error(message.message);
        }
      };
      await import(${JSON.stringify(pathToFileURL(path.join(backend, "dist/data-backup-entry.js")).href)});
    `,
      {
        TOOLBOX_RUNTIME_LAYOUT: JSON.stringify(runtime),
        TOOLBOX_APP_VERSION: "fixture",
        DATABASE_PATH: path.join(runtime.storageRoot, "toolbox.db")
      }
    );
    const result = output.split(/\r?\n/).find((line) => line.startsWith("BACKUP_RESULT "));
    assert.ok(result, "helper must return a result before exiting");
    return JSON.parse(result.slice(14));
  }
  try {
    await mkdir(backend, { recursive: true });
    await cp(path.join(repoRoot, "apps/api/dist"), path.join(backend, "dist"), { recursive: true });
    await symlink(
      path.join(repoRoot, "apps/api/node_modules"),
      dependencies,
      process.platform === "win32" ? "junction" : "dir"
    );
    const chunks = [];
    for (const file of await readdir(path.join(backend, "dist")))
      if (
        /^chunk-.*\.js$/.test(file) &&
        (await readFile(path.join(backend, "dist", file), "utf8")).includes("function getConfig(")
      )
        chunks.push(file);
    assert.equal(chunks.length, 1);
    const appPrelude = (runtime) => `
      import assert from 'node:assert/strict';
      import {createApp} from ${JSON.stringify(pathToFileURL(path.join(backend, "dist/app.js")).href)};
      import {getConfig} from ${JSON.stringify(pathToFileURL(path.join(backend, "dist", chunks[0])).href)};
      const app = await createApp({config: getConfig({layout: ${JSON.stringify(runtime)}, dotenvPath: false, desktopManagedCapabilities: true, environment: {NODE_ENV:'production', DEPLOYMENT_MODE:'local', LOG_LEVEL:'silent'}})});
    `;
    node(
      appPrelude(source) +
        `
      try {
        const response = await app.inject({method:'POST', url:'/api/v1/tools/lan-transfer/notes', headers:{'content-type':'multipart/form-data; boundary=backup_fixture'}, payload:${JSON.stringify('--backup_fixture\r\nContent-Disposition: form-data; name="content"\r\n\r\nportable note\r\n--backup_fixture--\r\n')}});
        assert.equal(response.statusCode, 200, response.body);
      } finally { await app.close(); }
    `
    );
    node(appPrelude(target) + "await app.close();");
    const id = crypto.randomUUID(),
      file = path.join(root, "离线 备份.zip");
    const modules = ["image-compress", "image-ai", "speech", "audio-library", "content-archive", "lan-transfer"];
    const exported = helper(source, { action: "snapshot", id, selection: { modules } });
    assert.equal(exported.length, 6);
    helper(source, { action: "pack", id, file });
    helper(target, { action: "recover", id: crypto.randomUUID() });
    assert.equal(helper(target, { action: "inspect", id: crypto.randomUUID(), file }).length, 6);
    const preview = helper(target, {
      action: "preview",
      id: crypto.randomUUID(),
      file,
      modules: ["lan-transfer"],
      mode: "replace"
    });
    const restored = helper(target, { action: "restore", id: crypto.randomUUID(), planId: preview.planId });
    node(
      appPrelude(target) +
        `try { const result = await app.inject({method:'GET',url:'/api/v1/tools/lan-transfer/notes'}); assert.equal(result.statusCode,200); assert.equal(result.json().data.notes[0].content,'portable note'); } finally { await app.close(); }`
    );
    helper(target, { action: "rollback", id: crypto.randomUUID(), restorePointId: restored.restorePointId });
    node(
      appPrelude(target) +
        `try { const result = await app.inject({method:'GET',url:'/api/v1/tools/lan-transfer/notes'}); assert.equal(result.json().data.notes.length,0); } finally { await app.close(); }`
    );
  } finally {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith("toolbox-backup-dist-"));
    await unlink(dependencies).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
    await rm(root, { recursive: true, force: true });
  }
  console.log(
    "Data backup dist smoke passed: copied helper, six-module export, selective restore, real startup/read, rollback, foreign cwd; parent port emulated."
  );
}
