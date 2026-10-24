/** Node Worker HTTP 传输；领域错误与协议兼容策略由调用方保留。 */
import { workerAuthHeaders } from "../../security/worker-auth";

type WorkerFailure = { code?: string; message?: string };
type WorkerErrors = {
  owns: (error: unknown) => boolean;
  http: (failure: WorkerFailure, response: Response) => Error;
  invalid: () => Error;
  aborted: (interrupted: boolean) => Error;
  unavailable: () => Error;
};

export async function requestWorkerHttp<T>(options: {
  pathname: string;
  init: RequestInit;
  timeoutMs: number;
  validate: (value: unknown) => value is T;
  getBaseUrl: () => string;
  getToken: () => string | undefined;
  errors: WorkerErrors;
}): Promise<T> {
  const { pathname, init, timeoutMs, validate, errors } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const externalSignal = init.signal;
  const abortFromExternal = () => controller.abort();
  externalSignal?.addEventListener("abort", abortFromExternal, { once: true });

  try {
    const headers = new Headers(init.headers);
    for (const [name, value] of Object.entries(workerAuthHeaders(options.getToken()))) headers.set(name, value);
    const response = await fetch(new URL(pathname, `${options.getBaseUrl()}/`), {
      ...init,
      headers,
      signal: controller.signal
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) throw errors.http(workerFailure(payload), response);
    if (isRecord(payload) && payload.success === true && validate(payload.data)) return payload.data;
    throw errors.invalid();
  } catch (error) {
    if (errors.owns(error)) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw errors.aborted(externalSignal?.aborted === true);
    }
    throw errors.unavailable();
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", abortFromExternal);
  }
}

function workerFailure(payload: unknown): WorkerFailure {
  if (!isRecord(payload)) return {};
  if (isRecord(payload.error)) {
    return {
      code: typeof payload.error.code === "string" ? payload.error.code : undefined,
      message: typeof payload.error.message === "string" ? payload.error.message : undefined
    };
  }
  return { message: typeof payload.detail === "string" ? payload.detail : undefined };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
