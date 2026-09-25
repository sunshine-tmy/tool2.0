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
