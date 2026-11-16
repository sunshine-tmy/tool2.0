import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PYTHON312_ARCHIVES } from "./prepare-python-312-runtime.mjs";
import MACOS_TOOLCHAIN from "./macos/toolchain-sources.json" with { type: "json" };
import {
  assertPinnedUvVersion,
  buildUvCompileArgs,
  MACOS_LOCK_DEFINITIONS,
  parseMacOSLockArguments,
  selectMacOSLockDefinitions
} from "./lock-macos-component-dependencies.mjs";

const COMPONENTS_ROOT = path.dirname(fileURLToPath(import.meta.url));

test("macOS toolchain pins the existing Python runtime and an exact native uv archive", () => {
  assert.deepEqual(MACOS_TOOLCHAIN.python, {
    version: "3.12.14",
    platform: "darwin-arm64",
    url: PYTHON312_ARCHIVES["darwin-arm64"].url,
    bytes: PYTHON312_ARCHIVES["darwin-arm64"].bytes,
    sha256: PYTHON312_ARCHIVES["darwin-arm64"].sha256
  });
  assert.equal(MACOS_TOOLCHAIN.uv.version, "0.13.7");
  assert.match(MACOS_TOOLCHAIN.uv.sha256, /^[a-f0-9]{64}$/u);
  assert.match(MACOS_TOOLCHAIN.uv.url, /aarch64-apple-darwin/u);
});

test("macOS inference inputs pin the planned native PyTorch stack without CPU or CUDA suffixes", async () => {
  for (const [name, expected] of [
    ["image-ai", ["torch==2.6.0", "torchvision==0.21.0"]],
    ["chatterbox", ["torch==2.6.0", "torchaudio==2.6.0"]],
    ["video-ai", ["torch==2.6.0", "torchvision==0.21.0", "einops==0.8.1", "scipy==1.17.1"]]
  ]) {
    const input = await fs.readFile(path.join(COMPONENTS_ROOT, "macos", `${name}-requirements.txt`), "utf8");
    for (const requirement of expected)
      assert.match(input, new RegExp(`^${requirement.replaceAll(".", "\\.")}$`, "mu"));
    assert.doesNotMatch(input, /torch(?:vision|audio)?==[^\n]*\+(?:cpu|cu\d+)/iu);
  }
});

test("lock generation supports help, pnpm separator, explicit components, and strict paths", () => {
  assert.deepEqual(parseMacOSLockArguments(["--help"]), { help: true });
  assert.deepEqual(
    parseMacOSLockArguments([
      "--",
      "--python-312",
      "/tmp/python3.12",
      "--uv",
      "/tmp/uv",
      "--components",
      "image-ai,chatterbox"
    ]),
    {
      python312: "/tmp/python3.12",
      uv: "/tmp/uv",
      components: ["image-ai", "chatterbox"]
    }
  );
  assert.throws(() => parseMacOSLockArguments(["--python-312", "relative/python"]), /绝对路径/u);
  assert.throws(() => parseMacOSLockArguments(["--components", "image-ai,unknown"]), /不支持/u);
  assert.throws(() => parseMacOSLockArguments(["--uv", "uv", "--uv", "other"]), /无效/u);
  assert.throws(() => parseMacOSLockArguments(["--help", "--uv", "uv"]), /无效/u);
});

test("component selection preserves all Mac packages and permits M01's isolated trio", () => {
  assert.deepEqual(
    MACOS_LOCK_DEFINITIONS.map(({ name }) => name),
    ["edge-tts", "chatterbox", "image-ai", "video-ai", "xhs-archive", "xhs-translation"]
  );
  assert.deepEqual(
    selectMacOSLockDefinitions(["image-ai", "chatterbox", "video-ai"]).map(({ name }) => name),
    ["image-ai", "chatterbox", "video-ai"]
  );
  assert.throws(() => selectMacOSLockDefinitions(["image-ai", "image-ai"]), /重复/u);
  assert.throws(() => selectMacOSLockDefinitions(["unknown"]), /不支持/u);
});

test("uv compile args resolve the Apple Silicon Python 3.12 wheel set without CPU backend overrides", () => {
  const definition = MACOS_LOCK_DEFINITIONS.find(({ name }) => name === "image-ai");
  const args = buildUvCompileArgs(definition, "/tmp/python3.12", "/tmp/image-ai.lock");
  assert.equal(args[0], "pip");
  assert.equal(args[1], "compile");
  assert.ok(args.includes("3.12"));
  assert.ok(args.includes("aarch64-apple-darwin"));
  assert.ok(args.includes("--generate-hashes"));
  assert.ok(!args.includes("--torch-backend"));
  assert.ok(!args.some((argument) => argument.includes("win_amd64") || argument.includes("+cpu")));
});

test("lock generator accepts only the pinned uv release", () => {
  assert.doesNotThrow(() => assertPinnedUvVersion("uv 0.13.7 (arm64-apple-darwin)"));
  assert.throws(() => assertPinnedUvVersion("uv 0.13.6"), /需要 uv 0\.13\.7/u);
});
