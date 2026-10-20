/**
 * 中文模块说明：后端可复用启动器的回归测试，供桌面壳使用随机 loopback 端口。
 */
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { startBackend } from "../bootstrap";
import { getConfig } from "../config";
import { createRuntimeLayout } from "../runtime/runtime-layout";

describe("startBackend", () => {
  it("starts on a supplied loopback port and exposes the ready endpoint", async () => {
    const root = path.join(os.tmpdir(), "toolbox-bootstrap-test");
    const config = getConfig({
      dotenvPath: false,
      environment: { NODE_ENV: "test" },
      layout: createRuntimeLayout({
        appRoot: root,
        configRoot: root,
        storageRoot: path.join(root, "storage"),
        runtimeRoot: path.join(root, "runtime"),
        modelsRoot: path.join(root, "models"),
        scriptsRoot: path.join(root, "scripts"),
        frontendDistRoot: path.join(root, "frontend")
      })
    });
    const backend = await startBackend({ config, host: "127.0.0.1", port: 0 });

    try {
      const response = await fetch(`${backend.origin}/health/ready`);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ success: true, data: { status: "ready" } });
      expect(backend.shutdown.prepare(false)).toMatchObject({ prepared: true });
      const late = await fetch(`${backend.origin}/api/v1/diagnostics/playback`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientId: "test", active: true })
      });
      expect(late.status).toBe(503);
      expect(await late.json()).toMatchObject({ error: { code: "APP_SHUTTING_DOWN" } });
      expect((await fetch(`${backend.origin}/health/ready`)).status).toBe(200);
    } finally {
      await backend.close();
    }
  });
});
