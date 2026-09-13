export type ApiSuccess<T> = {
  success: true;
  message: string;
  data: T;
  requestId?: string;
};

export type ApiFailure = {
  success: false;
  message: string;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId?: string;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export function ok<T>(data: T, message = "ok"): ApiSuccess<T> {
  return {
    success: true,
    message,
    data
  };
}

export function fail(code: string, message: string, details?: unknown): ApiFailure {
  return {
    success: false,
    message,
    error: {
      code,
      message,
      details
    }
  };
}
