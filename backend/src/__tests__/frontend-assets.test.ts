/**
 * 中文模块说明：生产前端静态服务的安全与缓存回归测试。
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { registerFrontendAssets } from "../plugins/frontend-assets";

let root = "";

afterEach(async () => {
  if (root) await fs.rm(root, { recursive: true, force: true });
  root = "";
});

describe("frontend assets", () => {
  it("serves hashed assets, SPA navigations and preserves API 404s", async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-frontend-"));
    await fs.mkdir(path.join(root, "assets"));
    await fs.writeFile(path.join(root, "index.html"), "<main>toolbox</main>");
    await fs.writeFile(path.join(root, "assets", "app-123.js"), "console.log('toolbox')");
    await fs.writeFile(path.join(root, "ecommerce-toolbox-icon-32.png"), "icon-bytes");
    await fs.writeFile(path.join(root, "favicon.ico"), "favicon-bytes");

    const app = fastify();
    app.setNotFoundHandler((_request, reply) => reply.code(404).send({ code: "ROUTE_NOT_FOUND" }));
    expect(await registerFrontendAssets(app, { root })).toBe(true);

    const [asset, publicIcon, favicon, navigation, api, traversal, missingImage] = await Promise.all([
      app.inject({ method: "GET", url: "/assets/app-123.js" }),
      app.inject({ method: "GET", url: "/ecommerce-toolbox-icon-32.png" }),
      app.inject({ method: "GET", url: "/favicon.ico" }),
      app.inject({ method: "GET", url: "/tools/image-ai", headers: { accept: "text/html" } }),
      app.inject({ method: "GET", url: "/api/v1/missing", headers: { accept: "text/html" } }),
      app.inject({ method: "GET", url: "/assets/%2E%2E/index.html" }),
      app.inject({ method: "GET", url: "/missing.png", headers: { accept: "image/png" } })
    ]);

    expect(asset.statusCode).toBe(200);
    expect(asset.headers["cache-control"]).toContain("immutable");
    expect(asset.headers["content-type"]).toContain("javascript");
    expect(publicIcon.statusCode).toBe(200);
    expect(publicIcon.body).toBe("icon-bytes");
    expect(publicIcon.headers["content-type"]).toContain("image/png");
    expect(publicIcon.headers["cache-control"]).not.toContain("immutable");
    expect(favicon.statusCode).toBe(200);
    expect(favicon.headers["content-type"]).toContain("image");
    expect(navigation.statusCode).toBe(200);
    expect(navigation.body).toContain("toolbox");
    expect(navigation.headers["cache-control"]).toContain("no-store");
    expect(api.statusCode).toBe(404);
    expect(traversal.statusCode).toBe(404);
    expect(missingImage.statusCode).toBe(404);
    await app.close();
  });

  it("does not register fallback routes when the production build is absent", async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-frontend-"));
    const app = fastify();
    expect(await registerFrontendAssets(app, { root })).toBe(false);
    await app.close();
  });
});
