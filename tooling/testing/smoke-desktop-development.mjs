/** Uses the actual desktop development layout with built Web/API files and an isolated writable root. */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createDesktopRuntimeLayout } from "../../apps/desktop/src/runtime-layout.ts";

export async function smokeDesktopDevelopment(repoRoot, getConfig) {
  const root = await mkdtemp(path.join(os.tmpdir(), "toolbox-desktop-dev-layout-"));
  let app;
  try {
    const layout = createDesktopRuntimeLayout({ packaged: false, userDataRoot: root });
    assert.equal(layout.appRoot, path.resolve(repoRoot));
    for (const key of ["configRoot", "storageRoot", "runtimeRoot", "modelsRoot"]) {
      const relative = path.relative(root, layout[key]);
      assert.ok(!path.isAbsolute(relative) && !relative.split(path.sep).includes(".."));
    }
    const backend = await import(pathToFileURL(path.join(repoRoot, "apps/api/dist/app.js")).href);
    app = await backend.createApp({
      config: getConfig({
        layout,
        dotenvPath: false,
        desktopManagedCapabilities: true,
        environment: { NODE_ENV: "test", DATABASE_PATH: ":memory:" }
      })
    });
    const page = await app.inject({ method: "GET", url: "/", headers: { accept: "text/html" } });
    assert.equal(page.statusCode, 200, "desktop development must serve the built page at its backend origin");
    assert.ok(page.body.includes('id="app"'));
    const script = /<script\b[^>]*\bsrc="([^"]+)"/.exec(page.body)?.[1];
    assert.ok(script?.startsWith("/assets/"), "built HTML must reference a bundled script");
    const asset = await app.inject({ method: "GET", url: script });
    assert.equal(asset.statusCode, 200);
    assert.ok(asset.headers["content-type"].includes("javascript"));
    for (const route of ["/tools/image-ai", "/tools/lan-transfer"]) {
      const navigation = await app.inject({ method: "GET", url: route, headers: { accept: "text/html" } });
      assert.equal(navigation.statusCode, 200);
      assert.equal(navigation.body, page.body);
    }
    const missing = await app.inject({ method: "GET", url: "/api/v1/missing", headers: { accept: "text/html" } });
    assert.equal(missing.statusCode, 404, "desktop layout must not broaden the SPA fallback to API routes");
  } finally {
    await app?.close();
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith("toolbox-desktop-dev-layout-"));
    await rm(root, { recursive: true, force: true });
  }
  console.log("Desktop development smoke passed: actual layout, built HTML/assets/deep links, isolated writable data.");
}
