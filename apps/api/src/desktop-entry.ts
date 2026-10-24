/**
 * 中文模块说明：Electron utility process 入口，负责以受控的 loopback 地址启动 API。
 */
import { startBackend } from "./bootstrap";
import { getConfig } from "./config";
import { startDesktopLanGateway, type DesktopLanGateway } from "./runtime/desktop-lan-gateway";
import { createRuntimeLayout, type RuntimeLayout } from "./runtime/runtime-layout";
import { createDesktopWorkerSession, workerSessionEnvironment } from "./runtime/worker-session";
import { diagnosticFailure } from "@toolbox/shared";

type ParentMessage = { type?: unknown; id?: unknown; confirmed?: unknown };
type ParentPort = {
  postMessage(message: unknown): void;
  on(event: "message", listener: (event: { data: ParentMessage }) => void): void;
};

const parentPort = (process as NodeJS.Process & { parentPort?: ParentPort }).parentPort;
if (!parentPort) throw new Error("desktop-entry must run in an Electron utility process");

// 在 Windows Job Object 完成绑定前不初始化任何能力，确保所有后代均受退出保护。
await new Promise<void>((resolve) => {
  parentPort.on("message", (event) => {
    if (event.data?.type === "start") resolve();
  });
  parentPort.postMessage({ type: "spawned" });
});

try {
  parentPort.postMessage({ type: "stage", stage: "config" });
  const layout = readRuntimeLayout(process.env.TOOLBOX_RUNTIME_LAYOUT);
  Object.assign(process.env, workerSessionEnvironment(await createDesktopWorkerSession()));
  // 桌面内部服务只监听 loopback；局域网由受限网关提供，不继承开发部署的管理员会话模式。
  const config = getConfig({
    layout,
    dotenvPath: false,
    desktopManagedCapabilities: true,
    environment: { ...process.env, DEPLOYMENT_MODE: "local" }
  });
  const backend = await startBackend({
    config,
    host: "127.0.0.1",
    port: 0,
    onStage: (stage) => parentPort.postMessage({ type: "stage", stage }),
    onShutdownStage: (stage) => parentPort.postMessage({ type: "shutdown-stage", stage })
  });
  let lanGateway: DesktopLanGateway;
  try {
    lanGateway = await startDesktopLanGateway(backend.origin, config.lanTransferWebPort);
    config.lanTransferWebPort = lanGateway.port;
  } catch (error) {
    // LAN sharing is optional; keep the desktop app usable and report no share URLs if the gateway cannot start.
    config.lanTransferWebPort = 0;
    console.warn("Desktop LAN transfer gateway could not start", error);
    lanGateway = { port: 0, close: async () => undefined };
  }
  parentPort.postMessage({ type: "ready", origin: backend.origin });

  let closing: Promise<void> | undefined;
  const close = () =>
    (closing ??= (async () => {
      parentPort.postMessage({ type: "shutdown-stage", stage: "tasks" });
      // 两者并行关闭，网关的连接不能阻止后端开始收尾。
      await Promise.all([lanGateway.close(), backend.close()]);
      parentPort.postMessage({ type: "stopped" });
    })());
  const shutdown = () =>
    void close().then(
      () => process.exit(0),
      () => {
        parentPort.postMessage({ type: "shutdown-error" });
        process.exit(1);
      }
    );

  parentPort.on("message", (event) => {
    if (event.data?.type === "shutdown-inspect" && typeof event.data.id === "number") {
      parentPort.postMessage({ type: "shutdown-inspection", id: event.data.id, state: backend.shutdown.inspect() });
      return;
    }
    if (event.data?.type === "shutdown-prepare" && typeof event.data.id === "number") {
      parentPort.postMessage({
        type: "shutdown-inspection",
        id: event.data.id,
        state: backend.shutdown.prepare(event.data.confirmed === true)
      });
      return;
    }
    if (event.data?.type !== "shutdown") return;
    shutdown();
  });
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, shutdown);
} catch (error) {
  const failure = diagnosticFailure(error);
  parentPort.postMessage({ type: "startup-error", ...failure });
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
