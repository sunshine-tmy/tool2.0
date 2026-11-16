import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { once } from "node:events";
import { copyFile, cp, mkdir, mkdtemp, readFile, realpath, readdir, rm, stat, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateInTarget } from "./smoke-installed-desktop.mjs";

const options = parseArguments(process.argv.slice(2));
assert.equal(process.platform, "darwin", "Mac packaged process smoke must run on macOS");
assert.equal(process.arch, "arm64", "Mac packaged process smoke must run on Apple Silicon");

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const appPath = path.resolve(options.appBundle);
const executable = path.join(appPath, "Contents", "MacOS", "EcommerceToolbox");
const reportPath = path.resolve(options.reportPath);
const scratchRoot = await mkdtemp(path.join(os.tmpdir(), "toolbox-m06-packaged-smoke-"));
const home = path.join(scratchRoot, "home");
const temp = path.join(scratchRoot, "tmp");
const appDataRoot = path.join(scratchRoot, "Application Support");
const dataDirectory = path.join(appDataRoot, "EcommerceToolboxData");
await Promise.all([mkdir(home), mkdir(temp)]);
const workerSeed = options.exercisePackagedWorkers
  ? await seedWorkerComponents(dataDirectory, options.exerciseVideoAiWorker)
  : undefined;
const seededComponents = workerSeed?.components ?? [];

const unrelated = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
  stdio: "ignore",
  windowsHide: true
});
const unrelatedIdentity = await waitForIdentity(unrelated.pid);
const debugPort = await reserveLoopbackPort();
const child = spawn(executable, [`--remote-debugging-port=${debugPort}`], {
  detached: true,
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
  env: {
    ...process.env,
    HOME: home,
    TMPDIR: temp,
    TOOLBOX_ENABLE_ISOLATED_TEST_APP_DATA: "1",
    TOOLBOX_ISOLATED_TEST_APP_DATA_ROOT: appDataRoot
  }
});

let processOutput = "";
child.stdout.on("data", (chunk) => appendOutput(chunk));
child.stderr.on("data", (chunk) => appendOutput(chunk));
const startedAt = new Date().toISOString();
let origin;
let health;
let settings;
let preKillTree = [];
let appExit;
let remainedAfterKill = [];
let unrelatedSurvived;
let utilityProcessObserved = false;
let workerIntegration;
let status = "failed";
let errorMessage;

