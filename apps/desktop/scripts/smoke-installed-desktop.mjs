import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, lstat, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const thisFile = fileURLToPath(import.meta.url);

export function parseSmokeArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) throw new Error(`Unexpected argument: ${argument}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value`);
    if (values.has(argument)) throw new Error(`${argument} may only be provided once`);
    values.set(argument, value);
    index += 1;
  }
  const executable = values.get("--exe");
  const report = values.get("--report");
  const startupMigration = values.get("--startup-migration");
  const componentId = values.get("--component-id");
  const timeoutSeconds = values.has("--timeout-seconds") ? Number(values.get("--timeout-seconds")) : 90;
  const componentTimeoutSeconds = values.has("--component-timeout-seconds")
    ? Number(values.get("--component-timeout-seconds"))
    : 900;
  if (!executable || !report) throw new Error("Usage: --exe <installed-app.exe> --report <report.json>");
  if (startupMigration && startupMigration !== "migrate") {
    throw new Error("--startup-migration only supports the explicit value 'migrate'");
  }
  if (componentId && componentId !== "edge-tts") {
    throw new Error("--component-id only supports the fixed acceptance capability 'edge-tts'");
  }
  const expectedOptions =
    2 +
    Number(values.has("--timeout-seconds")) +
    Number(values.has("--startup-migration")) +
    Number(values.has("--component-id")) +
    Number(values.has("--component-timeout-seconds"));
  if (values.size !== expectedOptions) throw new Error("Unexpected option");
  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 15 || timeoutSeconds > 180) {
    throw new Error("--timeout-seconds must be an integer from 15 to 180");
  }
  if (!Number.isInteger(componentTimeoutSeconds) || componentTimeoutSeconds < 60 || componentTimeoutSeconds > 1_800) {
    throw new Error("--component-timeout-seconds must be an integer from 60 to 1800");
  }
  if (values.has("--component-timeout-seconds") && !componentId) {
    throw new Error("--component-timeout-seconds requires --component-id");
  }
  return {
    executable: path.resolve(executable),
    report: path.resolve(report),
    timeoutSeconds,
    componentTimeoutSeconds,
    ...(componentId ? { componentId } : {}),
    ...(startupMigration ? { startupMigration } : {})
  };
}

export function loopbackOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !url.port) {
    throw new Error(`Desktop window did not load a loopback backend origin: ${value}`);
  }
  return url.origin;
}

async function reserveLoopbackPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string", "Unable to reserve a loopback debug port");
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return address.port;
}

async function debugTargets(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(2_000) });
  if (!response.ok) throw new Error(`DevTools endpoint returned HTTP ${response.status}`);
  const targets = await response.json();
  if (!Array.isArray(targets)) throw new Error("DevTools endpoint returned an invalid target list");
  return targets;
}

async function evaluateInTarget(target, expression) {
  if (typeof target.webSocketDebuggerUrl !== "string")
    throw new Error("Desktop migration window has no DevTools endpoint");
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timed out connecting to the desktop migration window")), 5_000);
      socket.addEventListener(
        "open",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true }
      );
      socket.addEventListener(
        "error",
        () => {
          clearTimeout(timer);
          reject(new Error("Could not connect to the desktop migration window"));
        },
        { once: true }
      );
    });

    const response = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timed out evaluating the migration choice")), 5_000);
      socket.addEventListener("message", (event) => {
        const message = JSON.parse(String(event.data));
        if (message.id !== 1) return;
        clearTimeout(timer);
        if (message.error) reject(new Error(message.error.message || "DevTools evaluation failed"));
        else if (message.result?.exceptionDetails) {
          reject(new Error(message.result.exceptionDetails.exception?.description || "Desktop page evaluation failed"));
        } else resolve(message.result?.result?.value);
      });
    });
    socket.send(
      JSON.stringify({
        id: 1,
        method: "Runtime.evaluate",
        params: { expression, awaitPromise: true, returnByValue: true }
      })
    );
    return await response;
  } finally {
    socket.close();
  }
}

