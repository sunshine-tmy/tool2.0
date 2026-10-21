import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));

test("抖音匿名能力只登记固定适配器，共享浏览器资产但不打包会话或 Python", async () => {
  const definition = JSON.parse(
    await fs.readFile(path.join(SCRIPT_DIRECTORY, "component-definitions/douyin-archive.json"), "utf8")
  );
  const stage = path.join(SCRIPT_DIRECTORY, "../packaging/components/douyin-archive");
  const descriptor = JSON.parse(await fs.readFile(path.join(stage, "adapter/manifest.json"), "utf8"));
  assert.equal(definition.id, "douyin-archive");
  assert.deepEqual(definition.dependencyIds, ["xhs-browser"]);
  assert.equal(definition.version, `1.0.0-anonymous-${descriptor.sourceRevision.slice(0, 7)}`);
  assert.equal(descriptor.mode, "anonymous");
  assert.equal(descriptor.sourceRevision, "27468deae565fcb3d5a074063703d9df88449aed");
  assert.equal(definition.pythonEnvironment, undefined);
  assert.equal(definition.license, undefined);
  assert.deepEqual(await fs.readdir(stage), ["adapter"]);
  assert.deepEqual(await fs.readdir(path.join(stage, "adapter")), ["manifest.json"]);
});
