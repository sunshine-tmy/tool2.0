import { EventEmitter } from "node:events";
import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import { startVideoAiWorker } from "./start-video-ai-worker.mjs";

test("source video launch fixes offline mode before Python imports and forwards arguments without a shell", () => {
  const owner = new EventEmitter(),
    child = new EventEmitter();
  let kills = 0,
    invocation;
  child.kill = () => {
    kills++;
  };
  startVideoAiWorker({
    args: ["--check"],
    environment: { TOOLBOX_DESKTOP_MANAGED: "0", HF_HUB_OFFLINE: "0", VIDEO_AI_MODELS_ROOT: "C:/已备份 models" },
    owner,
    launch: (...args) => {
      invocation = args;
      return child;
    }
  });
  const [python, args, options] = invocation;
  assert.ok(path.isAbsolute(python));
  assert.match(python, /\.venv-video-ai/);
  assert.match(args[0], /video-ai-worker-launcher\.py$/);
  assert.match(args[1], /video-ai-worker\.py$/);
  assert.equal(args[2], "--check");
  assert.equal(options.shell, undefined);
  assert.equal(options.env.TOOLBOX_DESKTOP_MANAGED, "1");
  assert.equal(options.env.HF_HUB_OFFLINE, "1");
  assert.equal(options.env.VIDEO_AI_MODELS_ROOT, "C:/已备份 models");
  assert.equal(options.env.PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK, "True");
  owner.emit("SIGINT");
  assert.equal(kills, 1);
  child.emit("close", 0);
  assert.equal(owner.exitCode, 0);
  assert.equal(owner.listenerCount("SIGINT"), 0);
  assert.equal(owner.listenerCount("SIGTERM"), 0);
});
