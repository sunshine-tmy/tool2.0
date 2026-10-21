/** 安装失败摘要仅使用可信原因码，不泄漏 URL、路径或 Worker 输出。 */
import { describe, expect, it } from "vitest";
import { installFailureAdvice, knownInstallFailure } from "../modules/components/install-diagnostics";

describe("component install diagnostics", () => {
  it("recognizes nested transport causes without echoing private error messages", () => {
    const secret = "https://user:password@example.com/?token=secret C:\\Users\\private\\中文文案";
    const error = new TypeError(secret, { cause: Object.assign(new Error(secret), { code: "ECONNRESET" }) });
    const message = knownInstallFailure(error);
    expect(message).toContain("ECONNRESET");
    expect(message).not.toContain(secret);
    expect(installFailureAdvice("COMPONENT_INSTALL_FAILED", message)).toContain("连接被中断");
  });

  it("handles unknown, circular and prototype-property codes safely", () => {
    const error = { code: "__proto__", cause: undefined as unknown };
    error.cause = error;
    expect(knownInstallFailure(error)).toBeUndefined();
    expect(knownInstallFailure(new Error("private output"))).toBeUndefined();
    expect(installFailureAdvice("__proto__", "constructor: secret")).toContain("证据不足");
    expect(installFailureAdvice(undefined, "private 文案 token=secret")).not.toContain("secret");
  });

  it("explains timeouts, disk failures and strictly recognized HTTP or integrity failures", () => {
    expect(knownInstallFailure(new DOMException("private", "TimeoutError"))).toContain("ETIMEDOUT");
    expect(installFailureAdvice("COMPONENT_DISK_SPACE_LOW", "private")).toContain("磁盘可用空间不足");
    expect(installFailureAdvice(undefined, "能力包下载服务未返回有效的分段响应（HTTP 403）")).toContain("HTTP 403");
    expect(installFailureAdvice(undefined, "能力包下载摘要校验失败")).toContain("未跳过安全校验");
    expect(installFailureAdvice(undefined, "能力包下载摘要校验失败 token=secret")).toContain("证据不足");
  });
});
