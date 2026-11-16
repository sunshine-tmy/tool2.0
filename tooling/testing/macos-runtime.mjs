import { createHash, randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { access, lstat, mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { IMAGE_AI_MODEL_ASSETS } from "../components/prepare-image-ai-component.mjs";
import { CHATTERBOX_MODEL_ASSETS } from "../components/prepare-chatterbox-component.mjs";
import { STTN_MACOS_VALIDATION_ASSETS } from "../video-ai/macos-sttn-validation-assets.mjs";
import { PROPAINTER_MACOS_VALIDATION_ASSETS } from "../video-ai/macos-propainter-validation-assets.mjs";

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const MIN_TIMEOUT_MS = 100;
const MAX_TIMEOUT_MS = 60 * 60 * 1000;
const MAX_CAPTURE_BYTES = 64 * 1024;
const PYTHON_VERSION = "3.12";

const moduleRoot = fileURLToPath(new URL("../../", import.meta.url));
const pythonRuntimeProbePath = fileURLToPath(new URL("../video-ai/macos-runtime-probe.py", import.meta.url));
const imageAiProbePath = fileURLToPath(new URL("../image-ai/macos-runtime-probe.py", import.meta.url));
const chatterboxProbePath = fileURLToPath(new URL("../chatterbox/macos-runtime-probe.py", import.meta.url));
const fingerprintFiles = [
  "tooling/testing/macos-runtime.mjs",
  "scripts/validate-macos-runtime.mjs",
  "tooling/video-ai/macos-runtime-probe.py",
  "tooling/video-ai/macos-sttn-probe.py",
  "tooling/video-ai/macos-real-media-probe.py",
  "tooling/video-ai/verify-macos-real-media-output.py",
  "tooling/video-ai/macos-sttn-validation-assets.mjs",
  "tooling/video-ai/create-macos-sttn-validation-manifest.mjs",
  "tooling/video-ai/prepare-macos-sttn-validation-assets.mjs",
  "tooling/video-ai/macos-propainter-probe.py",
  "scripts/validate-video-ai-sequence.py",
  "scripts/video-ai-worker.py",
  "scripts/video_ai_device.py",
  "scripts/video_ai_sttn.py",
  "scripts/video_ai_propainter.py",
  "tooling/video-ai/macos-propainter-validation-assets.mjs",
  "tooling/video-ai/create-macos-propainter-validation-manifest.mjs",
  "tooling/video-ai/prepare-macos-propainter-validation-assets.mjs",
  "tooling/video-ai/sequence-sources.json",
  "tooling/video-ai/sequence-bundle.mjs",
  "tooling/image-ai/macos-runtime-probe.py",
  "tooling/image-ai/generate-macos-validation-samples.py",
  "tooling/image-ai/create-macos-validation-manifest.mjs",
  "tooling/chatterbox/macos-runtime-probe.py",
  "tooling/chatterbox/create-macos-validation-manifest.mjs",
  "tooling/chatterbox/generate-macos-validation-samples.mjs",
  "tooling/components/prepare-chatterbox-component.mjs",
  "tooling/components/prepare-image-ai-component.mjs",
  "scripts/image-ai-worker.py",
  "scripts/chatterbox-worker.py",
  "docs/macos-runtime-validation.md",
  "package.json",
  "pnpm-lock.yaml"
];

const macosRuntimeCases = Object.freeze({
  "M01-01-python-runtime": Object.freeze({
    id: "M01-01-python-runtime",
    description:
      "Check the isolated Python 3.12 arm64 runtime, SSL, SQLite and venv without installing packages or loading models.",
    modelValidation: "not_run",
    executionMode: "python-runtime",
    probePath: pythonRuntimeProbePath
  }),
  "M01-02-image-ai": Object.freeze({
    id: "M01-02-image-ai",
    description:
      "Run the pinned PaddleOCR, Big-LaMa, Real-ESRGAN x2/x4 and BiRefNet worker paths on fixed synthetic inputs using CPU.",
    modelValidation: "required",
    executionMode: "cpu",
    requestedDevice: "cpu",
    probePath: imageAiProbePath,
    expectedAssets: IMAGE_AI_MODEL_ASSETS.map((asset) => ({
      id: `image-model:${asset.name}`,
      path: asset.relativePath,
      sha256: asset.sha256
    }))
  }),
  "M01-03-chatterbox": Object.freeze({
    id: "M01-03-chatterbox",
    description:
      "Run pinned Chatterbox CPU generation for Malay, English and Brazilian Portuguese, then test native MPS inference when available.",
    modelValidation: "required",
    executionMode: "cpu+mps",
    requestedDevice: "cpu",
    probePath: chatterboxProbePath,
    expectedAssets: CHATTERBOX_MODEL_ASSETS.map((asset) => ({
      id: `chatterbox-model:${asset.name}`,
      path: asset.relativePath,
      sha256: asset.sha256
    }))
  }),
  "M01-04-sttn": Object.freeze({
    id: "M01-04-sttn",
    description:
      "Validate the pinned STTN encoder, temporal attention, decoder, original-resolution tiling, full Worker video/audio output and cancellation on native MPS, with explicit CPU fallback only if MPS fails.",
    modelValidation: "required",
    executionMode: "mps-first",
    requestedDevice: "mps",
    probePath: fileURLToPath(new URL("../video-ai/macos-sttn-probe.py", import.meta.url)),
    expectedAssets: STTN_MACOS_VALIDATION_ASSETS.map((asset) => ({
      id: asset.id,
      path: asset.path,
      sha256: asset.sha256
    }))
  }),
  "M01-05-propainter-video": Object.freeze({
    id: "M01-05-propainter-video",
    description:
      "Validate pinned ProPainter RAFT bidirectional flow, flow completion, repair and full Worker video processing on native MPS, with only the unsupported deform-conv operator explicitly executed on CPU.",
    modelValidation: "required",
    executionMode: "mps-first",
    requestedDevice: "mps",
    probePath: fileURLToPath(new URL("../video-ai/macos-propainter-probe.py", import.meta.url)),
    expectedAssets: PROPAINTER_MACOS_VALIDATION_ASSETS.map((asset) => ({
      id: asset.id,
      path: asset.path,
      sha256: asset.sha256
    }))
  })
});

const macosRuntimeHelp = `Usage:
  pnpm validate:macos --preflight --python <absolute-path> --assets <absolute-directory> --output <new-absolute-directory>
  pnpm validate:macos --case <id> --python <absolute-path> --assets <absolute-directory> --output <new-absolute-directory> [--timeout-ms <milliseconds>]

Options:
  --preflight             Check this Mac, Node 24, Python 3.12 arm64, asset digests and a new output path only.
  --case <id>             Run one allowlisted validation case in an isolated child process.
  --python <path>         Existing executable Python 3.12 interpreter (absolute path).
  --assets <directory>    Existing assets directory containing manifest.json (absolute path).
  --output <directory>    New, non-existing output directory (absolute path).
  --timeout-ms <number>   Child-process timeout from ${MIN_TIMEOUT_MS} to ${MAX_TIMEOUT_MS} ms (default ${DEFAULT_TIMEOUT_MS}).
  -h, --help              Show this help without requiring other arguments.

Preflight never downloads or installs, loads models, or starts the application. A passing preflight reports modelValidation: not_run.
Runnable cases: M01-01-python-runtime, M01-02-image-ai, M01-03-chatterbox, M01-04-sttn and M01-05-propainter-video. Each run writes report.json to its new output directory.`;

export function parseMacosRuntimeArgs(argv) {
  if (argv.includes("--help") || argv.includes("-h")) return { help: true, helpText: macosRuntimeHelp };

  const { values } = parseArgs({
    args: argv,
    options: {
      preflight: { type: "boolean" },
      case: { type: "string" },
      python: { type: "string" },
      assets: { type: "string" },
      output: { type: "string" },
      "timeout-ms": { type: "string" },
      help: { type: "boolean", short: "h" }
    },
    strict: true,
    allowPositionals: false
  });

  if (values.preflight && values.case) throw new Error("--preflight and --case cannot be combined");
  if (!values.preflight && !values.case) throw new Error("Choose --preflight or --case <id>; use --help for usage");
  if (!values.python || !values.assets || !values.output)
    throw new Error("--python, --assets and --output are required; use --help for usage");

  const timeoutText = values["timeout-ms"];
  if (values.preflight && timeoutText !== undefined) throw new Error("--timeout-ms applies only to --case runs");
  const timeoutMs = timeoutText === undefined ? DEFAULT_TIMEOUT_MS : Number(timeoutText);
  if (!Number.isInteger(timeoutMs) || timeoutMs < MIN_TIMEOUT_MS || timeoutMs > MAX_TIMEOUT_MS)
    throw new Error(`--timeout-ms must be an integer from ${MIN_TIMEOUT_MS} to ${MAX_TIMEOUT_MS}`);

  return {
    help: false,
    mode: values.preflight ? "preflight" : "case",
    caseId: values.case ?? null,
    python: values.python,
    assets: values.assets,
    output: values.output,
    timeoutMs
  };
}

function validateMacosHost(host) {
  if (host.platform !== "darwin" || host.arch !== "arm64")
    throw new Error(`macOS runtime validation requires darwin-arm64; detected ${host.platform}-${host.arch}`);
  const major = Number.parseInt(String(host.osVersion ?? "").split(".")[0], 10);
  if (!Number.isInteger(major) || major < 14)
    throw new Error(`macOS 14 or later is required; detected ${host.osVersion ?? "unknown"}`);
  if (!Number.isFinite(host.memoryBytes) || host.memoryBytes <= 0)
    throw new Error("Unable to read host memory in bytes");
}

export async function runMacosRuntime(options, dependencies = {}) {
  const repoRoot = path.resolve(dependencies.repoRoot ?? moduleRoot);
  const caseDefinitions = dependencies.caseDefinitions ?? macosRuntimeCases;
  const caseDefinition = options.mode === "case" ? caseDefinitions[options.caseId] : null;
  const outputDirectory = await createNewOutputDirectory(options.output);
  const startedAt = new Date().toISOString();
  const startTime = performance.now();
  const host = dependencies.host ?? detectHost();
  const report = {
    schemaVersion: 1,
    runId: randomUUID(),
    commit: null,
    dirty: null,
    host: {
      platform: host.platform,
      arch: host.arch,
      osVersion: host.osVersion,
      memoryBytes: host.memoryBytes
    },
    nodeVersion: process.versions.node,
    caseId: options.mode === "case" ? options.caseId : null,
    environmentFingerprint: null,
    runnerSourceSha256: null,
    assetManifestSha256: null,
    assetHashes: {},
    requestedDevice: caseDefinition?.requestedDevice ?? null,
    executionMode: options.mode === "preflight" ? "preflight" : (caseDefinition?.executionMode ?? "python-runtime"),
    status: "fail",
    modelValidation: "not_run",
    startedAt,
    durationMs: null,
    peakRssBytes: null,
    peakRssSamplingMethod: "macOS ps RSS kilobytes multiplied by 1024; direct child process; best effort",
    peakMpsBytes: null,
    input: { sha256: null, frames: null, width: null, height: null },
    output: { sha256: null, frames: null, width: null, height: null },
    exitCode: null,
    error: null,
    humanQuality: "pending",
    paths: {
      python: path.resolve(options.python),
      assets: path.resolve(options.assets),
      output: outputDirectory
    }
  };

  try {
    dependencies.signal?.throwIfAborted();
    validateMacosHost(host);
    const nodeVersion = dependencies.nodeVersion ?? process.versions.node;
    if (!nodeVersion.startsWith("24.")) throw new Error(`Node.js 24.x is required; detected ${nodeVersion}`);
    if (options.mode === "case" && !Object.hasOwn(caseDefinitions, options.caseId))
      throw new Error(
        `Unsupported case '${options.caseId}'. Supported cases: ${Object.keys(caseDefinitions).join(", ")}`
      );

    const childEnvironment = await createIsolatedEnvironment(outputDirectory);
    await verifyPythonExecutable(options.python);
    const pythonInfo = await (dependencies.inspectPython ?? inspectPython)(options.python, {
      spawnSync: dependencies.spawnSync ?? spawnSync,
      env: childEnvironment
    });
    if (!pythonInfo.version.startsWith(`${PYTHON_VERSION}.`))
      throw new Error(`Python ${PYTHON_VERSION}.x is required; detected ${pythonInfo.version}`);
    if (pythonInfo.machine !== "arm64") throw new Error(`Python must be native arm64; detected ${pythonInfo.machine}`);

    const assets = await verifyAssets(options.assets, dependencies.signal, caseDefinition?.expectedAssets ?? []);
    report.assetManifestSha256 = assets.manifestSha256;
    report.assetHashes = assets.assetHashes;
    const repoInfo = dependencies.repoInfo ?? readRepoInfo(repoRoot);
    report.commit = repoInfo.commit;
    report.dirty = repoInfo.dirty;
    const sourceFingerprint = await hashRunnerSources(repoRoot);
    report.runnerSourceSha256 = sourceFingerprint;
    report.environmentFingerprint = hashJson({
      node: nodeVersion,
      pythonInfo,
      host: report.host,
      manifestSha256: assets.manifestSha256,
      assetHashes: assets.assetHashes,
      runnerSourceSha256: sourceFingerprint
    });

    if (options.mode === "preflight") {
      report.status = "pass";
      report.exitCode = 0;
    } else {
      const probeResult = await runProbe({
        python: path.resolve(options.python),
        assetsDirectory: path.resolve(options.assets),
        outputDirectory,
        caseId: options.caseId,
        caseDefinition,
        timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        env: childEnvironment,
        signal: dependencies.signal,
        spawnChild: dependencies.spawn ?? spawn,
        sampleRss: dependencies.sampleRss ?? sampleChildRss
      });
      report.peakRssBytes = probeResult.peakRssBytes;
      report.stdout = probeResult.stdout;
      report.stderr = probeResult.stderr;
      report.outputCapture = {
        maxBytesPerStream: MAX_CAPTURE_BYTES,
        stdoutTruncated: probeResult.stdoutTruncated,
        stderrTruncated: probeResult.stderrTruncated
      };
      report.exitCode = probeResult.exitCode;
      if (probeResult.termination === "cancelled") {
        report.status = "blocked";
        if (caseDefinition?.modelValidation === "required") report.modelValidation = "blocked";
        report.error = { code: "cancelled", message: "Validation was cancelled by the caller" };
        report.exitCode = null;
      } else if (probeResult.termination === "timeout") {
        report.status = "fail";
        if (caseDefinition?.modelValidation === "required") report.modelValidation = "fail";
        report.error = { code: "timeout", message: `Validation child exceeded ${options.timeoutMs} ms` };
      } else if (probeResult.exitCode !== 0) {
        report.status = "fail";
        if (caseDefinition?.modelValidation === "required") report.modelValidation = "fail";
        report.error = {
          code: "child_exit",
          message: `Validation child exited with code ${probeResult.exitCode ?? "null"} and signal ${probeResult.signal ?? "none"}`
        };
      } else {
        const probeReportPath = path.join(outputDirectory, "probe-result.json");
        if (caseDefinition?.modelValidation === "required") {
          report.modelValidation = "fail";
          const probeReport = JSON.parse(await readFile(probeReportPath, "utf8"));
          if (
            probeReport.caseId !== options.caseId ||
            probeReport.status !== "pass" ||
            probeReport.modelValidation !== "pass"
          )
            throw new Error("Image AI probe did not record a complete real-model pass");
          report.output.sha256 = await hashFile(probeReportPath);
          report.modelValidation = "pass";
          if (caseDefinition?.executionMode === "cpu+mps") {
            report.mpsValidation = probeReport.mpsValidation?.status ?? "not_run";
            report.mpsFailure = probeReport.mpsValidation?.failure ?? null;
          }
          if (caseDefinition?.executionMode === "mps-first") {
            report.mpsValidation = probeReport.mpsValidation?.status ?? "not_run";
            report.mpsFailure = probeReport.mpsValidation?.failure ?? null;
            report.executionDevice = probeReport.executionDevice ?? null;
            report.peakMpsBytes = probeReport.peakMpsBytes ?? probeReport.selectedRun?.mpsPeakDriverBytes ?? null;
            report.video = probeReport.selectedRun?.video ?? null;
            report.cancellation = probeReport.cancellation ?? null;
            report.humanQuality = probeReport.humanQuality ?? "pending";
            report.selectedRun = probeReport.selectedRun ?? null;
            report.verticalRun = probeReport.verticalRun ?? null;
            report.singleFrameScene = probeReport.singleFrameScene ?? null;
            report.overLimitFailureRelease = probeReport.overLimitFailureRelease ?? null;
            report.fp16Comparison = probeReport.fp16Comparison ?? null;
            report.executionDetails = {
              deformConvCpuIsland: probeReport.selectedRun?.deformConvCpuIsland ?? null,
              col2imCpuIsland: probeReport.selectedRun?.col2imCpuIsland ?? null,
              unregisteredMpsFallbackWarnings: probeReport.unregisteredMpsFallbackWarnings ?? null,
              stageCalls: probeReport.selectedRun?.stageCalls ?? null,
              stageTimingsMs: probeReport.selectedRun?.stageTimingsMs ?? null,
              adapterReady: probeReport.assets?.bundleAdapterReady ?? null
            };
            report.input = {
              sha256: probeReport.source?.sha256 ?? null,
              frames: probeReport.source?.frames ?? null,
              width: probeReport.source?.width ?? null,
              height: probeReport.source?.height ?? null
            };
            report.output = {
              sha256: probeReport.output?.sha256 ?? null,
              frames: probeReport.selectedRun?.video?.frames ?? null,
              width: probeReport.selectedRun?.video?.width ?? null,
              height: probeReport.selectedRun?.video?.height ?? null
            };
          }
        } else {
          report.status = "pass";
          try {
            report.output.sha256 = await hashFile(probeReportPath);
          } catch {
            report.output.sha256 = null;
          }
        }
        report.status = "pass";
      }
    }
  } catch (error) {
    const cancelled = dependencies.signal?.aborted === true;
    report.status = cancelled ? "blocked" : "fail";
    report.error = {
      code: cancelled ? "cancelled" : "preflight_failed",
      message: cancelled
        ? "Validation was cancelled by the caller"
        : error instanceof Error
          ? error.message
          : String(error)
    };
    report.exitCode = cancelled ? null : 1;
  }

  report.durationMs = Math.max(0, Math.round(performance.now() - startTime));
  await writeFile(path.join(outputDirectory, "report.json"), `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
  return { exitCode: report.status === "pass" ? 0 : report.status === "blocked" ? 130 : 1, report };
}

async function createNewOutputDirectory(value) {
  if (typeof value !== "string" || !path.isAbsolute(value)) throw new Error("--output must be an absolute path");
  const resolved = path.resolve(value);
  const parent = path.dirname(resolved);
  let parentInfo;
  try {
    parentInfo = await stat(parent);
    await access(parent, fsConstants.W_OK);
  } catch {
    throw new Error("--output parent must be an existing writable directory");
  }
  if (!parentInfo.isDirectory()) throw new Error("--output parent must be an existing directory");
  try {
    await lstat(resolved);
    throw new Error("--output must be a new directory; it already exists");
  } catch (error) {
    if (error instanceof Error && error.message.includes("must be a new directory")) throw error;
    if (error?.code !== "ENOENT") throw error;
  }
  try {
    await mkdir(resolved, { mode: 0o700 });
  } catch (error) {
    if (error?.code === "EEXIST") throw new Error("--output must be a new directory; it already exists");
    throw error;
  }
  return resolved;
}

function detectHost() {
  const host = { platform: process.platform, arch: process.arch, osVersion: null, memoryBytes: os.totalmem() };
  if (host.platform === "darwin") {
    const result = spawnSync("/usr/bin/sw_vers", ["-productVersion"], { encoding: "utf8", timeout: 3000 });
    if (!result.error && result.status === 0) host.osVersion = result.stdout.trim();
  }
  return host;
}

async function inspectPython(python, { spawnSync: spawnSyncImpl, env }) {
  const source =
    "import json,platform,sys;print(json.dumps({'version':'.'.join(map(str,sys.version_info[:3])),'machine':platform.machine()}))";
  const result = spawnSyncImpl(python, ["-I", "-c", source], {
    encoding: "utf8",
    timeout: 10000,
    windowsHide: true,
    env
  });
  if (result.error) throw new Error(`Unable to inspect Python interpreter: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`Python interpreter probe failed with exit code ${result.status}`);
  let info;
  try {
    info = JSON.parse(result.stdout.trim());
  } catch {
    throw new Error("Python interpreter returned an invalid version probe");
  }
  if (typeof info.version !== "string" || typeof info.machine !== "string")
    throw new Error("Python interpreter returned incomplete version information");
  return info;
}

async function verifyPythonExecutable(python) {
  if (typeof python !== "string" || !path.isAbsolute(python)) throw new Error("--python must be an absolute path");
  try {
    const info = await stat(python);
    if (!info.isFile()) throw new Error("--python must point to an executable file");
    await access(python, fsConstants.X_OK);
  } catch {
    throw new Error(`Python interpreter is missing or not executable: ${python}`);
  }
}

async function verifyAssets(assetsDirectory, signal, expectedAssets = []) {
  if (typeof assetsDirectory !== "string" || !path.isAbsolute(assetsDirectory))
    throw new Error("--assets must be an absolute directory path");
  const assetsRoot = await realpath(assetsDirectory).catch(() => null);
  if (!assetsRoot) throw new Error(`Assets directory does not exist: ${assetsDirectory}`);
  const rootInfo = await stat(assetsRoot);
  if (!rootInfo.isDirectory()) throw new Error("--assets must point to a directory");
  const manifestPath = path.join(assetsRoot, "manifest.json");
  const manifestInfo = await lstat(manifestPath).catch(() => null);
  if (!manifestInfo?.isFile()) throw new Error("Assets directory must contain a regular manifest.json file");
  if (manifestInfo.size > 4 * 1024 * 1024) throw new Error("assets manifest.json exceeds the 4 MiB size limit");

  const manifestBytes = await readFile(manifestPath, { signal });
  let manifest;
  try {
    manifest = JSON.parse(manifestBytes.toString("utf8"));
  } catch {
    throw new Error("assets manifest.json is not valid JSON");
  }
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.resources))
    throw new Error("assets manifest.json must use schemaVersion 1 and a resources array");

  const ids = new Set();
  const paths = new Set();
  const assetHashes = Object.create(null);
  for (const resource of manifest.resources) {
    signal?.throwIfAborted();
    if (!resource || typeof resource.id !== "string" || !resource.id.trim())
      throw new Error("Every asset resource must have a non-empty id");
    if (ids.has(resource.id)) throw new Error(`Duplicate resource id in asset manifest: ${resource.id}`);
    ids.add(resource.id);
    if (typeof resource.path !== "string" || !isSafeManifestPath(resource.path))
      throw new Error(`Unsafe resource path in asset manifest: ${String(resource.path)}`);
    if (paths.has(resource.path)) throw new Error(`Duplicate resource path in asset manifest: ${resource.path}`);
    paths.add(resource.path);
    if (typeof resource.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(resource.sha256))
      throw new Error(`Resource ${resource.id} must declare a SHA-256 digest`);

    const parts = resource.path.split("/");
    let target = assetsRoot;
    let targetInfo;
    for (const [index, part] of parts.entries()) {
      target = path.join(target, part);
      targetInfo = await lstat(target).catch(() => null);
      const final = index === parts.length - 1;
      if (!targetInfo || targetInfo.isSymbolicLink() || (final ? !targetInfo.isFile() : !targetInfo.isDirectory()))
        throw new Error(`Asset file is missing, linked or not regular: ${resource.path}`);
    }
    const targetRealPath = await realpath(target);
    if (!isWithin(assetsRoot, targetRealPath))
      throw new Error(`Asset path escapes the assets directory: ${resource.path}`);
    const actualSha256 = await hashFile(targetRealPath, signal);
    if (actualSha256.toLowerCase() !== resource.sha256.toLowerCase())
      throw new Error(
        `SHA-256 mismatch for asset ${resource.id}: expected ${resource.sha256}, received ${actualSha256}`
      );
    assetHashes[resource.id] = actualSha256;
  }

  for (const expected of expectedAssets) {
    const resource = manifest.resources.find((candidate) => candidate.id === expected.id);
    if (!resource || resource.path !== expected.path || resource.sha256.toLowerCase() !== expected.sha256.toLowerCase())
      throw new Error(`Pinned case asset is missing or changed: ${expected.id}`);
  }

  return {
    manifestSha256: hashBytes(manifestBytes),
    assetHashes
  };
}