async function persistAndVerifyDesktopSettings(port, origin, executable) {
  const targets = await debugTargets(port);
  const page = targets.find(
    (target) => target?.type === "page" && typeof target.url === "string" && target.url.startsWith(origin)
  );
  if (!page) throw new Error("Desktop application window is unavailable for settings-path verification");
  const expectedInstallRoot = path.dirname(path.resolve(executable));
  const expectedDataRoot = path.join(expectedInstallRoot, "data");
  const expression = `(async () => {
    const api = window.toolboxDesktop;
    if (!api || typeof api.getSettings !== "function" || typeof api.updateSettings !== "function") {
      throw new Error("Trusted desktop settings API is unavailable");
    }
    const current = await api.getSettings();
    if (current.installDirectory !== ${JSON.stringify(expectedInstallRoot)} || current.dataDirectory !== ${JSON.stringify(expectedDataRoot)}) {
      throw new Error("Desktop settings reported paths outside the selected install root");
    }
    const updated = await api.updateSettings({ automaticUpdateChecks: false });
    return JSON.stringify({ installDirectory: updated.installDirectory, dataDirectory: updated.dataDirectory });
  })()`;
  const serialized = await evaluateInTarget(page, expression);
  if (typeof serialized !== "string") throw new Error("Desktop settings IPC returned no path report");
  const settings = JSON.parse(serialized);
  if (settings.installDirectory !== expectedInstallRoot || settings.dataDirectory !== expectedDataRoot) {
    throw new Error("Persisted desktop settings paths do not match the chosen install root");
  }
  const settingsPath = path.join(expectedDataRoot, "config", "desktop-settings.json");
  const stored = JSON.parse(await readFile(settingsPath, "utf8"));
  if (stored.automaticUpdateChecks !== false) {
    throw new Error("Desktop preference was not persisted under the selected data root");
  }
  return "config/desktop-settings.json";
}

