import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { after, test } from "node:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseMacosRuntimeArgs, runMacosRuntime } from "./macos-runtime.mjs";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const temporaryRoots = new Set();
after(() => {
  for (const root of temporaryRoots) rmSync(root, { recursive: true, force: true });
});

function fixture({ outputExists = false, assetSha256 } = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), "macos-runtime-test-"));
  temporaryRoots.add(root);
  const python = path.join(root, "python3.12");
  writeFileSync(python, "#!/bin/sh\nexit 0\n", { mode: 0o700 });
  chmodSync(python, 0o700);
  const assets = path.join(root, "assets");
  mkdirSync(assets);
  const bytes = Buffer.from("verified synthetic runtime fixture\n");
  writeFileSync(path.join(assets, "fixture.bin"), bytes);
  writeFileSync(
    path.join(assets, "manifest.json"),
    JSON.stringify({
      schemaVersion: 1,
      resources: [
        {
          id: "runtime-fixture",
          path: "fixture.bin",
          sha256: assetSha256 ?? "4c253...invalid-until-replaced"
        }
      ]
    })
  );
  const output = path.join(root, "run-001");
  if (outputExists) mkdirSync(output);
  return { root, python, assets, output, bytes };
}

function validDigest(bytes) {
  return import("node:crypto").then(({ createHash }) => createHash("sha256").update(bytes).digest("hex"));
}

function baseOptions(paths, extra = {}) {
  return {
    mode: "preflight",
    python: paths.python,
    assets: paths.assets,
    output: paths.output,
    ...extra
  };
}

function validDependencies(extra = {}) {
  return {
    repoRoot,
    host: { platform: "darwin", arch: "arm64", osVersion: "15.6.1", memoryBytes: 16 * 1024 ** 3 },
    inspectPython: async () => ({ version: "3.12.8", machine: "arm64" }),
    repoInfo: { commit: "test-commit", dirty: true },
    ...extra
  };
}

test("help is handled before required arguments and documents the explicit run contract", () => {
  const parsed = parseMacosRuntimeArgs(["--help"]);
  assert.equal(parsed.help, true);
  assert.match(parsed.helpText, /--preflight/);
  assert.match(parsed.helpText, /--case <id>/);
  assert.match(parsed.helpText, /--python <absolute-path>/);
  assert.match(parsed.helpText, /--assets <absolute-directory>/);
  assert.match(parsed.helpText, /--output <new-absolute-directory>/);
  assert.match(parsed.helpText, /M01-02-image-ai/);
  assert.match(parsed.helpText, /M01-03-chatterbox/);
  assert.match(parsed.helpText, /M01-04-sttn/);
});

test("M01 video probes execute the production adapters instead of parallel validation models", () => {
  const sttnProbe = readFileSync(path.join(repoRoot, "tooling/video-ai/macos-sttn-probe.py"), "utf8");
  const propainterProbe = readFileSync(path.join(repoRoot, "tooling/video-ai/macos-propainter-probe.py"), "utf8");
  const realProbe = readFileSync(path.join(repoRoot, "tooling/video-ai/macos-real-media-probe.py"), "utf8");
  assert.match(sttnProbe, /from video_ai_sttn import STTN_WINDOW, SttnAdapter as MacosSttnAdapter/);
  assert.match(
    propainterProbe,
    /from video_ai_propainter import PROPAINTER_WINDOW, ProPainterAdapter as MacosPropainterAdapter/
  );
  assert.match(realProbe, /scripts.*video_ai_.*py/);
  assert.doesNotMatch(sttnProbe, /from macos_sttn_adapter import/);
  assert.doesNotMatch(propainterProbe, /from macos_propainter_adapter import/);
  assert.equal(existsSync(path.join(repoRoot, "tooling/video-ai/macos_sttn_adapter.py")), false);
  assert.equal(existsSync(path.join(repoRoot, "tooling/video-ai/macos_propainter_adapter.py")), false);
});

test("public command help runs without setup and missing parameters fail with a usage hint", () => {
  const command = path.join(repoRoot, "scripts/validate-macos-runtime.mjs");
  const help = spawnSync(process.execPath, [command, "--help"], { cwd: repoRoot, encoding: "utf8" });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /modelValidation: not_run/);
  const missing = spawnSync(process.execPath, [command, "--preflight"], { cwd: repoRoot, encoding: "utf8" });
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /--python, --assets and --output are required/);
});

