/**
 * 中文模块说明：工程与 Worker 脚本，负责 构建产物启动、健康检查和传输冒烟
 */
import assert from "node:assert/strict";
import { access, mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const sharedDist = path.join(repoRoot, "packages", "shared", "dist");
const backendDist = path.join(repoRoot, "backend", "dist");

await assertCleanOutput(sharedDist, ["index.js", "index.d.ts", "short-video.js", "video-text.js"]);
await assertCleanOutput(backendDist, ["app.js", "server.js"]);

const shared = await importFile(path.join(sharedDist, "index.js"));
assert.equal(typeof shared.ok, "function", "shared dist must export ok()");
assert.equal(typeof shared.listTools, "function", "shared dist must export listTools()");

const videoText = await importFile(path.join(sharedDist, "video-text.js"));
assert.equal(typeof videoText.parseTranscriptCues, "function", "video-text subpath must be importable");

const temporaryStorage = await mkdtemp(path.join(os.tmpdir(), "toolbox-build-smoke-"));
const previousStorageRoot = process.env.STORAGE_ROOT;
process.env.STORAGE_ROOT = temporaryStorage;

let app;
try {
  const backend = await importFile(path.join(backendDist, "app.js"));
  assert.equal(typeof backend.createApp, "function", "backend dist must export createApp()");

  app = await backend.createApp();
  const response = await app.inject({ method: "GET", url: "/api/v1/health" });
  assert.equal(response.statusCode, 200, response.body);

  const payload = response.json();
  assert.equal(payload.success, true);
  assert.equal(payload.data?.status, "ok");
} finally {
  await app?.close();
  if (previousStorageRoot === undefined) {
    delete process.env.STORAGE_ROOT;
  } else {
    process.env.STORAGE_ROOT = previousStorageRoot;
  }
  await rm(temporaryStorage, { recursive: true, force: true });
}

console.log("Build smoke test passed: shared imports and backend /api/v1/health are runnable.");

async function importFile(filePath) {
  await access(filePath);
  return import(pathToFileURL(filePath).href);
}

async function assertCleanOutput(root, requiredFiles) {
  const files = await listFiles(root);
  for (const requiredFile of requiredFiles) {
    assert.ok(files.includes(requiredFile), `Missing build output: ${path.join(root, requiredFile)}`);
  }

  const forbidden = files.filter((file) => {
    const segments = file.split("/");
    return (
      segments.includes("__tests__") ||
      /(^|\/)backend\//.test(file) ||
      /(^|\/)packages\//.test(file) ||
      /\.test\./.test(file)
    );
  });
  assert.deepEqual(forbidden, [], `Build output contains tests or nested source trees: ${forbidden.join(", ")}`);
}

async function listFiles(root, relativeRoot = "") {
  const directory = path.join(root, relativeRoot);
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.join(relativeRoot, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(root, relativePath)));
    } else {
      files.push(relativePath.split(path.sep).join("/"));
    }
  }

  return files;
}
