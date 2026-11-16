import { describe, expect, it } from "vitest";
import type { ChatterboxWorkerHealth } from "@toolbox/shared";
import { supportedChatterboxDevices } from "../domains/speech/chatterbox/device-capabilities";

const health = (overrides: Partial<ChatterboxWorkerHealth> = {}): ChatterboxWorkerHealth => ({
  protocolVersion: 1,
  available: true,
  model: "multilingual-v3",
  modelLoaded: false,
  watermarked: true,
  ...overrides
});

describe("Chatterbox worker device capabilities", () => {
  it("preserves CPU/CUDA semantics for legacy health payloads", () => {
    expect(supportedChatterboxDevices(health({ device: "cpu" }))).toEqual(["cpu"]);
    expect(supportedChatterboxDevices(health({ device: "cuda" }))).toEqual(["cpu", "cuda"]);
    expect(supportedChatterboxDevices(health({ device: "cuda", cudaAvailable: false }))).toEqual(["cpu"]);
  });

  it("requires an explicit MPS capability report unless a supported device list is supplied", () => {
    expect(supportedChatterboxDevices(health({ device: "mps" }))).toEqual(["cpu"]);
    expect(supportedChatterboxDevices(health({ mpsBuilt: true, mpsAvailable: true }))).toEqual(["cpu", "mps"]);
    expect(supportedChatterboxDevices(health({ supportedDevices: ["cpu", "mps"] }))).toEqual(["cpu", "mps"]);
  });
});