test("argument parsing rejects unknown options, positional arguments, ambiguous modes and missing paths", () => {
  assert.throws(() => parseMacosRuntimeArgs(["--bad"]), /unknown option/i);
  assert.throws(() => parseMacosRuntimeArgs(["extra"]), /position|argument/i);
  assert.throws(() => parseMacosRuntimeArgs(["--preflight", "--case", "M01-01-python-runtime"]), /cannot be combined/i);
  assert.throws(() => parseMacosRuntimeArgs(["--preflight", "--python", "/python"]), /--assets.*--output/i);
  assert.throws(
    () => parseMacosRuntimeArgs(["--python", "/python", "--assets", "/assets", "--output", "/run"]),
    /--case/i
  );
  assert.throws(
    () =>
      parseMacosRuntimeArgs([
        "--case",
        "M01-01-python-runtime",
        "--python",
        "/python",
        "--assets",
        "/assets",
        "--output",
        "/run",
        "--timeout-ms",
        "not-a-number"
      ]),
    /timeout/i
  );
});

test("preflight verifies the host, interpreter and resource hashes without launching a model case", async () => {
  const paths = fixture({ assetSha256: await validDigest(fixtureBytes()) });
  let caseProcessCalls = 0;
  const result = await runMacosRuntime(baseOptions(paths), validDependencies({ spawn: () => caseProcessCalls++ }));
  assert.equal(result.exitCode, 0);
  assert.equal(result.report.status, "pass");
  assert.equal(result.report.modelValidation, "not_run");
  assert.equal(result.report.caseId, null);
  assert.equal(result.report.assetHashes["runtime-fixture"], await validDigest(paths.bytes));
  assert.equal(caseProcessCalls, 0);
  const saved = JSON.parse(readFileSync(path.join(paths.output, "report.json"), "utf8"));
  assert.equal(saved.modelValidation, "not_run");
});

function fixtureBytes() {
  return Buffer.from("verified synthetic runtime fixture\n");
}

test("rejects an unsupported platform and records the preflight failure", async () => {
  const paths = fixture({ assetSha256: await validDigest(fixtureBytes()) });
  const result = await runMacosRuntime(
    baseOptions(paths),
    validDependencies({ host: { platform: "linux", arch: "x64", osVersion: "6.8", memoryBytes: 8 * 1024 ** 3 } })
  );
  assert.equal(result.exitCode, 1);
  assert.equal(result.report.status, "fail");
  assert.match(result.report.error.message, /darwin-arm64/i);
  assert.equal(JSON.parse(readFileSync(path.join(paths.output, "report.json"), "utf8")).modelValidation, "not_run");
});

test("rejects macOS releases older than the supported baseline", async () => {
  const paths = fixture({ assetSha256: await validDigest(fixtureBytes()) });
  const result = await runMacosRuntime(
    baseOptions(paths),
    validDependencies({ host: { platform: "darwin", arch: "arm64", osVersion: "13.7.1", memoryBytes: 16 * 1024 ** 3 } })
  );
  assert.equal(result.exitCode, 1);
  assert.match(result.report.error.message, /macOS 14 or later/i);
});

test("rejects a Node runtime outside the pinned major version", async () => {
  const paths = fixture({ assetSha256: await validDigest(fixtureBytes()) });
  const result = await runMacosRuntime(baseOptions(paths), validDependencies({ nodeVersion: "22.0.0" }));
  assert.equal(result.exitCode, 1);
  assert.match(result.report.error.message, /Node\.js 24\.x is required/);
});

test("rejects a missing asset directory with a machine-readable report", async () => {
  const paths = fixture({ assetSha256: await validDigest(fixtureBytes()) });
  rmSync(paths.assets, { recursive: true });
  const result = await runMacosRuntime(baseOptions(paths), validDependencies());
  assert.equal(result.exitCode, 1);
  assert.match(result.report.error.message, /assets.*directory|asset directory/i);
  assert.equal(readFileSync(path.join(paths.output, "report.json"), "utf8").includes('"status": "fail"'), true);
});