async function chooseStartupMigration(port, timeoutSeconds) {
  const deadline = Date.now() + timeoutSeconds * 1_000;
  let lastError = "first-run migration window has not appeared";
  while (Date.now() < deadline) {
    try {
      const targets = await debugTargets(port);
      const target = targets.find((item) => item?.type === "page" && item.url?.startsWith("data:text/html"));
      if (target) {
        const clicked = await evaluateInTarget(
          target,
          `(() => {
          if (document.readyState !== "complete") return false;
          const button = document.querySelector("#migrate");
          if (!button || button.disabled) return false;
          button.click();
          return true;
        })()`
        );
        if (clicked !== true) throw new Error("Migration window did not expose an enabled migrate button");
        return { decision: "migrate", windowUrl: "data:text/html" };
      }
      const businessWindowAppeared = targets.some(
        (item) => item?.type === "page" && typeof item.url === "string" && item.url.startsWith("http://127.0.0.1:")
      );
      if (businessWindowAppeared) {
        throw new Error("Application reached its business window without showing the expected migration choice");
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (lastError.includes("without showing the expected migration choice")) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`First-run migration choice did not complete within ${timeoutSeconds}s: ${lastError}`);
}

async function waitForHealthyDesktop(port, timeoutSeconds) {
  const deadline = Date.now() + timeoutSeconds * 1_000;
  let lastError = "desktop window has not appeared";
  while (Date.now() < deadline) {
    try {
      const targets = await debugTargets(port);
      const page = targets.find((target) => target?.type === "page" && typeof target.url === "string");
      if (!page) throw new Error("Desktop page target has not appeared");
      const origin = loopbackOrigin(page.url);
      const ready = await fetch(`${origin}/health/ready`, { signal: AbortSignal.timeout(5_000) });
      if (!ready.ok) throw new Error(`/health/ready returned HTTP ${ready.status}`);
      const apiHealth = await fetch(`${origin}/api/v1/health`, { signal: AbortSignal.timeout(5_000) });
      if (!apiHealth.ok) throw new Error(`/api/v1/health returned HTTP ${apiHealth.status}`);
      return { origin, readyStatus: ready.status, apiHealthStatus: apiHealth.status };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`Installed desktop application did not become healthy within ${timeoutSeconds}s: ${lastError}`);
}

async function callDesktopApi(origin, endpoint, options = {}) {
  const response = await fetch(`${origin}${endpoint}`, {
    method: options.method ?? "GET",
    ...(options.body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(options.body) } : {}),
    signal: AbortSignal.timeout(10_000)
  });
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Desktop API returned a non-JSON response for ${endpoint}`);
  }
  if (!response.ok || payload?.success !== true || !payload.data) {
    throw new Error(
      `Desktop API ${endpoint} failed: ${payload?.error?.code ?? response.status} ${payload?.error?.message ?? ""}`
    );
  }
  return payload.data;
}

async function waitForComponentJob(origin, jobId, timeoutSeconds) {
  const deadline = Date.now() + timeoutSeconds * 1_000;
  while (Date.now() < deadline) {
    const job = await callDesktopApi(origin, `/api/v1/component-jobs/${encodeURIComponent(jobId)}`);
    if (job.state === "completed") return job;
    if (job.state === "failed" || job.state === "cancelled") {
      throw new Error(
        `Component ${job.componentId} ${job.operation} failed: ${job.errorCode ?? job.state} ${job.errorMessage ?? ""}`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Component job ${jobId} did not complete within ${timeoutSeconds}s`);
}

async function runComponentOperation(origin, componentId, operation, timeoutSeconds) {
  const endpoint = `/api/v1/components/${encodeURIComponent(componentId)}`;
  const job = await callDesktopApi(origin, operation === "uninstall" ? endpoint : `${endpoint}/${operation}`, {
    method: operation === "uninstall" ? "DELETE" : "POST"
  });
  if (typeof job.id !== "string") throw new Error(`Component ${operation} response did not include a job id`);
  return waitForComponentJob(origin, job.id, timeoutSeconds);
}

async function runEdgeTtsComponentLifecycle(origin, options) {
  const componentRoot = path.join(path.dirname(options.executable), "data", "components", "packages");
  const sentinelPath = path.join(path.dirname(options.executable), "data", "acceptance-user-data-sentinel.txt");
  const sentinelBefore = await readFile(sentinelPath);
  const before = await callDesktopApi(origin, "/api/v1/components");
  const pythonBefore = before.find((item) => item?.id === "python-311");
  const edgeTtsBefore = before.find((item) => item?.id === options.componentId);
  if (!pythonBefore || !edgeTtsBefore)
    throw new Error("Signed catalog is missing the fixed Python or Edge-TTS acceptance capability");
  if (pythonBefore.installed || edgeTtsBefore.installed) {
    throw new Error("Component acceptance requires a clean install with Python 3.11 and Edge-TTS not installed");
  }
  if (!edgeTtsBefore.dependencyIds.includes("python-311")) {
    throw new Error("Edge-TTS acceptance capability does not declare its shared Python dependency");
  }

  const pythonInstall = await runComponentOperation(origin, "python-311", "install", options.componentTimeoutSeconds);
  const edgeTtsInstall = await runComponentOperation(
    origin,
    options.componentId,
    "install",
    options.componentTimeoutSeconds
  );
  const installed = await callDesktopApi(origin, "/api/v1/components");
  for (const componentId of ["python-311", options.componentId]) {
    const status = installed.find((item) => item?.id === componentId);
    if (!status?.installed || status.state !== "ready" || status.health !== "healthy") {
      throw new Error(`Component ${componentId} did not reach the healthy ready state`);
    }
    await access(path.join(componentRoot, componentId, "current.json"));
  }

  const edgeTtsUninstall = await runComponentOperation(
    origin,
    options.componentId,
    "uninstall",
    options.componentTimeoutSeconds
  );
  const pythonUninstall = await runComponentOperation(
    origin,
    "python-311",
    "uninstall",
    options.componentTimeoutSeconds
  );
  const removed = await callDesktopApi(origin, "/api/v1/components");
  for (const componentId of ["python-311", options.componentId]) {
    const status = removed.find((item) => item?.id === componentId);
    if (!status || status.installed || status.state !== "not-installed") {
      throw new Error(`Component ${componentId} remained installed after its uninstall job`);
    }
    try {
      await access(path.join(componentRoot, componentId));
      throw new Error(`Component ${componentId} left its package directory after uninstall`);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  const sentinelAfter = await readFile(sentinelPath);
  assert.deepEqual(sentinelAfter, sentinelBefore, "component uninstall must preserve user data");
  return {
    componentId: options.componentId,
    dependencyIds: edgeTtsBefore.dependencyIds,
    installedHealthy: true,
    uninstalled: true,
    userDataPreserved: true,
    jobs: [pythonInstall.id, edgeTtsInstall.id, edgeTtsUninstall.id, pythonUninstall.id]
  };
}

export const MANAGED_PERSISTENT_DIRECTORIES = [
  ".runtime",
  "config",
  "models",
  "profile",
  "temp",
  "logs",
  "logs/crash-dumps",
  "data",
  "data/migration-backups",
  "data/quarantine",
  "data/uploads",
  "data/outputs",
  "data/temp",
  "data/lan-transfer/files",
  "data/video-text/uploads",
  "data/video-text/audio",
  "data/video-text/results",
  "data/image-ai/inputs",
  "data/image-ai/outputs",
  "data/image-ai/tasks",
  "data/edge-tts/tasks",
  "data/chatterbox/tasks",
  "data/xhs-archive/items",
  "data/xhs-archive/staging",
  "components",
  "components/packages"
];

export async function verifyPersistentWriteLocations(executable) {
  const applicationDataRoot = path.join(path.dirname(path.resolve(executable)), "data");
  const resolvedDataRoot = await realpath(applicationDataRoot);
  for (const relativeDirectory of MANAGED_PERSISTENT_DIRECTORIES) {
    const directory = path.join(applicationDataRoot, relativeDirectory);
    const info = await lstat(directory).catch(() => undefined);
    if (!info?.isDirectory() || info.isSymbolicLink()) {
      throw new Error(
        `Expected persistent application data directory is missing from the selected install root: ${relativeDirectory}`
      );
    }
    const resolvedDirectory = await realpath(directory);
    const relative = path.relative(resolvedDataRoot, resolvedDirectory);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`Persistent application data directory escaped the selected install root: ${relativeDirectory}`);
    }
  }
  const databasePath = path.join(applicationDataRoot, "data", "toolbox.db");
  const databaseInfo = await lstat(databasePath);
  if (!databaseInfo.isFile() || databaseInfo.isSymbolicLink()) {
    throw new Error("SQLite database is not a regular file under the selected install root");
  }
  const resolvedDatabase = await realpath(databasePath);
  const relativeDatabase = path.relative(resolvedDataRoot, resolvedDatabase);
  if (relativeDatabase.startsWith("..") || path.isAbsolute(relativeDatabase)) {
    throw new Error("SQLite database escaped the selected install root");
  }
  const settingsPath = path.join(applicationDataRoot, "config", "desktop-settings.json");
  const settingsInfo = await lstat(settingsPath);
  if (!settingsInfo.isFile() || settingsInfo.isSymbolicLink()) {
    throw new Error("Desktop preferences are not a regular file under the selected install root");
  }
  const resolvedSettings = await realpath(settingsPath);
  const relativeSettings = path.relative(resolvedDataRoot, resolvedSettings);
  if (relativeSettings.startsWith("..") || path.isAbsolute(relativeSettings)) {
    throw new Error("Desktop preferences escaped the selected install root");
  }
  await access(databasePath);
  await access(settingsPath);
  return [...MANAGED_PERSISTENT_DIRECTORIES, "data/toolbox.db", "config/desktop-settings.json"];
}

async function stopProcessTree(child) {
  if (child.exitCode !== null || child.pid === undefined) return;
  if (process.platform !== "win32") {
    child.kill();
    return;
  }
  await new Promise((resolve) => {
    const taskkill = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      windowsHide: true,
      stdio: "ignore"
    });
    taskkill.once("error", resolve);
    taskkill.once("exit", resolve);
  });
}

