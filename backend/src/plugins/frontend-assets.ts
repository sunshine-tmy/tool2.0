/**
 * 中文模块说明：生产前端资源服务，负责安全托管 Vite 产物与 SPA 路由回退。
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export type FrontendAssetsOptions = {
  root: string;
};

/**
 * 只把 Vite 的 `assets/` 目录交给静态插件；API 与 health 路由永远不经过
 * SPA fallback。`@fastify/static` 固定到包含非规范路径修复的版本，避免自行实现
 * 文件系统路径解析。
 */
export async function registerFrontendAssets(app: FastifyInstance, options: FrontendAssetsOptions) {
  const root = path.resolve(options.root);
  const indexFile = path.join(root, "index.html");
  const assetsRoot = path.join(root, "assets");
  if (!(await isFile(indexFile)) || !(await isDirectory(assetsRoot))) return false;

  await app.register(fastifyStatic, {
    root: assetsRoot,
    prefix: "/assets/",
    decorateReply: false,
    index: false,
    list: false,
    maxAge: "1y",
    immutable: true
  });

  // Vite copies `public/` files beside index.html rather than into assets/.
  // Register only files present in the generated frontend root (excluding the
  // bundle directory and HTML entrypoint) so icons and other public resources
  // resolve without exposing the SPA fallback as an image response.
  await app.register(fastifyStatic, {
    root,
    prefix: "/",
    decorateReply: false,
    index: false,
    list: false,
    wildcard: false,
    globIgnore: ["assets/**", "index.html"],
    serveDotFiles: false,
    maxAge: "1h"
  });

  app.get("/", async (request, reply) => sendIndex(reply, request, indexFile));

  app.get("/*", async (request, reply) => {
    if (!isSpaNavigation(request)) return reply.callNotFound();
    return sendIndex(reply, request, indexFile);
  });

  return true;
}

function isSpaNavigation(request: FastifyRequest) {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  const pathname = request.url.split("?", 1)[0] ?? "";
  if (pathname.startsWith("/api/") || pathname.startsWith("/health/")) return false;
  return request.headers.accept?.includes("text/html") ?? false;
}

function sendIndex(reply: FastifyReply, request: FastifyRequest, indexFile: string) {
  reply.header("content-type", "text/html; charset=utf-8");
  reply.header("cache-control", "no-cache, no-store, must-revalidate");
  if (request.method === "HEAD") return reply.code(200).send();
  return reply.send(fs.createReadStream(indexFile));
}

async function isFile(filePath: string) {
  return fsp
    .stat(filePath)
    .then((entry) => entry.isFile())
    .catch(() => false);
}

async function isDirectory(filePath: string) {
  return fsp
    .stat(filePath)
    .then((entry) => entry.isDirectory())
    .catch(() => false);
}