test("rejects a resource whose bytes do not match the manifest digest", async () => {
  const paths = fixture({ assetSha256: "0".repeat(64) });
  const result = await runMacosRuntime(baseOptions(paths), validDependencies());
  assert.equal(result.exitCode, 1);
  assert.match(result.report.error.message, /sha-?256|digest|hash/i);
});

test("rejects manifest paths that escape the selected assets directory", async () => {
  const paths = fixture({ assetSha256: await validDigest(fixtureBytes()) });
  writeFileSync(
    path.join(paths.assets, "manifest.json"),
    JSON.stringify({ schemaVersion: 1, resources: [{ id: "escape", path: "../fixture.bin", sha256: "0".repeat(64) }] })
  );
  const result = await runMacosRuntime(baseOptions(paths), validDependencies());
  assert.equal(result.exitCode, 1);
  assert.match(result.report.error.message, /unsafe resource path/i);
});

test("rejects a missing or non-executable Python interpreter", async () => {
  const paths = fixture({ assetSha256: await validDigest(fixtureBytes()) });
  rmSync(paths.python);
  const result = await runMacosRuntime(baseOptions(paths), validDependencies());
  assert.equal(result.exitCode, 1);
  assert.match(result.report.error.message, /python.*(exist|interpreter|executable)/i);
});

test("rejects relative Python, assets and output paths", async () => {
  const paths = fixture({ assetSha256: await validDigest(fixtureBytes()) });
  const relativePython = await runMacosRuntime(baseOptions(paths, { python: "python3.12" }), validDependencies());
  assert.equal(relativePython.exitCode, 1);
  assert.match(relativePython.report.error.message, /--python must be an absolute path/);

  const relativeAssetsPaths = fixture({ assetSha256: await validDigest(fixtureBytes()) });
  const relativeAssets = await runMacosRuntime(
    baseOptions(relativeAssetsPaths, { assets: "assets" }),
    validDependencies()
  );
  assert.equal(relativeAssets.exitCode, 1);
  assert.match(relativeAssets.report.error.message, /--assets must be an absolute directory path/);

  const relativeOutput = path.join(paths.root, "relative-output");
  await assert.rejects(
    runMacosRuntime(
      baseOptions(paths, { output: relativeOutput.replace(paths.root, "relative") }),
      validDependencies()
    ),
    /--output must be an absolute path/
  );
});

test("rejects an existing output directory without changing it", async () => {
  const paths = fixture({ outputExists: true, assetSha256: await validDigest(fixtureBytes()) });
  const marker = path.join(paths.output, "keep.txt");
  writeFileSync(marker, "keep");
  await assert.rejects(runMacosRuntime(baseOptions(paths), validDependencies()), /new.*output|already exists/i);
  assert.equal(readFileSync(marker, "utf8"), "keep");
});

test("runs only the fixed Python probe, limits output and records a successful child", async () => {
  const paths = fixture({ assetSha256: await validDigest(fixtureBytes()) });
  let received;
  const result = await runMacosRuntime(
    {
      ...baseOptions(paths),
      mode: "case",
      caseId: "M01-01-python-runtime",
      timeoutMs: 1000
    },
    validDependencies({
      spawn: (command, args, options) => {
        received = { command, args, options };
        return fakeChild({ stdout: "runtime probe passed\n" });
      }
    })
  );
  assert.equal(result.exitCode, 0);
  assert.equal(result.report.status, "pass");
  assert.equal(result.report.modelValidation, "not_run");
  assert.equal(result.report.exitCode, 0);
  assert.equal(received.args.at(-1), "M01-01-python-runtime");
  assert.match(received.args[2], /macos-runtime-probe\.py$/);
  assert.equal(received.options.env.API_TOKEN, undefined);
  assert.equal(received.options.env.HF_HUB_OFFLINE, "1");
});