try {
  assert.ok(child.pid, "Packaged application did not start");
  ({ origin, health } = await waitForHealthyApp(debugPort, child, 120));
  const page = await waitForBusinessPage(debugPort, origin, child, 15_000);
  const settingsJson = await evaluateInTarget(
    page,
    `(async () => JSON.stringify(await window.toolboxDesktop.getSettings()))()`
  );
  assert.equal(typeof settingsJson, "string", "Desktop settings API did not return a JSON result");
  settings = JSON.parse(settingsJson);
  const expectedDataRoot = await realpath(dataDirectory);
  assert.equal(settings.installDirectory, appPath, "Desktop settings reported an unexpected app bundle path");
  assert.equal(settings.dataDirectory, expectedDataRoot, "Desktop settings escaped the isolated data root");
  const isolatedRoot = await realpath(expectedDataRoot);
  const dataInfo = await stat(isolatedRoot);
  assert.ok(dataInfo.isDirectory(), "Isolated persistent data root was not initialized");

  if (options.exercisePackagedWorkers) {
    workerIntegration = await exercisePackagedWorkers(
      origin,
      child.pid,
      temp,
      workerSeed.pythonBytecode,
      !options.exerciseVideoAiWorker
    );
  }
  if (options.exerciseVideoAiWorker) {
    workerIntegration.videoAiTask = await exercisePackagedVideoAi(origin, child.pid, temp, options.videoInputPath);
  }
  preKillTree = await processTree(child.pid);
  assert.ok(preKillTree.length > 0, "Packaged application did not start an owned utility process");
  utilityProcessObserved = preKillTree.some((entry) => entry.arguments.includes("--type=utility"));
  if (options.exercisePackagedWorkers && !options.exerciseVideoAiWorker) {
    const liveBrowserProcesses = preKillTree.filter(isSeededChromiumProcess);
    assert.ok(liveBrowserProcesses.length > 0, "The real Chromium worker exited before the forced owner kill");
    assert.ok(
      liveBrowserProcesses.some((entry) => workerIntegration.watcherRecordedPids.includes(entry.pid)),
      "The packaged app process guard did not record the live Chromium worker before the owner kill"
    );
    workerIntegration.liveBrowserPidsAtKill = liveBrowserProcesses.map((entry) => entry.pid);
    workerIntegration.browserParentChainsAtKill = liveBrowserProcesses.map((entry) =>
      processChain(child.pid, preKillTree, entry.pid)
    );
  }
  if (options.exerciseVideoAiWorker) {
    const activeWorkers = preKillTree.filter((entry) => ["python", "ffmpeg"].includes(workerProcessType(entry)));
    const activeTypes = new Set(activeWorkers.map(workerProcessType));
    const watcherRecordedPids = await recordedGuardPids(temp);
    for (const type of ["python", "ffmpeg"]) {
      assert.ok(activeTypes.has(type), `No active packaged ${type} worker remained before the owner kill`);
      assert.ok(
        activeWorkers.some((entry) => workerProcessType(entry) === type && watcherRecordedPids.includes(entry.pid)),
        `The packaged app process guard did not record the active ${type} worker before the owner kill`
      );
    }
    workerIntegration.videoAiTask.activeProcessesAtKill = activeWorkers.map((entry) => ({
      pid: entry.pid,
      parentPid: entry.ppid,
      workerType: workerProcessType(entry),
      parentChain: processChain(child.pid, preKillTree, entry.pid)
    }));
    workerIntegration.videoAiTask.watcherRecordedWorkerPids = watcherRecordedPids.filter((pid) =>
      activeWorkers.some((entry) => entry.pid === pid)
    );
  }

  child.kill("SIGKILL");
  appExit = await waitForExit(child, 10_000);
  remainedAfterKill = await waitForKnownProcesses(preKillTree, 15_000);
  unrelatedSurvived = currentIdentity(unrelated.pid) === unrelatedIdentity;
  assert.deepEqual(remainedAfterKill, [], "Owned packaged application processes remained after forced owner exit");
  assert.equal(utilityProcessObserved, true, "Packaged application utility process was not observed");
  assert.equal(unrelatedSurvived, true, "Process cleanup touched an unrelated Node process");
  status = "passed";
} catch (error) {
  errorMessage = error instanceof Error ? error.message : String(error);
  if (processOutput) errorMessage += `; packaged app output: ${processOutput.slice(-4_000)}`;
} finally {
  if (child.exitCode === null && child.pid) {
    if (!preKillTree.length) preKillTree = await processTree(child.pid).catch(() => []);
    utilityProcessObserved ||= preKillTree.some((entry) => entry.arguments.includes("--type=utility"));
    child.kill("SIGKILL");
    appExit ??= await waitForExit(child, 10_000).catch(() => undefined);
    remainedAfterKill = await waitForKnownProcesses(preKillTree, 15_000).catch(() => remainedAfterKill);
  }
  if (unrelatedSurvived === undefined) unrelatedSurvived = currentIdentity(unrelated.pid) === unrelatedIdentity;
  if (unrelated.exitCode === null) unrelated.kill("SIGTERM");
  if (unrelated.pid) await waitForExit(unrelated, 5_000).catch(() => undefined);

  const report = {
    schemaVersion: 1,
    task: "M06-02 packaged macOS process lifecycle",
    status,
    startedAt,
    completedAt: new Date().toISOString(),
    appVersion: settings?.appVersion,
    appArchitecture: process.arch,
    appBundleName: path.basename(appPath),
    isolatedDataRootOutsideHome: true,
    isolatedDataRootInitialized: Boolean(settings?.dataDirectory),
    backendHealth: health,
    debugPort: status === "passed" ? debugPort : undefined,
    ownerPid: child.pid,
    observedDescendants: preKillTree.map((entry) => ({
      pid: entry.pid,
      parentPid: entry.ppid,
      name: entry.name,
      processType: entry.arguments.match(/--type=([a-z-]+)/)?.[1]
    })),
    utilityProcessObserved,
    ...(seededComponents.length ? { seededComponents } : {}),
    ...(workerIntegration ? { workerIntegration } : {}),
    ownerKilledWith: "SIGKILL",
    ownerExit: appExit ? { code: appExit.code, signal: appExit.signal } : undefined,
    ownedProcessesRemaining: remainedAfterKill,
    unrelatedProcessSurvived: unrelatedSurvived,
    ...(errorMessage ? { error: errorMessage } : {})
  };
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  if (status === "passed" && remainedAfterKill.length === 0) {
    const resolvedScratch = await realpath(scratchRoot);
    assert.equal(path.dirname(resolvedScratch), await realpath(os.tmpdir()));
    assert.match(path.basename(resolvedScratch), /^toolbox-m06-packaged-smoke-/);
    await rm(resolvedScratch, { recursive: true, force: true });
  }
}

