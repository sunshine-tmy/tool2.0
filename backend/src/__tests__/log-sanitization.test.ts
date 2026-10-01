/** 中文模块说明：验证请求路径及异常日志不会暴露查询凭据、正文、绝对路径或堆栈。 */
import { describe, expect, it } from "vitest";
import { LOG_REDACTION_PATHS, safeErrorLogFields, safeRequestLogPath } from "../security/log-sanitization";

describe("structured log sanitization", () => {
  it("removes query strings and fragments from logged paths", () => {
    expect(safeRequestLogPath("/api/v1/tools/media-archive/items?token=secret#preview")).toBe(
      "/api/v1/tools/media-archive/items"
    );
    expect(safeRequestLogPath("/api/v1/health")).toBe("/api/v1/health");
    expect(safeRequestLogPath("?token=secret")).toBe("/");
    expect(safeRequestLogPath(`/api/${"x".repeat(3_000)}?secret=1`)).toHaveLength(2_048);
  });

  it("redacts Fastify request URLs and credential headers", () => {
    expect(LOG_REDACTION_PATHS).toEqual(
      expect.arrayContaining([
        "req.url",
        "req.headers.authorization",
        "req.headers.cookie",
        "req.headers.x-csrf-token",
        "req.headers.x-lan-transfer-pin",
        "req.headers.x-toolbox-worker-token"
      ])
    );
  });

  it("keeps stable error identifiers while omitting sensitive message and stack", () => {
    const error = Object.assign(new Error("token=private F:\\Users\\user\\storage"), {
      code: "ARCHIVE_DOWNLOAD_FAILED",
      statusCode: 502
    });

    expect(safeErrorLogFields(error)).toEqual({ type: "Error", code: "ARCHIVE_DOWNLOAD_FAILED", statusCode: 502 });
    expect(JSON.stringify(safeErrorLogFields(error))).not.toMatch(/private|Users|storage|stack|message/u);
    expect(safeErrorLogFields(Object.assign(new Error("bad"), { code: "token=private", statusCode: 999 }))).toEqual({
      type: "Error"
    });
  });
});
