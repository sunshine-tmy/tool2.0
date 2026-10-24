/** Start copied API output twice in a ZIP-like tree; reuse dependencies read-only, never user data. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

export async function smokeApiLayout(repoRoot, packaged = false) {
  const root = await mkdtemp(path.join(os.tmpdir(), "toolbox-api-layout-"));
  const project = path.join(root, "ZIP 项目 空间");
  const application = packaged ? path.join(project, "backend") : path.join(project, "apps", "api");
  const frontend = packaged ? path.join(project, "frontend") : path.join(project, "apps/web/dist");
  const cwd = path.join(root, "其他 工作目录");
  const dependencies = path.join(application, "node_modules");
  try {
    await mkdir(application, { recursive: true });
    await mkdir(cwd);
    await writeFile(path.join(project, "package.json"), '{"type":"module"}\n');
    await writeFile(path.join(project, ".env"), "DEPLOYMENT_MODE=local\n");
    await cp(path.join(repoRoot, "apps/api/dist"), path.join(application, "dist"), { recursive: true });
    await cp(path.join(repoRoot, "apps/web/dist"), frontend, { recursive: true });
    await symlink(
      path.join(repoRoot, "apps/api/node_modules"),
      dependencies,
      process.platform === "win32" ? "junction" : "dir"
    );
    const markers = ["storage/keep.bin", "offline-resources/components/keep.tar.gz", ".runtime/keep.bin"];
    for (const marker of markers) {
      await mkdir(path.dirname(path.join(project, marker)), { recursive: true });
      await writeFile(path.join(project, marker), "synthetic preservation sentinel");
    }
    // Only OS essentials are inherited, not user configuration, tokens or Worker overrides.
    const env = Object.fromEntries(
      Object.entries(process.env).filter(([key]) => /^(?:SystemRoot|WINDIR|COMSPEC|PATH|PATHEXT|TEMP|TMP)$/i.test(key))
    );
    env.NODE_ENV = "test";
    const configChunks = [];
    for (const name of await readdir(path.join(application, "dist"))) {
      if (
        /^chunk-.*\.js$/.test(name) &&
        (await readFile(path.join(application, "dist", name), "utf8")).includes("function getConfig(")
      )
        configChunks.push(name);
    }
    assert.equal(configChunks.length, 1);
    const code = `
      import assert from 'node:assert/strict';
      import { startBackend } from ${JSON.stringify(pathToFileURL(path.join(application, "dist/bootstrap.js")).href)};
      import { getConfig } from ${JSON.stringify(pathToFileURL(path.join(application, "dist", configChunks[0])).href)};
      const config = getConfig(${
        packaged
          ? JSON.stringify({
              layout: {
                appRoot: project,
                configRoot: project,
                storageRoot: path.join(project, "storage"),
                runtimeRoot: path.join(project, ".runtime"),
                modelsRoot: path.join(project, "models"),
                scriptsRoot: path.join(project, "scripts"),
                frontendDistRoot: frontend
              }
            })
          : ""
      });
      assert.equal(config.runtime.appRoot, ${JSON.stringify(project)});
      const backend = await startBackend({config, host:'127.0.0.1', port:0});
      try {
        const response = await fetch(backend.origin + '/health/ready');
        assert.equal(response.status, 200);
        assert.equal((await response.json()).data.status, 'ready');
        const page = await fetch(backend.origin + '/tools/image-ai', {headers:{accept:'text/html'}});
        assert.equal(page.status, 200);
        assert.ok((await page.text()).includes('id="app"'));
        const icon = await fetch(backend.origin + '/favicon-32x32.png');
        assert.equal(icon.status, 200);
        assert.ok(icon.headers.get('content-type').includes('image/png'));
      } finally { await backend.close(); }
    `;
    for (const phase of ["cold", "restart"]) {
      const result = spawnSync(process.execPath, ["--input-type=module", "-e", code], {
        cwd,
        env,
        encoding: "utf8",
        timeout: 30000,
        windowsHide: true
      });
      if (result.error) throw result.error;
      assert.equal(result.status, 0, `${phase}: ${result.stderr}\n${result.stdout}`);
      for (const marker of markers)
        assert.equal(await readFile(path.join(project, marker), "utf8"), "synthetic preservation sentinel");
      assert.ok(!(await readdir(project)).includes(".git"));
      assert.deepEqual(await readdir(cwd), []);
    }
  } finally {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith("toolbox-api-layout-"));
    // Unlink the known temporary junction first; never recurse through the dependency target.
    await unlink(dependencies).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
    await rm(root, { recursive: true, force: true });
  }
  console.log(
    `API layout smoke passed (${packaged ? "resources/backend + frontend" : "apps/api + apps/web"}): copied dist, cold/restart, no Git, foreign cwd, local resources preserved.`
  );
}
