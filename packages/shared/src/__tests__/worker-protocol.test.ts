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
        models: []
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
