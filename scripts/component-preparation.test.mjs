import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { WHISPER_SMALL_FILES, WHISPER_SMALL_REVISION } from "./prepare-whisper-small-model.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));

test("video transcription packages are split into fixed CPU runtime and offline model", async () => {
  const runtime = JSON.parse(
    await fs.readFile(path.join(SCRIPT_DIRECTORY, "component-definitions/video-text.json"), "utf8")
  );
  const model = JSON.parse(
    await fs.readFile(path.join(SCRIPT_DIRECTORY, "component-definitions/whisper-small.json"), "utf8")
  );
  assert.deepEqual(runtime.dependencyIds, ["ffmpeg", "python-311", "whisper-small"]);
  assert.equal(runtime.pythonEnvironment.expectedPythonVersion, "3.11");
  assert.equal(runtime.pythonEnvironment.pythonComponentId, "python-311");
  assert.equal(model.id, "whisper-small");
  assert.equal(model.version, `20260925-${WHISPER_SMALL_REVISION.slice(0, 7)}`);
  assert.deepEqual(WHISPER_SMALL_FILES, ["config.json", "model.bin", "tokenizer.json", "vocabulary.txt"]);
  assert.equal(WHISPER_SMALL_REVISION.length, 40);
});

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
