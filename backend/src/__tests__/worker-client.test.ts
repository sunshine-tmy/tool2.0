import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../config";
import { createChatterboxWorkerClient } from "../modules/chatterbox/worker-client";
import { createImageAiWorkerClient } from "../modules/image-ai/worker-client";

const config = {
  chatterboxWorkerUrl: "http://worker.test",
  chatterboxWorkerTimeoutMs: 1_000,
  imageAiWorkerUrl: "http://worker.test",
  imageAiWorkerTimeoutMs: 1_000,
  deploymentUsage: "commercial"
} as AppConfig;

describe("Worker clients", () => {
  afterEach(() => vi.unstubAllGlobals());

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
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ success: true, data: { samples: -1 } }))
    );
    await expect(
      createChatterboxWorkerClient(config).generate({
        text: "hello",
        language: "en",
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
  });
});

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" }
  });
}
