/**
 * 中文模块说明：测试 apps/api/src/__tests__/worker-client.test.ts 中的稳定行为、边界条件和回归场景
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import type { AppConfig } from "../config";
import { createChatterboxWorkerClient } from "../domains/speech/chatterbox/worker-client";
import { createImageAiWorkerClient } from "../domains/image-ai/worker-client";

const config = {
  chatterboxWorkerUrl: "http://worker.test",
  chatterboxWorkerToken: "chatterbox-token",
  chatterboxWorkerTimeoutMs: 1_000,
  imageAiWorkerUrl: "http://worker.test",
  imageAiWorkerToken: "image-token",
  imageAiWorkerTimeoutMs: 1_000,
  deploymentUsage: "commercial"
} as AppConfig;

describe("Worker clients", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each(["verified", "missing", "tampered", "python-missing", "unmanaged", "unknown-version", "not-ready"])(
    "corrects only the known packaged BiRefNet health false-negative (%s)",
    async (scenario) => {
      const directory = await fs.mkdtemp(path.join(os.tmpdir(), "birefnet-health-"));
      try {
        const file = path.join(directory, "birefnet-general.onnx");
        const content = Buffer.from("verified-model");
        await fs.writeFile(file, scenario === "tampered" ? Buffer.from("tampered-model") : content);
        if (scenario === "missing") await fs.unlink(file);
        const local = {
          ...config,
          desktopManagedCapabilities: scenario !== "unmanaged",
          imageAiCapabilityReady: scenario !== "not-ready",
          imageAiBirefnetAsset: {
            path: file,
            bytes: content.length,
            sha256: crypto.createHash("sha256").update(content).digest("hex"),
            version: scenario === "unknown-version" ? "other" : "1.0.0-py312-cpu1"
          }
        };
        const reason = scenario === "python-missing" ? "缺少 Python 包：rembg" : "缺少本地模型权重";
        vi.stubGlobal(
          "fetch",
          vi.fn(async () =>
            jsonResponse({
              success: true,
              data: {
                protocolVersion: 1,
                available: false,
                deploymentUsage: "commercial",
                workerUrl: "http://127.0.0.1:3210",
                models: [
                  {
                    provider: "birefnet-general",
                    model: "BiRefNet",
                    version: "2.0.84",
                    license: "MIT",
                    device: "cpu",
                    available: false,
                    reason
                  },
                  {
                    provider: "bria-rmbg-2.0",
                    model: "BRIA",
                    version: "test",
                    license: "CC-BY-NC-4.0",
                    device: "cpu",
                    available: false,
                    reason: "当前部署模式禁止使用非商用模型"
                  }
                ]
              }
            })
          )
        );
        const client = createImageAiWorkerClient(local);
        const health = await client.health();
        expect(health.models[0].available).toBe(scenario === "verified");
        expect(health.models[1].available).toBe(false);
        expect(JSON.stringify(health)).not.toContain(directory);
        if (scenario === "verified") {
          expect((await client.health()).models[0].available).toBe(true);
          await fs.writeFile(file, "tampered-model");
          expect((await client.health()).models[0].available).toBe(false);
        }
      } finally {
        await fs.rm(directory, { recursive: true, force: true });
      }
    }
  );

  it("distinguishes a protocol mismatch from malformed image data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          success: true,
          data: {
            protocolVersion: 2,
            available: true,
            deploymentUsage: "commercial",
            workerUrl: "http://127.0.0.1:3210",
            models: []
          }
        })
      )
    );
    await expect(createImageAiWorkerClient(config).health()).rejects.toMatchObject({
      code: "WORKER_PROTOCOL_MISMATCH"
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ success: true, data: { available: true } }))
    );
    await expect(createImageAiWorkerClient(config).health()).rejects.toMatchObject({
      code: "IMAGE_AI_WORKER_INVALID_RESPONSE",
      status: 502
    });
  });

  it("rejects malformed Chatterbox generation output", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ success: true, data: { samples: -1 } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      createChatterboxWorkerClient(config).generate({
        text: "hello",
        language: "en",
        device: "cpu",
        referencePath: "reference.wav",
        outputPath: "output.wav",
        exaggeration: 0.5,
        cfgWeight: 0.5,
        temperature: 0.8,
        seed: 1
      })
    ).rejects.toMatchObject({
      code: "CHATTERBOX_WORKER_INVALID_RESPONSE",
      status: 502
    });
    const init = (fetchMock.mock.calls[0] as unknown as [RequestInfo, RequestInit])[1];
    expect(JSON.parse(String(init.body))).toMatchObject({ device: "cpu" });
  });

  it("sends a configured token only through the local Worker request", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        success: true,
        data: {
          protocolVersion: 1,
          available: true,
          deploymentUsage: "commercial",
          workerUrl: "http://127.0.0.1:3210",
          models: []
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await createImageAiWorkerClient(config).health();

    const init = (fetchMock.mock.calls[0] as unknown as [RequestInfo, RequestInit])[1];
    expect(new Headers(init.headers).get("x-toolbox-worker-token")).toBe("image-token");
  });
});

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" }
  });
}
