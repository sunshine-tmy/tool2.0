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
    this.retryable =
      options.status === undefined || options.status === 408 || options.status === 429 || options.status >= 500;
    this.cause = options.cause;
  }
}

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
      return unwrapResponse(response.data, schema);
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
      return unwrapResponse(response.data, schema);
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
      return unwrapResponse(response.data, schema);
    },

    async patch<T extends TSchema>(
      url: string,
      schema: T,
      data?: unknown,
      config?: AxiosRequestConfig
    ): Promise<Static<T>> {
      const response = await instance.patch<unknown, AxiosResponse<unknown>>(url, data, withWriteSecurity(config));
      return unwrapResponse(response.data, schema);
    },

    async delete<T extends TSchema>(url: string, schema: T, config?: AxiosRequestConfig): Promise<Static<T>> {
      const response = await instance.delete<unknown, AxiosResponse<unknown>>(url, withWriteSecurity(config));
      return unwrapResponse(response.data, schema);
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

function unwrapResponse<T extends TSchema>(data: unknown, schema: T): Static<T> {
  if (isBackendFailure(data)) {
    throw new ApiRequestError(data.message, {
      code: data.error.code,
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

function getErrorResponseData(error: unknown) {
  if (isRecord(error) && isRecord(error.response)) {
    return error.response.data;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