function isSafeManifestPath(value) {
  if (!value || value.includes("\\") || value.includes(":")) return false;
  if (path.posix.isAbsolute(value) || path.win32.isAbsolute(value)) return false;
  const parts = value.split("/");
  return parts.every((part) => part && part !== "." && part !== "..");
}

function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

async function hashRunnerSources(repoRoot) {
  const digest = createHash("sha256");
  for (const relative of fingerprintFiles) {
    digest.update(relative);
    digest.update("\0");
    digest.update(await readFile(path.join(repoRoot, relative)));
    digest.update("\0");
  }
  return digest.digest("hex");
}

function readRepoInfo(repoRoot) {
  const commit = spawnSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8", timeout: 3000 });
  const status = spawnSync("git", ["status", "--porcelain", "--untracked-files=normal"], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 3000
  });
  return {
    commit: !commit.error && commit.status === 0 ? commit.stdout.trim() : null,
    dirty: !status.error && status.status === 0 ? status.stdout.trim().length > 0 : null
  };
}

async function createIsolatedEnvironment(outputDirectory, inherited = process.env) {
  const allowed = Object.fromEntries(
    Object.entries(inherited).filter(([key]) =>
      /^(?:path|systemroot|windir|comspec|pathext|lang|lc_all|tmpdir)$/i.test(key)
    )
  );
  const root = outputDirectory;
  const directories = {
    TEMP: path.join(root, "temp"),
    TMP: path.join(root, "temp"),
    TMPDIR: path.join(root, "temp"),
    HOME: path.join(root, "home"),
    XDG_CACHE_HOME: path.join(root, "cache"),
    HF_HOME: path.join(root, "cache", "hf"),
    TORCH_HOME: path.join(root, "cache", "torch"),
    IMAGE_AI_STORAGE_ROOT: path.join(root, "storage", "image-ai"),
    VIDEO_AI_STORAGE_ROOT: path.join(root, "storage", "video-ai"),
    CHATTERBOX_STORAGE_ROOT: path.join(root, "storage", "chatterbox")
  };
  // These directories are inside the explicit run output and contain no user data.
  await Promise.all(Object.values(directories).map((directory) => mkdir(directory, { recursive: true, mode: 0o700 })));
  return {
    ...allowed,
    ...directories,
    PYTHONDONTWRITEBYTECODE: "1",
    PYTHONNOUSERSITE: "1",
    PYTHONUTF8: "1",
    PYTHONSAFEPATH: "1",
    HF_HUB_OFFLINE: "1",
    TRANSFORMERS_OFFLINE: "1",
    HF_DATASETS_OFFLINE: "1",
    CUDA_VISIBLE_DEVICES: "",
    PYTORCH_ENABLE_MPS_FALLBACK: "0",
    TOOLBOX_DESKTOP_MANAGED: "0"
  };
}

