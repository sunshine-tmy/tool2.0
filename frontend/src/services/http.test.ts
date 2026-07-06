import { describe, expect, it } from "vitest";
import { ApiRequest, ApiRequestError, normalizeApiError } from "./http";

describe("api request decorator", () => {
  it("returns successful method results unchanged", async () => {
    class DemoApi {
      @ApiRequest("操作失败")
      async run() {
        return { ok: true };
      }
    }

    await expect(new DemoApi().run()).resolves.toEqual({ ok: true });
  });

  it("normalizes backend failure envelopes", async () => {
    class DemoApi {
      @ApiRequest("操作失败")
      async run() {
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
      }
    }

    await expect(new DemoApi().run()).rejects.toMatchObject({
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
});