test("requires the pinned model assets and machine report before marking image inference passed", async () => {
  const paths = fixture({ assetSha256: await validDigest(fixtureBytes()) });
  const fixtureDigest = await validDigest(paths.bytes);
  let received;
  const result = await runMacosRuntime(
    {
      ...baseOptions(paths),
      mode: "case",
      caseId: "M01-02-image-ai-test",
      timeoutMs: 1000
    },
    validDependencies({
      caseDefinitions: {
        "M01-02-image-ai-test": {
          id: "M01-02-image-ai-test",
          modelValidation: "required",
          executionMode: "cpu",
          requestedDevice: "cpu",
          probePath: path.join(repoRoot, "tooling/image-ai/macos-runtime-probe.py"),
          expectedAssets: [{ id: "runtime-fixture", path: "fixture.bin", sha256: fixtureDigest }]
        }
      },
      spawn: (_command, args, options) => {
        received = { args, options };
        writeFileSync(
          path.join(options.cwd, "probe-result.json"),
          JSON.stringify({ caseId: "M01-02-image-ai-test", status: "pass", modelValidation: "pass" })
        );
        return fakeChild({ stdout: "image model probe passed\n" });
      }
    })
  );
  assert.equal(result.exitCode, 0);
  assert.equal(result.report.status, "pass");
  assert.equal(result.report.modelValidation, "pass");
  assert.equal(result.report.executionMode, "cpu");
  assert.equal(result.report.requestedDevice, "cpu");
  assert.ok(received.args.includes("--assets-dir"));
  assert.ok(received.args.includes(paths.assets));
  assert.match(received.args[2], /macos-runtime-probe\.py$/);
});

test("records Chatterbox MPS as a separate result while requiring CPU model inference", async () => {
  const paths = fixture({ assetSha256: await validDigest(fixtureBytes()) });
  const fixtureDigest = await validDigest(paths.bytes);
  const result = await runMacosRuntime(
    {
      ...baseOptions(paths),
      mode: "case",
      caseId: "M01-03-chatterbox-test",
      timeoutMs: 1000
    },
    validDependencies({
      caseDefinitions: {
        "M01-03-chatterbox-test": {
          id: "M01-03-chatterbox-test",
          modelValidation: "required",
          executionMode: "cpu+mps",
          requestedDevice: "cpu",
          probePath: path.join(repoRoot, "tooling/chatterbox/macos-runtime-probe.py"),
          expectedAssets: [{ id: "runtime-fixture", path: "fixture.bin", sha256: fixtureDigest }]
        }
      },
      spawn: (_command, _args, options) => {
        writeFileSync(
          path.join(options.cwd, "probe-result.json"),
          JSON.stringify({
            caseId: "M01-03-chatterbox-test",
            status: "pass",
            modelValidation: "pass",
            mpsValidation: { status: "fail", failure: "unsupported operator" }
          })
        );
        return fakeChild({ stdout: "Chatterbox CPU model probe passed\\n" });
      }
    })
  );
  assert.equal(result.exitCode, 0);
  assert.equal(result.report.status, "pass");
  assert.equal(result.report.modelValidation, "pass");
  assert.equal(result.report.executionMode, "cpu+mps");
  assert.equal(result.report.requestedDevice, "cpu");
  assert.equal(result.report.mpsValidation, "fail");
  assert.equal(result.report.mpsFailure, "unsupported operator");
});

test("records the full MPS-first video output, resource metrics and cancellation evidence", async () => {
  const paths = fixture({ assetSha256: await validDigest(fixtureBytes()) });
  const fixtureDigest = await validDigest(paths.bytes);
  const result = await runMacosRuntime(
    {
      ...baseOptions(paths),
      mode: "case",
      caseId: "M01-04-sttn-test",
      timeoutMs: 1000
    },
    validDependencies({
      caseDefinitions: {
        "M01-04-sttn-test": {
          id: "M01-04-sttn-test",
          modelValidation: "required",
          executionMode: "mps-first",
          requestedDevice: "mps",
          probePath: path.join(repoRoot, "tooling/video-ai/macos-sttn-probe.py"),
          expectedAssets: [{ id: "runtime-fixture", path: "fixture.bin", sha256: fixtureDigest }]
        }
      },
      spawn: (_command, _args, options) => {
        writeFileSync(
          path.join(options.cwd, "probe-result.json"),
          JSON.stringify({
            caseId: "M01-04-sttn-test",
            status: "pass",
            modelValidation: "pass",
            executionDevice: "mps",
            peakMpsBytes: 2048,
            source: { sha256: fixtureDigest, frames: 241, width: 1280, height: 720 },
            output: { sha256: fixtureDigest },
            selectedRun: { video: { frames: 241, width: 1280, height: 720 } },
            cancellation: { cancelled: true },
            mpsValidation: { status: "pass", failure: null },
            humanQuality: "pending"
          })
        );
        return fakeChild({ stdout: "STTN full Worker probe passed\n" });
      }
    })
  );
  assert.equal(result.exitCode, 0);
  assert.equal(result.report.executionDevice, "mps");
  assert.equal(result.report.mpsValidation, "pass");
  assert.equal(result.report.peakMpsBytes, 2048);
  assert.equal(result.report.input.frames, 241);
  assert.equal(result.report.output.frames, 241);
  assert.equal(result.report.video.width, 1280);
  assert.deepEqual(result.report.cancellation, { cancelled: true });
  assert.equal(result.report.humanQuality, "pending");
});

