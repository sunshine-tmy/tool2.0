// Anchor filesystem and CLI identity at the stable public entry.
const publicEntryUrl = new URL("../../scripts/smoke-build.mjs", import.meta.url).href;

/**
 * 中文模块说明：工程与 Worker 脚本，负责 构建产物启动、健康检查和传输冒烟
 */
import assert from "node:assert/strict";
import { access, mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { prepareProductSmokeFixture, smokeProductImage } from "./smoke-product-image.mjs";
import { smokeRuntimeCore } from "./smoke-runtime-core.mjs";
import { smokeProjectRoot } from "./smoke-project-root.mjs";
import { smokeApiLayout } from "./smoke-api-layout.mjs";
import { smokeWebLayout } from "./smoke-web-layout.mjs";
import { smokeDesktopContract } from "./smoke-desktop-contract.mjs";
import { smokeImageContract } from "./smoke-image-contract.mjs";
import { smokeAudioLibraryContract } from "./smoke-audio-library-contract.mjs";
import { smokeSchemaFormats } from "./smoke-schema-formats.mjs";
import { smokeLanContract } from "./smoke-lan-contract.mjs";
import { smokeArchiveContract } from "./smoke-archive-contract.mjs";
import { smokeSpeechContract } from "./smoke-speech-contract.mjs";
import { smokeSystemContract } from "./smoke-system-contract.mjs";
import { smokeCommonContract } from "./smoke-common-contract.mjs";
import { smokeDesktopDevelopment } from "./smoke-desktop-development.mjs";
import { smokeDataBackup } from "./smoke-data-backup.mjs";

const repoRoot = fileURLToPath(new URL("..", publicEntryUrl));
const sharedDist = path.join(repoRoot, "packages", "shared", "dist");
const backendDist = path.join(repoRoot, "apps", "api", "dist");

await assertCleanOutput(sharedDist, ["index.js", "index.d.ts"]);
await smokeDesktopContract(repoRoot);
await smokeImageContract(repoRoot);
await smokeAudioLibraryContract(repoRoot);
await smokeSchemaFormats(repoRoot);
await smokeLanContract(repoRoot);
await smokeArchiveContract(repoRoot);
await smokeSpeechContract(repoRoot);
await smokeSystemContract(repoRoot);
await smokeCommonContract(repoRoot);
await assertCleanOutput(backendDist, ["app.js", "server.js"]);
await assertCleanOutput(path.join(repoRoot, "apps/web/dist"), ["index.html"]);
await assertCleanOutput(path.join(repoRoot, "packages", "runtime-core", "dist"), ["index.js", "index.d.ts"]);
const getBuiltConfig = await smokeRuntimeCore(repoRoot);
await smokeDesktopDevelopment(repoRoot, getBuiltConfig);
await smokeProjectRoot(repoRoot);
await smokeProjectRoot(repoRoot, ["backend"]);
await smokeApiLayout(repoRoot);
await smokeApiLayout(repoRoot, true);
await smokeDataBackup(repoRoot);
await smokeWebLayout(repoRoot);

const shared = await importFile(path.join(sharedDist, "index.js"));
assert.equal(typeof shared.ok, "function", "shared dist must export ok()");
assert.equal(typeof shared.listTools, "function", "shared dist must export listTools()");

const temporaryStorage = await mkdtemp(path.join(os.tmpdir(), "toolbox-build-smoke-"));

let app;
try {
  await prepareProductSmokeFixture(temporaryStorage, repoRoot);
  const backend = await importFile(path.join(backendDist, "app.js"));
  assert.equal(typeof backend.createApp, "function", "backend dist must export createApp()");

  const { createRuntimeLayout } = await importFile(path.join(repoRoot, "packages", "runtime-core", "dist", "index.js"));
  const layout = createRuntimeLayout({
    appRoot: repoRoot,
    configRoot: path.join(temporaryStorage, "config"),
    storageRoot: temporaryStorage,
    runtimeRoot: path.join(temporaryStorage, "runtime"),
    modelsRoot: path.join(temporaryStorage, "models"),
    scriptsRoot: path.join(repoRoot, "scripts"),
    frontendDistRoot: path.join(repoRoot, "apps", "web", "dist")
  });
  app = await backend.createApp({
    config: getBuiltConfig({
      layout,
      dotenvPath: false,
      environment: { NODE_ENV: "test", DATABASE_PATH: path.join(temporaryStorage, "toolbox.db") }
    })
  });
  const response = await app.inject({ method: "GET", url: "/api/v1/health" });
  assert.equal(response.statusCode, 200, response.body);

  const payload = response.json();
  assert.equal(payload.success, true);
  assert.equal(payload.data?.status, "ok");
  await smokeProductImage(app, shared.defaultProductImageRecipe());
} finally {
  await app?.close();
  assert.equal(path.dirname(temporaryStorage), path.resolve(os.tmpdir()));
  assert.ok(path.basename(temporaryStorage).startsWith("toolbox-build-smoke-"));
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
