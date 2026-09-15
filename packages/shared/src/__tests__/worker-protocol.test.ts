/**
 * 中文模块说明：测试 packages/shared/src/__tests__/worker-protocol.test.ts 中的稳定行为、边界条件和回归场景
 */
import { describe, expect, it } from "vitest";
import {
  isChatterboxWorkerGenerate,
  isImageWorkerHealth,
  isImageWorkerProcess,
  isImageWorkerSuggestion
} from "../worker-protocol";

describe("Worker protocol schemas", () => {
  it("accepts a structurally valid image worker health payload", () => {
    expect(
      isImageWorkerHealth({
        protocolVersion: 1,
        available: true,
        deploymentUsage: "commercial",
        workerUrl: "http://127.0.0.1:3210",
        models: [
          {
            provider: "paddleocr",
            model: "PP-OCRv5",
            version: "3.0.0",
            license: "Apache-2.0",
            sha256: null,
            device: "cpu",
            available: true,
            reason: null
          }
        ]
      })
    ).toBe(true);
  });

  it("rejects malformed inference results", () => {
    expect(
      isImageWorkerSuggestion({
        width: 10,
        height: 10,
        suggestions: [{ polygon: [{ x: 2, y: 0 }], confidence: 2 }],
        provider: "paddleocr",
        model: "test",
        warnings: []
      })
    ).toBe(false);
    expect(isImageWorkerProcess({ provider: "shell", model: "test" })).toBe(false);
    expect(
      isChatterboxWorkerGenerate({
        sampleRate: 24_000,
        samples: -1,
        durationSeconds: 1,
        chunks: 1,
        segments: [],
        device: "cpu",
        watermarked: true
      })
    ).toBe(false);
  });
});