test("rejects an image case whose fixed model digest is changed in the asset manifest", async () => {
  const paths = fixture({ assetSha256: await validDigest(fixtureBytes()) });
  let childStarted = false;
  const result = await runMacosRuntime(
    {
      ...baseOptions(paths),
      mode: "case",
      caseId: "M01-02-image-ai-test"
    },
    validDependencies({
      caseDefinitions: {
        "M01-02-image-ai-test": {
          id: "M01-02-image-ai-test",
          modelValidation: "required",
          executionMode: "cpu",
          probePath: path.join(repoRoot, "tooling/image-ai/macos-runtime-probe.py"),
          expectedAssets: [{ id: "runtime-fixture", path: "fixture.bin", sha256: "f".repeat(64) }]
        }
      },
      spawn: () => {
        childStarted = true;
        return fakeChild();
      }
    })
  );
  assert.equal(result.exitCode, 1);
  assert.equal(result.report.status, "fail");
  assert.match(result.report.error.message, /Pinned case asset is missing or changed/);
  assert.equal(childStarted, false);
});

test("bounds captured child output and reports a non-zero exit", async () => {
  const paths = fixture({ assetSha256: await validDigest(fixtureBytes()) });
  const result = await runMacosRuntime(
    {
      ...baseOptions(paths),
      mode: "case",
      caseId: "M01-01-python-runtime",
      timeoutMs: 1000
    },
    validDependencies({
      spawn: () => fakeChild({ stdout: "x".repeat(80 * 1024), stderr: "probe failed", exitCode: 7 })
    })
  );
  assert.equal(result.exitCode, 1);
  assert.equal(result.report.status, "fail");
  assert.equal(result.report.exitCode, 7);
  assert.equal(result.report.outputCapture.stdoutTruncated, true);
  assert.equal(Buffer.byteLength(result.report.stdout), 64 * 1024);
});

test("times out the child process and records a failure", async () => {
  const paths = fixture({ assetSha256: await validDigest(fixtureBytes()) });
  const result = await runMacosRuntime(
    {
      ...baseOptions(paths),
      mode: "case",
      caseId: "M01-01-python-runtime",
      timeoutMs: 20
    },
    validDependencies({ spawn: () => fakeChild({ closeOnKill: true }) })
  );
  assert.equal(result.exitCode, 1);
  assert.equal(result.report.status, "fail");
  assert.equal(result.report.error.code, "timeout");
});

test("records cancellation separately from failure when interrupted", async () => {
  const paths = fixture({ assetSha256: await validDigest(fixtureBytes()) });
  const abortController = new AbortController();
  const pending = runMacosRuntime(
    {
      ...baseOptions(paths),
      mode: "case",
      caseId: "M01-01-python-runtime",
      timeoutMs: 1000
    },
    validDependencies({ signal: abortController.signal, spawn: () => fakeChild({ closeOnKill: true }) })
  );
  setTimeout(() => abortController.abort(), 10);
  const result = await pending;
  assert.equal(result.exitCode, 130);
  assert.equal(result.report.status, "blocked");
  assert.equal(result.report.error.code, "cancelled");
});

function fakeChild({ stdout = "", stderr = "", closeOnKill = false, exitCode = 0 } = {}) {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = () => {
    if (closeOnKill) setImmediate(() => child.emit("close", null, "SIGTERM"));
    return true;
  };
  setImmediate(() => {
    child.stdout.end(stdout);
    child.stderr.end(stderr);
    if (!closeOnKill) child.emit("close", exitCode, null);
  });
  return child;
}
