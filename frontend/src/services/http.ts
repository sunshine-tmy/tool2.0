import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from "axios";
import { ApiFailureSchema, apiSuccessSchema, type ApiResponse } from "@toolbox/shared";
import type { Static, TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { apiBaseUrl } from "../config/runtime";

type BackendFailure = Extract<ApiResponse<unknown>, { success: false }>;

export class ApiRequestError extends Error {
  code: string;
  status?: number;
  details?: unknown;
  requestId?: string;
  retryable: boolean;
  readonly cancelled: boolean;
  cause?: unknown;

  constructor(
    message: string,
    options: { code: string; status?: number; details?: unknown; requestId?: string; cause?: unknown }
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.code = options.code;
    this.status = options.status;
    this.details = options.details;
    this.requestId = options.requestId;
    this.cancelled = options.code === "REQUEST_ABORTED";
    this.retryable =
      !this.cancelled &&
      (options.status === undefined || options.status === 408 || options.status === 429 || options.status >= 500);
    this.cause = options.cause;
  }
}

type ApiErrorCategory = "cancelled" | "offline" | "timeout" | "rate_limited" | "server" | "client" | "unknown";

type ApiErrorPresentation = {
  message: string;
  code: string;
  requestId?: string;
  retryable: boolean;
  cancelled: boolean;
  category: ApiErrorCategory;
  suggestion?: string;
  text: string;
};

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 120000,
  withCredentials: true
});
let adminCsrfToken: string | undefined;

export function setAdminCsrfToken(token: string | undefined) {
  adminCsrfToken = token;
}

export async function withApiError<T>(operation: () => Promise<T>, fallbackMessage = "请求失败") {
  try {
    return await operation();
  } catch (error) {
    throw normalizeApiError(error, fallbackMessage);
  }
}

export function normalizeApiError(error: unknown, fallbackMessage = "请求失败") {
  if (error instanceof ApiRequestError) {
    return error;
  }

  if (isRequestCancelled(error)) {
    return new ApiRequestError("请求已取消", { code: "REQUEST_ABORTED", cause: error });
  }

  const status = getErrorStatus(error);
  const responseData = getErrorResponseData(error);

  if (isBackendFailure(responseData)) {
    return new ApiRequestError(responseData.message || fallbackMessage, {
      code: responseData.error?.code || "REQUEST_FAILED",
      status,
      details: responseData.error?.details,
      requestId: responseData.requestId,
      cause: error
    });
  }

  return new ApiRequestError(fallbackMessage, {
    code: "REQUEST_FAILED",
    status,
    cause: error
  });
}

export function createHttpClient(instance: AxiosInstance = api) {
  return {
    async get<T extends TSchema>(url: string, schema: T, config?: AxiosRequestConfig): Promise<Static<T>> {
      const response = await instance.get<unknown, AxiosResponse<unknown>>(url, config);
      return unwrapResponse(response.data, schema, response.status);
    },

    async getText(url: string, config?: AxiosRequestConfig) {
      const response = await instance.get<string, AxiosResponse<string>>(url, { ...config, responseType: "text" });
      return response.data;
    },

    async post<T extends TSchema>(
      url: string,
      schema: T,
      data?: unknown,
      config?: AxiosRequestConfig
    ): Promise<Static<T>> {
      const response = await instance.post<unknown, AxiosResponse<unknown>>(url, data, withWriteSecurity(config));
      return unwrapResponse(response.data, schema, response.status);
    },

    async postBlob(url: string, data?: unknown, config?: AxiosRequestConfig) {
      const response = await instance.post<Blob>(url, data, withWriteSecurity({ ...config, responseType: "blob" }));
      return {
        blob: response.data,
        contentDisposition: response.headers["content-disposition"] as string | undefined
      };
    },

    async put<T extends TSchema>(
      url: string,
      schema: T,
      data?: unknown,
      config?: AxiosRequestConfig
    ): Promise<Static<T>> {
      const response = await instance.put<unknown, AxiosResponse<unknown>>(url, data, withWriteSecurity(config));
      return unwrapResponse(response.data, schema, response.status);
    },

    async patch<T extends TSchema>(
      url: string,
      schema: T,
      data?: unknown,
      config?: AxiosRequestConfig
    ): Promise<Static<T>> {
      const response = await instance.patch<unknown, AxiosResponse<unknown>>(url, data, withWriteSecurity(config));
      return unwrapResponse(response.data, schema, response.status);
    },

    async delete<T extends TSchema>(url: string, schema: T, config?: AxiosRequestConfig): Promise<Static<T>> {
      const response = await instance.delete<unknown, AxiosResponse<unknown>>(url, withWriteSecurity(config));
      return unwrapResponse(response.data, schema, response.status);
    }
  };
}

