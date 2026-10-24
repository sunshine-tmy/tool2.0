/** 中文模块说明：桌面 Worker 会话回归测试，验证端口不固定且令牌只在会话期间存在。 */
import { describe, expect, it } from "vitest";
import { createDesktopWorkerSession, workerSessionEnvironment } from "../runtime/worker-session";
import { getConfig } from "../config";

describe("desktop worker session", () => {
  it("allocates distinct loopback ports and independent high-entropy tokens", async () => {
    const session = await createDesktopWorkerSession();
    const environment = workerSessionEnvironment(session);

    expect(session.xhsProviderPort).toBeGreaterThan(0);
    expect(session.xhsTranslationPort).toBeGreaterThan(0);
    expect(session.xhsProviderPort).not.toBe(session.xhsTranslationPort);
    expect(session.xhsProviderToken).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(session.xhsTranslationToken).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(session.xhsProviderToken).not.toBe(session.xhsTranslationToken);
    expect(environment).toMatchObject({
      XHS_PROVIDER_PORT: String(session.xhsProviderPort),
      XHS_TRANSLATION_PROVIDER_PORT: String(session.xhsTranslationPort)
    });
    expect(JSON.stringify(environment)).not.toContain("http");
  });

  it("rejects a non-loopback endpoint before a Worker token could be sent", () => {
    expect(() =>
      getConfig({ dotenvPath: false, environment: { IMAGE_AI_WORKER_URL: "https://worker.example.test" } })
    ).toThrow("IMAGE_AI_WORKER_URL must be an http loopback URL");
  });
});