if (status !== "passed") throw new Error(errorMessage || "Packaged process smoke failed");
console.log(`Packaged process lifecycle passed; report: ${reportPath}`);

function parseArguments(argv) {
  if (
    (argv.length !== 4 && argv.length !== 5 && argv.length !== 6) ||
    argv[0] !== "--app" ||
    argv[2] !== "--report" ||
    (argv.length === 5 && !["--exercise-browser-worker", "--exercise-packaged-workers"].includes(argv[4])) ||
    (argv.length === 6 && (argv[4] !== "--exercise-video-ai-worker" || !path.isAbsolute(argv[5])))
  ) {
    throw new Error(
      "Usage: node tooling/testing/macos-packaged-process-smoke.mjs --app <app-bundle> --report <report.json> [--exercise-packaged-workers | --exercise-video-ai-worker <absolute-video-path>]"
    );
  }
  if (!path.isAbsolute(argv[3])) throw new Error("--report must be an absolute path");
  return {
    appBundle: argv[1],
    reportPath: argv[3],
    exercisePackagedWorkers:
      argv[4] === "--exercise-browser-worker" ||
      argv[4] === "--exercise-packaged-workers" ||
      argv[4] === "--exercise-video-ai-worker",
    exerciseVideoAiWorker: argv[4] === "--exercise-video-ai-worker",
    videoInputPath: argv[4] === "--exercise-video-ai-worker" ? argv[5] : undefined
  };
}

async function seedWorkerComponents(dataDirectory, includeVideoAi = false) {
  const componentIds = ["python-312", "ffmpeg", "xhs-browser", ...(includeVideoAi ? ["video-ai"] : [])];
  const sourceRoot = await realpath(path.join(projectRoot, ".runtime", "packages"));
  const seeded = [];
  let pythonBytecode;
  for (const componentId of componentIds) {
    const sourcePackageRoot = path.join(sourceRoot, componentId);
    const current = JSON.parse(await readFile(path.join(sourcePackageRoot, "current.json"), "utf8"));
    assert.equal(current.id, componentId, `The local ${componentId} component record has an unexpected id`);
    assert.match(current.directory, /^[A-Za-z0-9._-]{1,120}$/, `The local ${componentId} version is unsafe`);
    assert.match(current.version, /^[A-Za-z0-9._-]{1,120}$/, `The local ${componentId} version is unsafe`);
    assert.ok(
      current.directory === current.version || current.directory.startsWith(`${current.version}-`),
      `The local ${componentId} generation does not match its version`
    );

    const targetPackageRoot = path.join(dataDirectory, "components", "packages", componentId);
    const targetVersion = path.join(targetPackageRoot, "versions", current.directory);
    await mkdir(path.dirname(targetVersion), { recursive: true });
    if (componentId === "python-312") {
      pythonBytecode = await extractVerifiedPythonArchive(targetVersion);
    } else {
      const sourceVersion = await realpath(path.join(sourcePackageRoot, "versions", current.directory));
      const relativeSource = path.relative(sourceRoot, sourceVersion);
      assert.ok(
        relativeSource &&
          !path.isAbsolute(relativeSource) &&
          relativeSource !== ".." &&
          !relativeSource.startsWith(`..${path.sep}`),
        `The local ${componentId} generation escaped the project package root`
      );
      await cp(sourceVersion, targetVersion, { recursive: true, preserveTimestamps: true });
    }
    await copyFile(path.join(sourcePackageRoot, "current.json"), path.join(targetPackageRoot, "current.json"));
    seeded.push({ id: componentId, version: current.version });
  }
  assert.ok(pythonBytecode, "Python bytecode verification metadata is missing");
  pythonBytecode.path = path.join(
    dataDirectory,
    "components",
    "packages",
    "python-312",
    "versions",
    JSON.parse(await readFile(path.join(dataDirectory, "components", "packages", "python-312", "current.json"), "utf8"))
      .directory,
    pythonBytecode.relativePath
  );
  pythonBytecode.beforeSha256 = await sha256File(pythonBytecode.path);
  assert.equal(
    pythonBytecode.beforeSha256,
    pythonBytecode.expectedSha256,
    "Seeded Python bytecode differs from its signed manifest"
  );
  return { components: seeded, pythonBytecode };
}

