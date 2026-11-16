import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";
import path from "node:path";
import { startImageAiWorker } from "./start-image-ai-worker.mjs";

test("source image AI launch uses the platform Python path, stays offline and forwards arguments", () => {
  const owner = new EventEmitter();
  const child = new EventEmitter();
  let kills = 0;
  let invocation;
  child.kill = () => {
    kills++;
  };
  startImageAiWorker({
    args: ["--check"],
    environment: { TOOLBOX_DESKTOP_MANAGED: "0", HF_HUB_OFFLINE: "0", IMAGE_AI_MODELS_ROOT: "C:/模型 数据" },
    owner,
    launch: (...args) => {
      invocation = args;
      return child;
    }
  });
  const [python, args, options] = invocation;
  assert.ok(path.isAbsolute(python));
  assert.match(python, /\.venv-image-ai/);
  assert.match(args[0], /image-ai-worker\.py$/);
  assert.equal(args[1], "--check");
  assert.equal(options.shell, undefined);
  assert.equal(options.env.TOOLBOX_DESKTOP_MANAGED, "1");
  assert.equal(options.env.HF_HUB_OFFLINE, "1");
  assert.equal(options.env.IMAGE_AI_MODELS_ROOT, "C:/模型 数据");
  assert.equal(options.env.PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK, "True");
  assert.equal(options.env.PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT, "False");
  owner.emit("SIGTERM");
  assert.equal(kills, 1);
  child.emit("close", 0);
  assert.equal(owner.exitCode, 0);
  assert.equal(owner.listenerCount("SIGINT"), 0);
  assert.equal(owner.listenerCount("SIGTERM"), 0);
});
