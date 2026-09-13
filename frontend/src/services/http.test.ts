import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError, createHttpClient, normalizeApiError, setAdminCsrfToken, withApiError } from "./http";

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
                details: { max: 4 }
              }
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
      get: vi.fn().mockResolvedValue({ data: { success: true, message: "ok", data: null } }),
      post: vi.fn().mockResolvedValue({ data: { success: true, message: "ok", data: null } })
    };
    const client = createHttpClient(instance as never);
    setAdminCsrfToken("csrf-token");

    await client.get("/health");
    await client.post("/maintenance/cleanup", { ids: [] });

    expect(instance.get).toHaveBeenCalledWith("/health", undefined);
    expect(instance.post).toHaveBeenCalledWith(
      "/maintenance/cleanup",
      { ids: [] },
      expect.objectContaining({ headers: expect.objectContaining({ "x-csrf-token": "csrf-token" }) })
    );
  });
});
