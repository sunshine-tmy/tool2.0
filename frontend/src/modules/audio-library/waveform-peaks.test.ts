import { describe, expect, it, vi } from "vitest";
import { extractWaveformPeaks, loadWaveformPeaks } from "./waveform-peaks";
import { decodeAudioSamples } from "./clip-audio";
vi.mock("./clip-audio", () => ({ decodeAudioSamples: vi.fn() }));
const samples = {
  length: 8,
  numberOfChannels: 1,
  getChannelData: () => Float32Array.from([0, 0.2, -0.6, 0.1, 0, 0.9, -1, 0])
};
describe("真实波形采样", () => {
  it("使用真实振幅生成峰值，静音保持平直而非假波形", () => {
    expect([...extractWaveformPeaks(samples, 4)]).toEqual(
      expect.arrayContaining([expect.closeTo(0.2), expect.closeTo(0.6), expect.closeTo(0.9), 1])
    );
    expect([...extractWaveformPeaks({ ...samples, getChannelData: () => new Float32Array(8) }, 4)]).toEqual([
      0, 0, 0, 0
    ]);
  });
  it("串行解码、缓存轻量峰值，取消排队任务不再解码", async () => {
    let finish!: (value: AudioBuffer) => void;
    vi.mocked(decodeAudioSamples).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const first = loadWaveformPeaks("/wave-one", 1, new AbortController().signal);
    const cancelled = new AbortController();
    const second = loadWaveformPeaks("/wave-two", 1, cancelled.signal);
    const rejected = expect(second).rejects.toBeDefined();
    await Promise.resolve();
    cancelled.abort();
    expect(decodeAudioSamples).toHaveBeenCalledTimes(1);
    finish(samples as unknown as AudioBuffer);
    const peaks = await first;
    await rejected;
    expect(await loadWaveformPeaks("/wave-one", 1, new AbortController().signal)).toBe(peaks);
    expect(decodeAudioSamples).toHaveBeenCalledTimes(1);
  });
});
