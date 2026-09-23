import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdir, writeFile } from "node:fs/promises";
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
  const timeoutSeconds = values.has("--timeout-seconds") ? Number(values.get("--timeout-seconds")) : 90;
  if (!executable || !report) throw new Error("Usage: --exe <installed-app.exe> --report <report.json>");
  if (values.size > (values.has("--timeout-seconds") ? 3 : 2)) throw new Error("Unexpected option");
  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 15 || timeoutSeconds > 180) {
    throw new Error("--timeout-seconds must be an integer from 15 to 180");
  }
  return { executable: path.resolve(executable), report: path.resolve(report), timeoutSeconds };
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
  const child = spawn(options.executable, ["--squirrel-firstrun", `--remote-debugging-port=${debugPort}`], {
    detached: false,
    stdio: "ignore",
    windowsHide: true
  });
  try {
    const health = await waitForHealthyDesktop(debugPort, options.timeoutSeconds);
    const report = {
      executable: options.executable,
      startedAt,
      completedAt: new Date().toISOString(),
      debugPort,
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
