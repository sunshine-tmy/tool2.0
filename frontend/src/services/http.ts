import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from "axios";
import type { ApiResponse } from "@toolbox/shared";
import { apiBaseUrl } from "../config/runtime";

type BackendFailure = Extract<ApiResponse<unknown>, { success: false }>;

export class ApiRequestError extends Error {
  code: string;
  status?: number;
  details?: unknown;
  cause?: unknown;

  constructor(message: string, options: { code: string; status?: number; details?: unknown; cause?: unknown }) {
    super(message);
    this.name = "ApiRequestError";
    this.code = options.code;
    this.status = options.status;
    this.details = options.details;
    this.cause = options.cause;
  }
}

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 120000
});

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
      cause: error
    });
  }

  return new ApiRequestError(fallbackMessage, {
    code: "REQUEST_FAILED",
    status,
    cause: error
  });
}

function createHttpClient(instance: AxiosInstance = api) {
  return {
    async get<T>(url: string, config?: AxiosRequestConfig) {
      const response = await instance.get<unknown, AxiosResponse<unknown>>(url, config);
      return unwrapResponse<T>(response.data);
    },

    async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
      const response = await instance.post<unknown, AxiosResponse<unknown>>(url, data, config);
      return unwrapResponse<T>(response.data);
    },

    async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
      const response = await instance.put<unknown, AxiosResponse<unknown>>(url, data, config);
      return unwrapResponse<T>(response.data);
    },

    async delete<T>(url: string, config?: AxiosRequestConfig) {
      const response = await instance.delete<unknown, AxiosResponse<unknown>>(url, config);
      return unwrapResponse<T>(response.data);
    }
  };
}

export const httpClient = createHttpClient();

function unwrapResponse<T>(data: unknown) {
  if (isBackendFailure(data)) {
    throw new ApiRequestError(data.message, {
      code: data.error.code,
      details: data.error.details
    });
  }

  if (isBackendSuccess<T>(data)) {
    return data.data;
  }

  return data as T;
}

function isBackendSuccess<T>(value: unknown): value is Extract<ApiResponse<T>, { success: true }> {
  return isRecord(value) && value.success === true && "data" in value;
}

function isBackendFailure(value: unknown): value is BackendFailure {
  return (
    isRecord(value) &&
    value.success === false &&
    typeof value.message === "string" &&
    isRecord(value.error) &&
    typeof value.error.code === "string"
  );
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
