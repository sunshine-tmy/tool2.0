/** Real Vite config/server in a synthetic ZIP tree; no user configuration or dependency installation. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

export async function smokeWebLayout(repoRoot) {
  const root = await mkdtemp(path.join(os.tmpdir(), "toolbox-web-layout-"));
  const project = path.join(root, "ZIP 项目 空间");
  const application = path.join(project, "apps/web");
  const cwd = path.join(root, "其他 工作目录");
  const dependencies = path.join(application, "node_modules");
  try {
    await mkdir(application, { recursive: true });
    await mkdir(cwd);
    await writeFile(path.join(project, "package.json"), '{"type":"module"}\n');
    await cp(path.join(repoRoot, "pnpm-workspace.yaml"), path.join(project, "pnpm-workspace.yaml"));
    for (const entry of ["src", "public", "index.html", "package.json", "vite.config.ts", "tooling"])
      await cp(path.join(repoRoot, "apps/web", entry), path.join(application, entry), { recursive: true });
    await cp(path.join(repoRoot, "packages/shared/src"), path.join(project, "packages/shared/src"), {
      recursive: true
    });
    await symlink(
      path.join(repoRoot, "apps/web/node_modules"),
      dependencies,
      process.platform === "win32" ? "junction" : "dir"
    );
    const vite = createRequire(path.join(repoRoot, "apps/web/package.json")).resolve("vite");
    const env = Object.fromEntries(
      Object.entries(process.env).filter(([key]) => /^(?:SystemRoot|WINDIR|COMSPEC|PATH|PATHEXT|TEMP|TMP)$/i.test(key))
    );
    const code = String.raw`
      import assert from 'node:assert/strict';
      import http from 'node:http';
      import fs from 'node:fs/promises';
      import path from 'node:path';
      import { createServer } from ${JSON.stringify(pathToFileURL(vite).href)};
      const project = ${JSON.stringify(project)};
      const application = ${JSON.stringify(application)};
      async function freePort() {
        const probe = http.createServer();
        await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));
        const port = probe.address().port;
        await new Promise(resolve=>probe.close(resolve));
        return port;
      }
      const api = http.createServer((request,response) => {
        response.setHeader('content-type','application/json');
        response.end(JSON.stringify({url:request.url, forwarded:request.headers['x-forwarded-for']}));
      });
      await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
      try {
        const port = api.address().port;
        await fs.writeFile(path.join(project,'.env'),'API_PORT='+port+'\nVITE_DEV_HOST=127.0.0.1\nVITE_DEV_PORT=0\n');
        await fs.writeFile(path.join(project,'.env.local'),'VITE_LAYOUT_SENTINEL=mode-local\n');
        for (const phase of ['cold','restart']) {
          const web = await createServer({
            root:application, configFile:path.join(application,'vite.config.ts'),
            cacheDir:path.join(project,'.vite-isolated'), logLevel:'error',
            optimizeDeps:{noDiscovery:true,include:[]},
            server:{watch:null,preTransformRequests:false}
          });
          try {
            assert.equal(path.resolve(web.config.envDir),project);
            assert.equal(web.config.server.host,'127.0.0.1');
            assert.equal(web.config.server.strictPort,true);
            assert.equal(web.config.server.proxy['/api'].target,'http://127.0.0.1:'+port);
            assert.equal(web.config.server.proxy['/api'].xfwd,true);
            assert.equal(web.config.env.VITE_LAYOUT_SENTINEL,'mode-local');
            // Vite treats config port=0 as its default; reserve an explicit ephemeral port instead.
            await web.listen(await freePort());
            const origin = 'http://127.0.0.1:'+web.httpServer.address().port;
            const page = await fetch(origin+'/tools/image-ai');
            assert.equal(page.status,200);
            assert.ok((await page.text()).includes('/src/main.ts'));
            const source = await fetch(origin+'/src/main.ts');
            assert.equal(source.status,200);
            assert.ok((await source.text()).includes('createApp'));
            const proxy = await fetch(origin+'/api/layout-smoke');
            assert.equal(proxy.status,200);
            const payload = await proxy.json();
            assert.equal(payload.url,'/api/layout-smoke');
            assert.ok(payload.forwarded.includes('127.0.0.1'));
          } finally { await web.close(); }
        }
        assert.ok(!(await fs.readdir(project)).includes('.git'));
        assert.deepEqual(await fs.readdir(${JSON.stringify(cwd)}),[]);
      } finally { await new Promise(resolve=>api.close(resolve)); }
    `;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", code], {
      cwd,
      env,
      encoding: "utf8",
      timeout: 45000,
      windowsHide: true
    });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
  } finally {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith("toolbox-web-layout-"));
    await unlink(dependencies).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
    await rm(root, { recursive: true, force: true });
  }
  console.log(
    "Web layout smoke passed: real Vite cold/restart, ZIP without Git, foreign cwd, root env and API forwarding."
  );
}