async function runProbe({
  python,
  assetsDirectory,
  outputDirectory,
  caseId,
  caseDefinition,
  timeoutMs,
  env,
  signal,
  spawnChild,
  sampleRss
}) {
  const args = [
    "-I",
    "-B",
    caseDefinition.probePath,
    "--output-dir",
    outputDirectory,
    "--assets-dir",
    assetsDirectory,
    "--case",
    caseId
  ];
  return runBoundedChild({
    command: python,
    args,
    cwd: outputDirectory,
    env,
    timeoutMs,
    signal,
    spawnChild,
    sampleRss
  });
}

function runBoundedChild({
  command,
  args,
  cwd,
  env,
  timeoutMs,
  signal,
  spawnChild = spawn,
  sampleRss = sampleChildRss
}) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawnChild(command, args, {
        cwd,
        env,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        detached: process.platform === "darwin"
      });
    } catch (error) {
      reject(error);
      return;
    }

    const captures = {
      stdout: [],
      stderr: [],
      stdoutBytes: 0,
      stderrBytes: 0,
      stdoutTruncated: false,
      stderrTruncated: false
    };
    let peakRssBytes = null;
    let termination = null;
    let settled = false;
    let timeoutTimer = null;
    let memoryTimer = null;
    let killTimer = null;
    let hardStopTimer = null;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      clearTimeout(killTimer);
      clearTimeout(hardStopTimer);
      clearInterval(memoryTimer);
      signal?.removeEventListener("abort", onAbort);
      resolve({
        ...result,
        termination,
        peakRssBytes,
        stdout: Buffer.concat(captures.stdout).toString("utf8"),
        stderr: Buffer.concat(captures.stderr).toString("utf8"),
        stdoutTruncated: captures.stdoutTruncated,
        stderrTruncated: captures.stderrTruncated
      });
    };
    const capture = (name, chunk) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      const bytesKey = `${name}Bytes`;
      const chunks = captures[name];
      const remaining = Math.max(0, MAX_CAPTURE_BYTES - captures[bytesKey]);
      if (remaining) chunks.push(buffer.subarray(0, remaining));
      captures[bytesKey] += buffer.length;
      if (captures[bytesKey] > MAX_CAPTURE_BYTES) captures[`${name}Truncated`] = true;
    };
    child.stdout?.on("data", (chunk) => capture("stdout", chunk));
    child.stderr?.on("data", (chunk) => capture("stderr", chunk));
    child.once("error", (error) => {
      if (settled) return;
      clearTimeout(timeoutTimer);
      clearTimeout(killTimer);
      clearTimeout(hardStopTimer);
      clearInterval(memoryTimer);
      signal?.removeEventListener("abort", onAbort);
      reject(error);
    });
    child.once("close", (exitCode, childSignal) => finish({ exitCode, signal: childSignal }));

    const terminate = (reason) => {
      if (settled || termination) return;
      termination = reason;
      killProcess(child, "SIGTERM");
      killTimer = setTimeout(() => {
        killProcess(child, "SIGKILL");
        hardStopTimer = setTimeout(() => finish({ exitCode: null, signal: "SIGKILL" }), 2000);
        hardStopTimer.unref?.();
      }, 1000);
      killTimer.unref?.();
    };
    const onAbort = () => terminate("cancelled");
    if (signal?.aborted) onAbort();
    else signal?.addEventListener("abort", onAbort, { once: true });

    timeoutTimer = setTimeout(() => terminate("timeout"), timeoutMs);
    timeoutTimer.unref?.();
    memoryTimer = setInterval(async () => {
      if (!child.pid) return;
      try {
        const rss = await sampleRss(child.pid);
        if (Number.isFinite(rss)) peakRssBytes = Math.max(peakRssBytes ?? 0, rss);
      } catch {
        // A process can exit between ps sampling and the read; keep the prior sample.
      }
    }, 250);
    memoryTimer.unref?.();
  });
}

function killProcess(child, signal) {
  try {
    if (process.platform === "darwin" && Number.isInteger(child.pid) && child.pid > 0) process.kill(-child.pid, signal);
    else child.kill?.(signal);
  } catch {
    try {
      child.kill?.(signal);
    } catch {
      // The process may already have exited.
    }
  }
}

function sampleChildRss(pid) {
  const result = spawnSync("/bin/ps", ["-o", "rss=", "-p", String(pid)], { encoding: "utf8", timeout: 1000 });
  if (result.error || result.status !== 0) return null;
  const kibibytes = Number.parseInt(result.stdout.trim(), 10);
  return Number.isFinite(kibibytes) && kibibytes >= 0 ? kibibytes * 1024 : null;
}

function hashBytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function hashJson(value) {
  return hashBytes(Buffer.from(JSON.stringify(value)));
}

async function hashFile(filename, signal) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filename, signal ? { signal } : undefined)) hash.update(chunk);
  return hash.digest("hex");
}