export const httpClient = createHttpClient();

function withWriteSecurity(config?: AxiosRequestConfig): AxiosRequestConfig {
  if (!adminCsrfToken) return config ?? {};
  return {
    ...config,
    headers: {
      ...config?.headers,
      "x-csrf-token": adminCsrfToken
    }
  };
}

function unwrapResponse<T extends TSchema>(data: unknown, schema: T, status?: number): Static<T> {
  if (isBackendFailure(data)) {
    throw new ApiRequestError(data.message, {
      code: data.error.code,
      status,
      details: data.error.details,
      requestId: data.requestId
    });
  }

  const successSchema = apiSuccessSchema(schema);
  if (Value.Check(successSchema, data) && isBackendSuccess(data)) {
    return data.data;
  }

  throw new ApiRequestError("服务响应未通过 API 契约校验", {
    code: "INVALID_API_RESPONSE",
    details: [...Value.Errors(successSchema, data)].slice(0, 5).map(({ path, message }) => ({ path, message }))
  });
}

/**
 * Convert an API failure into a stable, user-facing message. Callers should
 * use this at UI boundaries so error codes, request IDs, cancellation and
 * retry guidance are presented consistently across tools.
 */
export function describeApiError(error: unknown, fallbackMessage = "请求失败"): ApiErrorPresentation {
  const normalized = normalizeApiError(error, fallbackMessage);
  const category = classifyApiError(normalized);
  const suggestion = apiErrorSuggestion(category, normalized.status, normalized.retryable);
  const metadata = [
    `错误码 ${normalized.code}`,
    normalized.requestId ? `请求 ID ${normalized.requestId}` : undefined
  ].filter((value): value is string => Boolean(value));
  const text = [normalized.message || fallbackMessage, ...metadata, suggestion].filter(Boolean).join("；");

  return {
    message: normalized.message || fallbackMessage,
    code: normalized.code,
    requestId: normalized.requestId,
    retryable: normalized.retryable,
    cancelled: normalized.cancelled,
    category,
    suggestion,
    text
  };
}

export function formatApiError(error: unknown, fallbackMessage = "请求失败") {
  return describeApiError(error, fallbackMessage).text;
}

export function isApiErrorCancelled(error: unknown) {
  return describeApiError(error).cancelled;
}

function classifyApiError(error: ApiRequestError): ApiErrorCategory {
  if (error.cancelled) return "cancelled";
  if (error.status === 429) return "rate_limited";
  if (error.status === 408) return "timeout";
  if (error.status !== undefined && error.status >= 500) return "server";
  if (error.status !== undefined && error.status >= 400) return "client";
  if (isOfflineError(error.cause)) return "offline";
  return "unknown";
}

function apiErrorSuggestion(category: ApiErrorCategory, status: number | undefined, retryable: boolean) {
  switch (category) {
    case "cancelled":
      return undefined;
    case "offline":
      return "请确认本地服务已启动并检查网络后重试";
    case "timeout":
      return "服务响应超时，请稍后重试";
    case "rate_limited":
      return "请求过于频繁，请稍后重试";
    case "server":
      return "服务暂时不可用，请稍后重试";
    case "client":
      return status === 401 || status === 403 ? "请重新登录或检查管理员权限" : "请检查输入内容后再试";
    default:
      return retryable ? "请稍后重试" : undefined;
  }
}

function isBackendSuccess(value: unknown): value is Extract<ApiResponse<unknown>, { success: true }> {
  return isRecord(value) && value.success === true && "data" in value;
}

function isBackendFailure(value: unknown): value is BackendFailure {
  return Value.Check(ApiFailureSchema, value);
}

function getErrorStatus(error: unknown) {
  if (isRecord(error) && isRecord(error.response) && typeof error.response.status === "number") {
    return error.response.status;
  }
  return undefined;
}

function isRequestCancelled(error: unknown) {
  if (axios.isCancel(error)) return true;
  if (isRecord(error) && (error.code === "ERR_CANCELED" || error.name === "AbortError")) return true;
  return typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "AbortError";
}

function isOfflineError(error: unknown) {
  if (!error) return typeof navigator !== "undefined" && navigator.onLine === false;
  if (isRecord(error)) {
    const code = typeof error.code === "string" ? error.code : "";
    if (["ERR_NETWORK", "ECONNABORTED", "ETIMEDOUT", "ECONNREFUSED", "ENETUNREACH", "EHOSTUNREACH"].includes(code)) {
      return true;
    }
  }
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function getErrorResponseData(error: unknown) {
  if (isRecord(error) && isRecord(error.response)) {
    return error.response.data;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