export async function smokeInstalledDesktop(options) {
  await access(options.executable);
  const debugPort = await reserveLoopbackPort();
  const startedAt = new Date().toISOString();
  const child = spawn(options.executable, [`--remote-debugging-port=${debugPort}`], {
    detached: false,
    stdio: "ignore",
    windowsHide: true
  });
  try {
    const startupMigration = options.startupMigration
      ? await chooseStartupMigration(debugPort, options.timeoutSeconds)
      : undefined;
    const health = await waitForHealthyDesktop(debugPort, options.timeoutSeconds);
    const settingsFile = await persistAndVerifyDesktopSettings(debugPort, health.origin, options.executable);
    await callDesktopApi(health.origin, "/api/v1/components");
    const componentLifecycle = options.componentId
      ? await runEdgeTtsComponentLifecycle(health.origin, options)
      : undefined;
    const persistentWriteLocations = await verifyPersistentWriteLocations(options.executable);
    const report = {
      executable: options.executable,
      startedAt,
      completedAt: new Date().toISOString(),
      debugPort,
      ...(startupMigration ? { startupMigration } : {}),
      ...(componentLifecycle ? { componentLifecycle } : {}),
      settingsFile,
      persistentWriteLocations,
      ...health
    };
    await mkdir(path.dirname(options.report), { recursive: true });
    await writeFile(options.report, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(`Installed desktop smoke passed: ${health.origin}`);
    return report;
  } finally {
    await stopProcessTree(child);
  }
}

async function main() {
  const options = parseSmokeArguments(process.argv.slice(2));
  await smokeInstalledDesktop(options);
}

if (process.argv[1] && path.resolve(process.argv[1]) === thisFile) {
  await main();
}
