import { afterEach, describe, expect, it, vi } from "vitest";
import { cropAudio, encodeClipWav } from "./clip-audio";
afterEach(() => {
  vi.unstubAllGlobals();
});
const data = {
  sampleRate: 10,
  numberOfChannels: 2,
  length: 10,
  getChannelData: (channel: number) =>
    channel
      ? Float32Array.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
      : Float32Array.from([0, 0.5, -0.5, 1, -1, 0, 0, 0, 0, 0])
};
describe("浏览器音频裁剪", () => {
  it("按样本边界裁剪，输出正确 PCM16 WAV 头和双声道交错数据", async () => {
    const file = encodeClipWav(data, 0.1, 0.5),
      view = new DataView(await file.arrayBuffer());
    expect(file.type).toBe("audio/wav");
    expect(file.size).toBe(44 + 4 * 2 * 2);
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(10);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(16);
    expect([44, 48, 52, 56].map((i) => view.getInt16(i, true))).toEqual([16384, -16384, 32767, -32768]);
    expect(view.getInt16(46, true)).toBe(0);
  });
  it("拒绝无效选区、超出音频和过大结果", () => {
    expect(() => encodeClipWav(data, 0.5, 0.1)).toThrow("范围");
    expect(() => encodeClipWav(data, -1, 0.1)).toThrow("范围");
    expect(() => encodeClipWav(data, 0, 2)).toThrow("范围");
    expect(() => encodeClipWav({ ...data, length: 100_000_000, sampleRate: 48000 }, 0, 2000)).toThrow("100 MiB");
  });
  it("读取、解码、导出后关闭独立解码器，不创建播放节点", async () => {
    const close = vi.fn().mockResolvedValue(undefined),
      decode = vi.fn().mockResolvedValue(data);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(10) }));
    vi.stubGlobal(
      "AudioContext",
      class {
        decodeAudioData = decode;
        close = close;
      }
    );
    const result = await cropAudio("/audio", 1, 0.1, 0.5, new AbortController().signal, vi.fn());
    expect(result.size).toBe(60);
    expect(close).toHaveBeenCalledOnce();
  });
  it("解码失败和取消都释放解码器，过长文件在下载前拦截", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(10) });
    vi.stubGlobal("fetch", request);
    vi.stubGlobal(
      "AudioContext",
      class {
        decodeAudioData = vi.fn().mockRejectedValue(new Error("decode"));
        close = close;
      }
    );
    await expect(cropAudio("/audio", 1, 0, 0.5, new AbortController().signal, vi.fn())).rejects.toThrow("decode");
    expect(close).toHaveBeenCalledOnce();
    request.mockClear();
    await expect(cropAudio("/audio", 10000, 0, 0.5, new AbortController().signal, vi.fn())).rejects.toThrow("过长");
    expect(request).not.toHaveBeenCalled();
    const controller = new AbortController();
    vi.stubGlobal(
      "AudioContext",
      class {
        async decodeAudioData() {
          controller.abort();
          return data;
        }
        close = close;
      }
    );
    await expect(cropAudio("/audio", 1, 0, 0.5, controller.signal, vi.fn())).rejects.toBeDefined();
    expect(close).toHaveBeenCalledTimes(2);
  });
});
