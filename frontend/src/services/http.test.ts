/**
 * 中文模块说明：测试 frontend/src/services/http.test.ts 中的稳定行为、边界条件和回归场景
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { Type } from "@sinclair/typebox";
import {
  ApiRequestError,
  createHttpClient,
  describeApiError,
  formatApiError,
  normalizeApiError,
  setAdminCsrfToken,
  withApiError
} from "./http";

afterEach(() => setAdminCsrfToken(undefined));

describe("api error wrapper", () => {
  it("returns successful results unchanged", async () => {
    await expect(withApiError(async () => ({ ok: true }), "操作失败")).resolves.toEqual({ ok: true });
  });

  it("normalizes backend failure envelopes", async () => {
    await expect(
      withApiError(async () => {
        throw {
          response: {
            status: 413,
            data: {
              success: false,
              message: "文件超过大小限制",
              error: {
                code: "FILE_TOO_LARGE",
                message: "文件超过大小限制",
                details: { max: 4 }
              },
              requestId: "req-file-too-large"
            }
          }
        };
      }, "操作失败")
    ).rejects.toMatchObject({
      name: "ApiRequestError",
      message: "文件超过大小限制",
      code: "FILE_TOO_LARGE",
      status: 413,
      details: { max: 4 }
    });
  });

  it("uses fallback messages for unknown errors", () => {
    const error = normalizeApiError(new Error("boom"), "请求失败");

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error.message).toBe("请求失败");
    expect(error.code).toBe("REQUEST_FAILED");
  });

  it("adds the administrator CSRF token only to state-changing requests", async () => {
    const instance = {
      get: vi.fn().mockResolvedValue({ data: { success: true, message: "ok", data: null, requestId: "req-get" } }),
      post: vi.fn().mockResolvedValue({ data: { success: true, message: "ok", data: null, requestId: "req-post" } })
    };
    const client = createHttpClient(instance as never);
    setAdminCsrfToken("csrf-token");
    const emptySchema = Type.Null();

    await client.get("/health", emptySchema);
    await client.post("/maintenance/cleanup", emptySchema, { ids: [] });

    expect(instance.get).toHaveBeenCalledWith("/health", undefined);
    expect(instance.post).toHaveBeenCalledWith(
      "/maintenance/cleanup",
      { ids: [] },
      expect.objectContaining({ headers: expect.objectContaining({ "x-csrf-token": "csrf-token" }) })
    );
  });

  it("rejects a successful envelope whose data violates the supplied schema", async () => {
    const instance = {
      get: vi.fn().mockResolvedValue({
        data: { success: true, message: "ok", data: { status: "unexpected" }, requestId: "req-invalid" }
      })
    };
    const client = createHttpClient(instance as never);

    await expect(client.get("/health", Type.Object({ status: Type.Literal("ok") }))).rejects.toMatchObject({
      name: "ApiRequestError",
      code: "INVALID_API_RESPONSE"
    });
  });

  it("accepts a successful envelope without a compatibility message", async () => {
    const instance = {
      get: vi.fn().mockResolvedValue({
        data: { success: true, data: { status: "ok" }, requestId: "req-no-message" }
      })
    };
    const client = createHttpClient(instance as never);

    await expect(client.get("/health", Type.Object({ status: Type.Literal("ok") }))).resolves.toEqual({
      status: "ok"
    });
  });

  it("passes AbortSignal through every transport and treats cancellation as non-business failure", async () => {
    const controller = new AbortController();
    const instance = {
      get: vi.fn().mockRejectedValue({ code: "ERR_CANCELED", name: "CanceledError" })
    };
    const client = createHttpClient(instance as never);

    await expect(
      withApiError(() => client.get("/health", Type.Null(), { signal: controller.signal }))
    ).rejects.toMatchObject({
      code: "REQUEST_ABORTED",
      cancelled: true,
      retryable: false
    });
    expect(instance.get).toHaveBeenCalledWith("/health", { signal: controller.signal });
  });

  it("presents rate limits with a stable code, request id and retry guidance", () => {
    const error = new ApiRequestError("请求过于频繁", {
      code: "RATE_LIMITED",
      status: 429,
      requestId: "req-rate-limit"
    });
    const presentation = describeApiError(error);

    expect(presentation).toMatchObject({
      category: "rate_limited",
      code: "RATE_LIMITED",
      requestId: "req-rate-limit",
      retryable: true,
      suggestion: "请求过于频繁，请稍后重试"
    });
    expect(formatApiError(error)).toContain("请求 ID req-rate-limit");
  });

  it("distinguishes offline transport failures from business errors", () => {
    const presentation = describeApiError({ code: "ERR_NETWORK" }, "服务不可用");

    expect(presentation).toMatchObject({
      category: "offline",
      code: "REQUEST_FAILED",
      message: "服务不可用",
      suggestion: "请确认本地服务已启动并检查网络后重试"
    });
  });

  it("does not turn cancellation into a retry prompt", () => {
    const presentation = describeApiError(new ApiRequestError("请求已取消", { code: "REQUEST_ABORTED" }));

    expect(presentation).toMatchObject({ category: "cancelled", cancelled: true, retryable: false });
    expect(presentation.suggestion).toBeUndefined();
    expect(presentation.text).toBe("请求已取消；错误码 REQUEST_ABORTED");
  });
});