async function extractVerifiedPythonArchive(targetVersion) {
  const catalogPath = path.join(projectRoot, "apps/api/src/modules/components/catalog.darwin-arm64.generated.ts");
  const catalogSource = await readFile(catalogPath, "utf8");
  const jsonStart = catalogSource.indexOf("= {") + 2;
  const jsonEnd = catalogSource.lastIndexOf("} satisfies ComponentCatalog;");
  assert.ok(jsonStart > 1 && jsonEnd > jsonStart, "Unable to read the generated Mac component catalog");
  const catalog = JSON.parse(catalogSource.slice(jsonStart, jsonEnd + 1));
  const manifest = catalog.manifests.find((entry) => entry.id === "python-312");
  assert.ok(manifest, "The generated Mac catalog does not contain Python 3.12");
  assert.ok(!manifest.additionalArchives?.length, "Python archive unexpectedly requires additional parts");
  const bytecodeRelativePath = "python/lib/python3.12/__pycache__/__future__.cpython-312.pyc";
  const bytecodeFile = manifest.files.find((entry) => entry.path === bytecodeRelativePath);
  assert.ok(bytecodeFile, "Signed Python manifest does not list the bytecode verification file");

  const archiveName = decodeURIComponent(path.posix.basename(new URL(manifest.archive.url).pathname));
  const archivePath = path.join(projectRoot, "offline-resources/components", archiveName);
  const archiveInfo = await stat(archivePath);
  assert.equal(
    archiveInfo.size,
    manifest.archive.bytes,
    "The local Python archive size differs from the signed catalog"
  );
  assert.equal(
    await sha256File(archivePath),
    manifest.archive.sha256,
    "The local Python archive digest differs from the signed catalog"
  );

  const entries = execFileSync("/usr/bin/tar", ["-tzf", archivePath], { encoding: "utf8" }).trim().split(/\r?\n/);
  assert.ok(entries.length === manifest.files.length, "Python archive file count differs from the signed catalog");
  for (const entry of entries) {
    const segments = entry.split("/");
    assert.ok(
      !path.posix.isAbsolute(entry) &&
        !entry.includes("\\") &&
        segments.every((segment) => segment && segment !== "." && segment !== ".."),
      "Python archive contains an unsafe path"
    );
  }
  const verboseEntries = execFileSync("/usr/bin/tar", ["-tvzf", archivePath], { encoding: "utf8" })
    .trim()
    .split(/\r?\n/);
  assert.ok(
    verboseEntries.every((entry) => entry.startsWith("-")),
    "Python archive contains a non-regular entry"
  );

  await mkdir(targetVersion, { recursive: true });
  execFileSync("/usr/bin/tar", ["-xzf", archivePath, "--no-same-owner", "-C", targetVersion], {
    stdio: "ignore"
  });
  return { relativePath: bytecodeRelativePath, expectedSha256: bytecodeFile.sha256 };
}

