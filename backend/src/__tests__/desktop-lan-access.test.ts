import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { listTools } from "@toolbox/shared";
import { startBackend } from "../bootstrap";
import { getConfig } from "../config";
import { createRuntimeLayout } from "../runtime/runtime-layout";
import { startDesktopLanGateway } from "../runtime/desktop-lan-gateway";

afterEach(() => vi.restoreAllMocks());

describe("desktop LAN application access", () => {
  it("serves every business page, real module APIs, compression/downloads and playback protection", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-lan-app-"));
    const layout = createRuntimeLayout({ appRoot: root });
    await fs.mkdir(path.join(layout.frontendDistRoot, "assets"), { recursive: true });
    await fs.writeFile(path.join(layout.frontendDistRoot, "index.html"), "<!doctype html><title>LAN toolbox</title>");
    const config = getConfig({
      layout,
      dotenvPath: false,
      desktopManagedCapabilities: true,
      environment: { NODE_ENV: "test" }
    });
    const backend = await startBackend({ config, host: "127.0.0.1", port: 0 });
    const gateway = await startDesktopLanGateway(backend.origin, 0);
    config.lanTransferWebPort = gateway.port;
    const origin = `http://127.0.0.1:${gateway.port}`;
    try {
      for (const page of ["/", ...listTools().map((tool) => tool.routePath)]) {
        const response = await fetch(origin + page, { headers: { accept: "text/html" } });
        expect(response.status, page).toBe(200);
        expect(await response.text()).toContain("LAN toolbox");
      }
      for (const route of [
        "/api/v1/tools",
        "/api/v1/tools/image-ai/health",
        "/api/v1/tools/lan-transfer/info",
        "/api/v1/tools/video-text/history",
        "/api/v1/tools/edge-tts/health",
        "/api/v1/tools/edge-tts/chatterbox/batches",
        "/api/v1/tools/audio-library/items",
        "/api/v1/tools/media-archive/items"
      ]) {
        const response = await fetch(origin + route);
        // 未安装 AI 能力的测试主机仍能访问其业务接口，并收到明确的能力未就绪结果。
        expect(response.status, route).toBe(route === "/api/v1/tools/image-ai/health" ? 503 : 200);
        expect((await response.json()).success, route).toBe(route !== "/api/v1/tools/image-ai/health");
      }
      // 不访问外网：非法业务输入应到达解析器并返回校验错误，而不是被网关拦成 404。
      expect(
        (
          await fetch(`${origin}/api/v1/tools/short-video/parse`, {
            method: "POST",
            headers: { origin, "content-type": "application/json" },
            body: "{}"
          })
        ).status
      ).toBe(400);
      const image = await sharp({ create: { width: 12, height: 12, channels: 3, background: "#ff0000" } })
        .png()
        .toBuffer();
      const form = new FormData();
      form.set("file", new Blob([new Uint8Array(image)], { type: "image/png" }), "test.png");
      const compressed = await fetch(`${origin}/api/v1/tools/image-compress`, {
        method: "POST",
        headers: { origin },
        body: form
      });
      expect(compressed.status).toBe(200);
      const result = (await compressed.json()).data;
      expect(result.task.status).toBe("completed");
      expect((await fetch(origin + result.downloadUrl)).status).toBe(200);
      expect((await fetch(`${origin}/api/v1/tasks/${result.task.id}`)).status).toBe(200);
      const events = await fetch(`${origin}/api/v1/tasks/${result.task.id}/events`);
      expect(events.headers.get("content-type")).toContain("text/event-stream");
      await events.body?.cancel();

      const playback = (active: boolean) =>
        fetch(`${origin}/api/v1/lan-access/playback`, {
          method: "POST",
          headers: { origin, "content-type": "application/json" },
          body: JSON.stringify({ clientId: "remote-test", active })
        });
      expect(
        (
          await fetch(`${origin}/api/v1/lan-access/playback`, {
            method: "POST",
            headers: { origin, "content-type": "application/json" },
            body: JSON.stringify({ clientId: "../../invalid", active: true })
          })
        ).status
      ).toBe(400);
      expect((await playback(true)).status).toBe(200);
      expect(backend.shutdown.inspect().busy).toBe(true);
      expect(backend.shutdown.prepare(false).prepared).toBe(false);
      expect((await playback(false)).status).toBe(200);
      expect(backend.shutdown.inspect().busy).toBe(false);
      for (const route of ["/api/v1/components", "/api/v1/diagnostics", "/api/v1/session", "/settings"])
        expect((await fetch(origin + route)).status).toBe(404);

      const nic = (address: string, internal = false): os.NetworkInterfaceInfo => ({
        address,
        internal,
        family: "IPv4",
        netmask: "255.255.255.0",
        mac: "00:00:00:00:00:00",
        cidr: `${address}/24`
      });
      vi.spyOn(os, "networkInterfaces").mockReturnValue({
        Ethernet: [nic("192.168.1.241"), nic("192.168.1.241"), nic("127.0.0.1", true), nic("8.8.8.8")]
      });
      const address = await (await fetch(`${origin}/api/v1/lan-access`)).json();
      expect(address.data).toMatchObject({
        status: "ready",
        urls: [`http://192.168.1.241:${gateway.port}/`],
        port: gateway.port,
        toolCount: 8
      });
      vi.mocked(os.networkInterfaces).mockReturnValue({});
      expect((await (await fetch(`${origin}/api/v1/lan-access`)).json()).data).toMatchObject({
        status: "no-network",
        urls: []
      });
      config.lanTransferWebPort = 0;
      expect((await (await fetch(`${origin}/api/v1/lan-access`)).json()).data).toMatchObject({
        status: "unavailable",
        urls: [],
        port: 0
      });
    } finally {
      await Promise.all([gateway.close(), backend.close()]);
      await fs.rm(root, { recursive: true, force: true });
    }
  }, 30_000);
});
