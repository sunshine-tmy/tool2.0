/**
 * 中文模块说明：Electron utility process 入口，负责以受控的 loopback 地址启动 API。
 */
import { startBackend } from "./bootstrap";
import { getConfig } from "./config";
import { createRuntimeLayout, type RuntimeLayout } from "./runtime/runtime-layout";
import { createDesktopWorkerSession, workerSessionEnvironment } from "./runtime/worker-session";

type ParentMessage = { type?: unknown };
type ParentPort = {
  postMessage(message: unknown): void;
  on(event: "message", listener: (event: { data: ParentMessage }) => void): void;
};

const parentPort = (process as NodeJS.Process & { parentPort?: ParentPort }).parentPort;
if (!parentPort) throw new Error("desktop-entry must run in an Electron utility process");

const layout = readRuntimeLayout(process.env.TOOLBOX_RUNTIME_LAYOUT);
Object.assign(process.env, workerSessionEnvironment(await createDesktopWorkerSession()));
const config = getConfig({ layout, dotenvPath: false });

try {
  const backend = await startBackend({ config, host: "127.0.0.1", port: 0 });
  parentPort.postMessage({ type: "ready", origin: backend.origin });

  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    await backend.close();
    parentPort.postMessage({ type: "stopped" });
  };

  parentPort.on("message", (event) => {
    if (event.data?.type !== "shutdown") return;
    void close().finally(() => process.exit(0));
  });
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => void close());
} catch (error) {
  const message = error instanceof Error ? error.message : "Backend startup failed";
  parentPort.postMessage({ type: "startup-error", message });
  process.exitCode = 1;
}

function readRuntimeLayout(raw: string | undefined): RuntimeLayout {
  if (!raw) throw new Error("TOOLBOX_RUNTIME_LAYOUT is required");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("TOOLBOX_RUNTIME_LAYOUT is invalid JSON");
  }
  if (!isRecord(parsed)) throw new Error("TOOLBOX_RUNTIME_LAYOUT must be an object");
  const fields = [
    "appRoot",
    "configRoot",
    "storageRoot",
    "runtimeRoot",
    "modelsRoot",
    "scriptsRoot",
    "frontendDistRoot"
  ] as const;
  if (fields.some((field) => typeof parsed[field] !== "string" || !parsed[field].trim())) {
    throw new Error("TOOLBOX_RUNTIME_LAYOUT is incomplete");
  }
  return createRuntimeLayout({
    appRoot: parsed.appRoot,
    configRoot: parsed.configRoot,
    storageRoot: parsed.storageRoot,
    runtimeRoot: parsed.runtimeRoot,
    modelsRoot: parsed.modelsRoot,
    scriptsRoot: parsed.scriptsRoot,
    frontendDistRoot: parsed.frontendDistRoot
  });
}

function isRecord(value: unknown): value is Record<string, string> {
  return typeof value === "object" && value !== null;
}