async function sha256File(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

async function exercisePackagedWorkers(origin, ownerPid, tempRoot, pythonBytecode, includeBrowser = true) {
  const targetIds = ["integrity-python-312", "integrity-ffmpeg", ...(includeBrowser ? ["integrity-xhs-browser"] : [])];
  const attempts = [];
  const observedWorkerProcesses = new Map();
  const deadline = Date.now() + 120_000;
  let latestDiagnostic;

  while (Date.now() < deadline && attempts.length < 4) {
    const response = await fetch(`${origin}/api/v1/diagnostics/runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ depth: "deep", targets: targetIds, confirmed: true }),
      signal: AbortSignal.timeout(10_000)
    });
    assert.ok(response.ok, `Packaged diagnostics start returned HTTP ${response.status}`);
    const payload = await response.json();
    assert.equal(
      payload.success,
      true,
      `Packaged diagnostics start was rejected: ${payload.error?.error?.code ?? "unknown"}`
    );
    const runId = payload.data?.id;
    assert.equal(typeof runId, "string", "Packaged diagnostics did not return a run id");
    attempts.push(runId);

    while (Date.now() < deadline) {
      const descendants = await processTree(ownerPid);
      const liveBrowserProcesses = descendants.filter(isSeededChromiumProcess);
      for (const entry of descendants) {
        const workerType = workerProcessType(entry);
        if (workerType) observedWorkerProcesses.set(entry.pid, { workerType, pid: entry.pid, parentPid: entry.ppid });
      }
      const watcherRecordedPids = await recordedGuardPids(tempRoot);
      const browserRecordedByGuard = liveBrowserProcesses.filter((entry) => watcherRecordedPids.includes(entry.pid));
      latestDiagnostic = await readDiagnosticRun(origin, runId);
      if (includeBrowser && browserRecordedByGuard.length) {
        for (const targetId of targetIds.slice(0, -1)) {
          const check = latestDiagnostic.checks.find((item) => item.id === targetId);
          assert.equal(
            check?.status,
            "ok",
            `Packaged worker self-test failed for ${targetId}: ${check?.code ?? "missing check"}`
          );
        }
        const pythonBytecodeAfterSha256 = await sha256File(pythonBytecode.path);
        assert.equal(
          pythonBytecodeAfterSha256,
          pythonBytecode.expectedSha256,
          "Packaged Python self-test changed a signed bytecode file"
        );
        return {
          targetIds,
          attempts,
          diagnosticState: latestDiagnostic.state,
          diagnosticChecks: latestDiagnostic.checks.map((check) => ({ id: check.id, status: check.status })),
          observedWorkerProcesses: [...observedWorkerProcesses.values()],
          observedBrowserPids: liveBrowserProcesses.map((entry) => entry.pid),
          workerPidsRecordedByGuard: watcherRecordedPids.filter((pid) =>
            liveBrowserProcesses.some((entry) => entry.pid === pid)
          ),
          watcherRecordedPids,
          pythonBytecodeSelfTestIntegrity: {
            beforeSha256: pythonBytecode.beforeSha256,
            afterSha256: pythonBytecodeAfterSha256,
            matchesSignedManifest: pythonBytecodeAfterSha256 === pythonBytecode.expectedSha256
          }
        };
      }
      if (!includeBrowser && latestDiagnostic.state === "completed") {
        for (const targetId of targetIds) {
          const check = latestDiagnostic.checks.find((item) => item.id === targetId);
          assert.equal(
            check?.status,
            "ok",
            `Packaged worker self-test failed for ${targetId}: ${check?.code ?? "missing check"}`
          );
        }
        const pythonBytecodeAfterSha256 = await sha256File(pythonBytecode.path);
        assert.equal(
          pythonBytecodeAfterSha256,
          pythonBytecode.expectedSha256,
          "Packaged Python self-test changed a signed bytecode file"
        );
        await delay(300);
        return {
          targetIds,
          attempts,
          diagnosticState: latestDiagnostic.state,
          diagnosticChecks: latestDiagnostic.checks.map((check) => ({ id: check.id, status: check.status })),
          observedWorkerProcesses: [...observedWorkerProcesses.values()],
          browserIntegrationSkipped: true,
          watcherRecordedPids,
          pythonBytecodeSelfTestIntegrity: {
            beforeSha256: pythonBytecode.beforeSha256,
            afterSha256: pythonBytecodeAfterSha256,
            matchesSignedManifest: pythonBytecodeAfterSha256 === pythonBytecode.expectedSha256
          }
        };
      }
      if (latestDiagnostic.state !== "running") break;
      await delay(50);
    }

    if (latestDiagnostic?.state === "completed") {
      const check = latestDiagnostic.checks.find((item) => item.id === targetIds.at(-1));
      assert.equal(
        check?.status,
        "ok",
        `Packaged worker component self-test failed: ${check?.code ?? "missing check"}`
      );
    } else {
      assert.equal(
        latestDiagnostic?.state,
        "completed",
        "Packaged browser component self-test did not finish before the integration deadline"
      );
    }
  }

  throw new Error(
    `The packaged process guard did not observe a live Chromium worker; diagnostic state: ${latestDiagnostic?.state ?? "unavailable"}`
  );
}

async function exercisePackagedVideoAi(origin, ownerPid, tempRoot, videoPath) {
  const healthResponse = await fetch(`${origin}/api/v1/tools/video-ai/health`, {
    signal: AbortSignal.timeout(120_000)
  });
  assert.ok(healthResponse.ok, `Packaged video AI health returned HTTP ${healthResponse.status}`);
  const healthPayload = await healthResponse.json();
  assert.equal(healthPayload.success, true, "Packaged video AI health check failed");
  assert.ok(
    healthPayload.data?.engines?.some((engine) => engine.provider === "delogo" && engine.available),
    "Packaged video AI does not expose the local delogo smoke engine"
  );

  const source = await readFile(videoPath);
  const form = new FormData();
  form.set("mode", "delogo");
  form.set("manualArea", JSON.stringify({ x: 0.2, y: 0.78, width: 0.6, height: 0.16 }));
  form.set("video", new Blob([source], { type: "video/mp4" }), path.basename(videoPath));
  const createResponse = await fetch(`${origin}/api/v1/tools/video-ai/tasks`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(60_000)
  });
  const createPayload = await createResponse.json();
  assert.equal(
    createResponse.status,
    202,
    `Packaged video AI task returned HTTP ${createResponse.status} (${createPayload.error?.code ?? "unknown"})`
  );
  assert.equal(createPayload.success, true, "Packaged video AI task was rejected");
  const taskId = createPayload.data?.id;
  assert.equal(typeof taskId, "string", "Packaged video AI did not return a task id");

  const deadline = Date.now() + 120_000;
  const observed = new Map();
  let taskStatus = createPayload.data?.status ?? "pending";
  while (Date.now() < deadline) {
    const tree = await processTree(ownerPid);
    for (const entry of tree) {
      const workerType = workerProcessType(entry);
      if (workerType) observed.set(entry.pid, { pid: entry.pid, parentPid: entry.ppid, workerType });
    }
    const watcherRecordedPids = await recordedGuardPids(tempRoot);
    const activeWorkers = [...observed.values()].filter((entry) => currentIdentity(entry.pid));
    const recordedTypes = new Set(
      activeWorkers.filter((entry) => watcherRecordedPids.includes(entry.pid)).map((entry) => entry.workerType)
    );
    if (recordedTypes.has("python") && recordedTypes.has("ffmpeg")) {
      return {
        taskId,
        taskStatus,
        requiredProcessesRecorded: ["python", "ffmpeg"],
        observedProcesses: activeWorkers,
        watcherRecordedPids: watcherRecordedPids.filter((pid) => activeWorkers.some((entry) => entry.pid === pid))
      };
    }

    const taskResponse = await fetch(`${origin}/api/v1/tools/video-ai/tasks/${encodeURIComponent(taskId)}`, {
      signal: AbortSignal.timeout(5_000)
    });
    assert.ok(taskResponse.ok, `Packaged video AI task lookup returned HTTP ${taskResponse.status}`);
    const taskPayload = await taskResponse.json();
    assert.equal(taskPayload.success, true, "Packaged video AI task lookup failed");
    taskStatus = taskPayload.data?.status ?? taskStatus;
    if (taskStatus === "failed") throw new Error("Packaged video AI smoke task failed before worker capture");
    await delay(20);
  }
  throw new Error(
    `Packaged video AI did not expose active watched Python and FFmpeg workers before timeout; task=${taskStatus}; observed=${JSON.stringify([...observed.values()])}`
  );
}

async function readDiagnosticRun(origin, runId) {
  const response = await fetch(`${origin}/api/v1/diagnostics/runs/${encodeURIComponent(runId)}`, {
    signal: AbortSignal.timeout(5_000)
  });
  assert.ok(response.ok, `Packaged diagnostics read returned HTTP ${response.status}`);
  const payload = await response.json();
  assert.equal(payload.success, true, "Packaged diagnostics read failed");
  return payload.data;
}

async function recordedGuardPids(tempRoot) {
  const pids = new Set();
  for (const entry of await readdir(tempRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith("toolbox-process-guard.")) continue;
    const knownPath = path.join(tempRoot, entry.name, "known");
    const content = await readFile(knownPath, "utf8").catch(() => "");
    for (const line of content.split(/\r?\n/)) {
      const pid = Number(line.split("|", 1)[0]);
      if (Number.isSafeInteger(pid) && pid > 1) pids.add(pid);
    }
  }
  return [...pids];
}

function isSeededChromiumProcess(entry) {
  return (
    entry.arguments.includes("/xhs-browser/versions/") &&
    entry.arguments.includes("Google Chrome for Testing") &&
    entry.arguments.includes("--headless")
  );
}

function workerProcessType(entry) {
  if (isSeededChromiumProcess(entry)) return "chromium";
  if (
    (entry.arguments.includes("/python-312/versions/") || entry.arguments.includes("/video-ai/versions/")) &&
    /python(?:3\.12)?(?:\/|\s|$)/.test(entry.arguments)
  )
    return "python";
  if (entry.arguments.includes("/ffmpeg/versions/") && /\/bin\/ffmpeg(?:\s|$)/.test(entry.arguments)) return "ffmpeg";
  return undefined;
}

function processChain(rootPid, entries, targetPid) {
  const byPid = new Map(entries.map((entry) => [entry.pid, entry]));
  const chain = [];
  let current = byPid.get(targetPid);
  while (current) {
    chain.push({
      pid: current.pid,
      parentPid: current.ppid,
      name: current.name,
      processType: current.arguments.match(/--type=([a-z-]+)/)?.[1]
    });
    if (current.ppid === rootPid) break;
    current = byPid.get(current.ppid);
  }
  assert.ok(chain.length > 0 && chain[0].pid === targetPid, "Unable to resolve the worker process ancestry");
  assert.equal(chain.at(-1).parentPid, rootPid, "The worker process ancestry escaped the packaged app");
  return chain.reverse();
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function appendOutput(chunk) {
  processOutput = `${processOutput}${chunk}`.slice(-16_000);
}

async function reserveLoopbackPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return address.port;
}

async function devtoolsTargets(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(2_000) });
  assert.ok(response.ok, `DevTools endpoint returned HTTP ${response.status}`);
  const targets = await response.json();
  assert.ok(Array.isArray(targets), "DevTools endpoint returned an invalid target list");
  return targets;
}

async function waitForBusinessPage(port, origin, appProcess, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastTargets = [];
  while (Date.now() < deadline) {
    if (appProcess.exitCode !== null)
      throw new Error(`Packaged app exited before business window (${appProcess.exitCode})`);
    try {
      lastTargets = await devtoolsTargets(port);
      const page = lastTargets.find(
        (target) => target?.type === "page" && typeof target.url === "string" && target.url.startsWith(origin)
      );
      if (page) return page;
    } catch {
      // The DevTools endpoint can briefly disappear during the first window navigation.
    }
    await delay(100);
  }
  throw new Error(`Packaged business window is missing; targets=${JSON.stringify(lastTargets)}`);
}

async function waitForHealthyApp(port, appProcess, timeoutSeconds) {
  const deadline = Date.now() + timeoutSeconds * 1_000;
  let lastError = "business window has not appeared";
  while (Date.now() < deadline) {
    if (appProcess.exitCode !== null) throw new Error(`Packaged app exited before ready (${appProcess.exitCode})`);
    try {
      const targets = await devtoolsTargets(port);
      const page = targets.find(
        (target) =>
          target?.type === "page" && typeof target.url === "string" && /^http:\/\/127\.0\.0\.1:/.test(target.url)
      );
      if (!page) throw new Error("Packaged business window has not appeared");
      const origin = new URL(page.url).origin;
      const ready = await fetch(`${origin}/health/ready`, { signal: AbortSignal.timeout(5_000) });
      const api = await fetch(`${origin}/api/v1/health`, { signal: AbortSignal.timeout(5_000) });
      if (!ready.ok || !api.ok) throw new Error(`Backend health endpoints returned ${ready.status}/${api.status}`);
      return { origin, health: { readyStatus: ready.status, apiHealthStatus: api.status } };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`Packaged desktop did not become healthy: ${lastError}`);
}

async function processSnapshot() {
  const output = execFileSync("/bin/ps", ["-axo", "pid=", "-o", "ppid=", "-o", "lstart=", "-o", "comm="], {
    encoding: "utf8",
    env: { ...process.env, LC_ALL: "C" }
  });
  const result = new Map();
  for (const line of output.split(/\r?\n/)) {
    const fields = line.trim().split(/\s+/);
    if (fields.length < 8 || !/^\d+$/.test(fields[0]) || !/^\d+$/.test(fields[1])) continue;
    const pid = Number(fields[0]);
    const ppid = Number(fields[1]);
    const started = fields.slice(2, 7).join(" ");
    const command = fields.slice(7).join(" ");
    result.set(pid, {
      pid,
      ppid,
      started,
      command,
      identity: `${started}|${command}`,
      name: path.basename(command),
      arguments: processArguments(pid)
    });
  }
  return result;
}

function processArguments(pid) {
  try {
    return execFileSync("/bin/ps", ["-p", String(pid), "-o", "args="], {
      encoding: "utf8",
      env: { ...process.env, LC_ALL: "C" }
    }).trim();
  } catch {
    return "";
  }
}

async function processTree(rootPid) {
  const snapshot = await processSnapshot();
  assert.ok(snapshot.has(rootPid), "Packaged process is not visible in the system process list");
  const parentIds = new Map();
  for (const entry of snapshot.values()) {
    const list = parentIds.get(entry.ppid) ?? [];
    list.push(entry.pid);
    parentIds.set(entry.ppid, list);
  }
  const descendants = [];
  const queue = [rootPid];
  while (queue.length) {
    const parent = queue.shift();
    for (const pid of parentIds.get(parent) ?? []) {
      const entry = snapshot.get(pid);
      if (!entry) continue;
      descendants.push(entry);
      queue.push(pid);
    }
  }
  return descendants;
}

function currentIdentity(pid) {
  return processSnapshotSync().get(pid)?.identity;
}

function processSnapshotSync() {
  const output = execFileSync("/bin/ps", ["-axo", "pid=", "-o", "ppid=", "-o", "lstart=", "-o", "comm="], {
    encoding: "utf8",
    env: { ...process.env, LC_ALL: "C" }
  });
  const result = new Map();
  for (const line of output.split(/\r?\n/)) {
    const fields = line.trim().split(/\s+/);
    if (fields.length < 8 || !/^\d+$/.test(fields[0])) continue;
    const command = fields.slice(7).join(" ");
    result.set(Number(fields[0]), { identity: `${fields.slice(2, 7).join(" ")}|${command}` });
  }
  return result;
}

async function waitForIdentity(pid) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const identity = currentIdentity(pid);
    if (identity) return identity;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Unable to inspect process identity for ${pid}`);
}

async function waitForKnownProcesses(entries, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const snapshot = processSnapshotSync();
    const remaining = entries.filter((entry) => snapshot.get(entry.pid)?.identity === entry.identity);
    if (!remaining.length) return [];
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const snapshot = processSnapshotSync();
  return entries
    .filter((entry) => snapshot.get(entry.pid)?.identity === entry.identity)
    .map((entry) => ({ pid: entry.pid, name: entry.name }));
}

function waitForExit(childProcess, timeoutMs) {
  if (childProcess.exitCode !== null)
    return Promise.resolve({ code: childProcess.exitCode, signal: childProcess.signalCode });
  return Promise.race([
    once(childProcess, "exit").then(([code, signal]) => ({ code, signal })),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Timed out waiting for process exit")), timeoutMs))
  ]);
}
