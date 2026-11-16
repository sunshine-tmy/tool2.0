import { Agent } from "undici";
import { workerAuthHeaders } from "../../security/worker-auth";

export type LocalWorkerLightHealth = {
  protocolVersion: 1;
  available: boolean;
  busy: boolean;
  modelLoaded?: boolean;
};

export class WorkerLightHealthError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "WorkerLightHealthError";
  }
}

/** Read only the existing no-load local diagnostic endpoint used after system wake. */
export async function requestWorkerLightHealth(
  baseUrl: string,
  token: string | undefined,
  timeoutMs = 2500
): Promise<LocalWorkerLightHealth> {
  const base = new URL(baseUrl);
  if (
    base.protocol !== "http:" ||
    !["127.0.0.1", "[::1]", "localhost"].includes(base.hostname) ||
    base.username ||
    base.password
  ) {
    throw new WorkerLightHealthError("WORKER_TARGET_UNSUPPORTED", "Worker 唤醒探测只允许访问已配置的本机服务");
  }
  const url = new URL("/diagnostics/light", base);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const dispatcher = new Agent({ headersTimeout: 0, bodyTimeout: 0 });
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "error",
      headers: { ...workerAuthHeaders(token), "x-toolbox-diagnostic": "1" },
      signal: controller.signal,
      dispatcher
    } as RequestInit & { dispatcher: Agent });
    const value: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new WorkerLightHealthError("WORKER_LIGHT_HEALTH_FAILED", "Worker 轻量健康探测未通过");
    if (
      !isRecord(value) ||
      value.protocolVersion !== 1 ||
      typeof value.available !== "boolean" ||
      typeof value.busy !== "boolean" ||
      (value.modelLoaded !== undefined && typeof value.modelLoaded !== "boolean")
    ) {
      throw new WorkerLightHealthError("WORKER_PROTOCOL_MISMATCH", "Worker 轻量健康协议不兼容");
    }
    return {
      protocolVersion: 1,
      available: value.available,
      busy: value.busy,
      ...(typeof value.modelLoaded === "boolean" ? { modelLoaded: value.modelLoaded } : {})
    };
  } catch (error) {
    if (error instanceof WorkerLightHealthError) throw error;
    if (isConnectionRefused(error)) {
      throw new WorkerLightHealthError("WORKER_CONNECTION_REFUSED", "Worker 进程已退出");
    }
    if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
      throw new WorkerLightHealthError("WORKER_LIGHT_HEALTH_TIMEOUT", "Worker 轻量健康探测超时");
    }
    throw new WorkerLightHealthError("WORKER_LIGHT_HEALTH_FAILED", "Worker 轻量健康探测无法完成");
  } finally {
    clearTimeout(timeout);
    await dispatcher.destroy().catch(() => undefined);
  }
}

function isConnectionRefused(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const cause = "cause" in error ? error.cause : undefined;
  if (isRecord(cause) && cause.code === "ECONNREFUSED") return true;
  return isRecord(cause) && isConnectionRefused(cause.cause);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
