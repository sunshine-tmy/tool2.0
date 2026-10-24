import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { copyRuntimeScripts } from "../tooling/build/runtime-scripts.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(
  await fs.readFile(new URL("../tooling/build/runtime-scripts.json", import.meta.url), "utf8")
);

test("distribution includes precisely the declared runtime closure without development, signing or model tooling", async () => {
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-runtime-layout-"));
  try {
    const resources = path.join(scratch, "中文 resource (1)");
    await copyRuntimeScripts(root, resources);
    const files = (await fs.readdir(resources, { recursive: true, withFileTypes: true }))
      .filter((f) => f.isFile())
      .map((f) => path.relative(resources, path.join(f.parentPath, f.name)).replaceAll("\\", "/"))
      .sort();
    assert.deepEqual(files, Object.values(manifest.groups).flat().sort());
    assert.equal(new Set(files).size, files.length);
    assert.deepEqual(await fs.readdir(path.join(resources, "tooling/source")), [
      "cleanup-engine.mjs",
      "clear-generated.mjs"
    ]);
    for (const relative of files)
      assert.deepEqual(await fs.readFile(path.join(resources, relative)), await fs.readFile(path.join(root, relative)));
    const logs = path.join(resources, ".logs");
    const saved = path.join(resources, "storage/image-ai/saved.png");
    await fs.mkdir(logs);
    await fs.writeFile(path.join(logs, "example.log"), "temporary log");
    await fs.mkdir(path.dirname(saved), { recursive: true });
    await fs.writeFile(saved, "permanent image");
    const entry = path.join(resources, "scripts/clear-generated.mjs");
    const run = (...args) =>
      JSON.parse(execFileSync(process.execPath, [entry, ...args], { cwd: scratch, encoding: "utf8" }));
    assert.ok(run("--json").find((item) => item.id === "logs").bytes > 0);
    run("--execute=logs", "--dry-run");
    assert.equal(await fs.readFile(path.join(logs, "example.log"), "utf8"), "temporary log");
    run("--execute=logs");
    assert.equal(await fs.readFile(saved, "utf8"), "permanent image");
    assert.equal(await fs.stat(logs).catch(() => null), null);
    assert.deepEqual(await fs.readdir(scratch), ["中文 resource (1)"]);
  } finally {
    await fs.rm(scratch, { recursive: true, force: true });
  }
});

test("public engineering CLI still rejects invalid arguments from a foreign cwd before preparing resources", async () => {
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-tooling-cli-"));
  try {
    for (const name of [
      "prepare-edge-tts-component",
      "prepare-image-ai-component",
      "prepare-chatterbox-component",
      "prepare-chatterbox-cuda-component",
      "build-component-package",
      "download-fixed-model-file"
    ]) {
      const result = spawnSync(process.execPath, [path.join(root, "scripts", name + ".mjs"), "--invalid"], {
        cwd: scratch,
        encoding: "utf8",
        windowsHide: true
      });
      assert.equal(result.status, 1, name);
      assert.doesNotMatch(result.stderr, /ERR_MODULE_NOT_FOUND|ReferenceError|SyntaxError/, name);
      assert.ok(result.stderr.trim(), name);
    }
    const bootstrap = spawnSync(
      process.execPath,
      [
        path.join(root, "apps/api/node_modules/tsx/dist/cli.mjs"),
        "--tsconfig",
        path.join(root, "apps/api/tsconfig.json"),
        path.join(root, "scripts/bootstrap-components.ts"),
        "--invalid"
      ],
      { cwd: scratch, encoding: "utf8", windowsHide: true }
    );
    assert.equal(bootstrap.status, 1);
    assert.match(bootstrap.stderr, /初始化入口只接受可选的 --with-cuda 参数/);
    assert.doesNotMatch(bootstrap.stderr, /ERR_MODULE_NOT_FOUND|ReferenceError|SyntaxError/);
    assert.deepEqual(await fs.readdir(scratch), []);
  } finally {
    await fs.rm(scratch, { recursive: true, force: true });
  }
});
