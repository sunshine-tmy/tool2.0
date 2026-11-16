import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { prepareDouyinArchiveComponent } from "./prepare-douyin-archive-component.mjs";

test("Mac Douyin preparation reuses the single reviewed descriptor and matching Chromium dependency", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-douyin-macos-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const stage = path.join(root, "douyin-stage");
  const result = await prepareDouyinArchiveComponent({ stagingDirectory: stage });
  const descriptorPath = path.join(stage, "adapter", "manifest.json");
  assert.deepEqual(result.filePaths, ["adapter/manifest.json"]);
  assert.equal(result.bytes, (await fs.stat(descriptorPath)).size);
  const descriptor = JSON.parse(await fs.readFile(descriptorPath, "utf8"));
  assert.equal(descriptor.mode, "anonymous");
  assert.equal(descriptor.browserComponentId, "xhs-browser");
  assert.equal(descriptor.playwrightVersion, "1.63.0");
  assert.equal(descriptor.chromiumRevision, "1243");
  assert.equal(descriptor.chromiumVersion, "153.0.8010.12");
  assert.deepEqual(await fs.readdir(path.join(stage, "adapter")), ["manifest.json"]);
});

test("Douyin preparation refuses to overwrite an existing stage", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-douyin-existing-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const stage = path.join(root, "stage");
  await fs.mkdir(stage);
  await assert.rejects(prepareDouyinArchiveComponent({ stagingDirectory: stage }), /拒绝覆盖/u);
});
