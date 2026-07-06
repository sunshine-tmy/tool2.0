import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from "axios";
import type { ApiResponse } from "@toolbox/shared";

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

const defaultApiBase =
  typeof window === "undefined" ? "/api" : `${window.location.protocol}//${window.location.hostname}:3100/api`;

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE ?? defaultApiBase,
  timeout: 120000
});

export function ApiRequest(fallbackMessage = "请求失败"): MethodDecorator {
  return function (_target: object, _propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const original = descriptor.value as ((...args: any[]) => Promise<unknown>) | undefined;

    if (!original) {
      return descriptor;
    }

    descriptor.value = async function (...args: unknown[]) {
      try {
        return await original.apply(this, args);
      } catch (error) {
        throw normalizeApiError(error, fallbackMessage);
      }
    };

    return descriptor;
  };
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

export function createHttpClient(instance: AxiosInstance = api) {
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

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null;
}
