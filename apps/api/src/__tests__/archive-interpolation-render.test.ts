import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as renderer from "../domains/content-archive/video-edit/renderer";
import {
  defaultArchiveFrame,
  defaultArchiveInterpolation,
  defaultArchiveStudio,
  type ArchiveCutClip,
  type ArchiveInterpolation
} from "@toolbox/shared";
import {
  renderArchiveVideo,
  runMediaProcess,
  probeMedia,
  type MediaTools
} from "../domains/content-archive/video-edit/renderer";
import { interpolationCacheKey } from "../domains/content-archive/video-edit/interpolation-cache";
import { sceneGroups } from "../domains/content-archive/video-edit/interpolation-rife";

const tools: MediaTools = {
  ffmpeg: process.env.TEST_FFMPEG_PATH ?? "ffmpeg",
  ffprobe: process.env.TEST_FFPROBE_PATH ?? "ffprobe"
};
const available = [tools.ffmpeg, tools.ffprobe].every(
  (tool) => spawnSync(tool, ["-version"], { windowsHide: true, stdio: "ignore" }).status === 0
);
const settings = {
  originalVolume: 100,
  musicVolume: 0,
  musicStartSeconds: 0,
  loop: false,
  fadeInSeconds: 0,
  fadeOutSeconds: 0
};
const signal = () => new AbortController().signal;
describe.skipIf(!available)("真实智能补帧及多轨导出", () => {
  let root: string, source: string;
  beforeAll(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-interpolation-render-"));
    source = path.join(root, "source.mkv");
    await runMediaProcess(
      tools.ffmpeg,
      [
        "-v",
        "error",
        "-y",
        "-f",
        "lavfi",
        "-i",
        "nullsrc=s=64x32:r=4:d=2,geq=lum='if(between(X,4*N,4*N+14),235,16)':cb=128:cr=128",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:sample_rate=8000:duration=2",
        "-c:v",
        "ffv1",
        "-c:a",
        "pcm_s16le",
        source
      ],
      signal()
    );
  });
  afterAll(async () => {
    if (root && path.dirname(root) === os.tmpdir() && path.basename(root).startsWith("toolbox-interpolation-render-"))
      await fs.rm(root, { recursive: true, force: true });
  });
  async function render(name: string, fps: 30 | 60 | 120, clips: ArchiveCutClip[], engineTools = tools) {
    const output = path.join(root, `${name}.mp4`),
      statuses: string[] = [];
    const info = await renderArchiveVideo({
      tools: engineTools,
      source,
      output,
      cut: clips,
      settings,
      frame: { ...defaultArchiveFrame(), fps },
      signal: signal(),
      maxBytes: 32 * 1024 ** 2,
      sourceChecksum: "a".repeat(64),
      interpolationCacheRoot: path.join(root, "cache"),
      onProgress: () => {},
      onStatus: (message) => statuses.push(message)
    });
    return { output, info, statuses };
  }
  const clip = (extra: Partial<ArchiveCutClip> = {}): ArchiveCutClip => ({
    id: "clip_001",
    start: 0,
    end: 2,
    interpolation: { ...defaultArchiveInterpolation(), quality: "fast" },
    ...extra
  });
  async function gray(file: string, time: number) {
    const target = path.join(root, "frame.raw");
    await runMediaProcess(
      tools.ffmpeg,
      [
        "-v",
        "error",
        "-y",
        "-ss",
        String(time),
        "-i",
        file,
        "-frames:v",
        "1",
        "-pix_fmt",
        "gray",
        "-f",
        "rawvideo",
        target
      ],
      signal()
    );
    return fs.readFile(target);
  }
  function center(bytes: Buffer) {
    let sum = 0,
      mass = 0;
    for (let x = 0; x < 64; x++) {
      const weight = Math.max(0, bytes[16 * 64 + x] - 30);
      sum += x * weight;
      mass += weight;
    }
    return sum / mass;
  }
  it.each([30, 60, 120] as const)(
    "导出 %i FPS，保持时长，并实际生成中间画面",
    async (fps) => {
      const { output, info } = await render(`fps-${fps}`, fps, [clip()]);
      expect(info.fps).toBeCloseTo(fps, 2);
      expect(info.duration).toBeCloseTo(2, 1);
      const frame = await gray(output, 0.125),
        before = await gray(source, 0),
        after = await gray(source, 0.25);
      expect(Buffer.compare(frame, before)).not.toBe(0);
      expect(Buffer.compare(frame, after)).not.toBe(0);
      expect(center(frame)).toBeGreaterThan(center(before) + 0.5);
      expect(center(frame)).toBeLessThan(center(after) - 0.5);
    },
    30000
  );
  it("多轨和慢动作保留 60 FPS，声音持续到片段结尾，缓存复用不丢失音量变化", async () => {
    const { output, info } = await render("slow", 60, [
      clip({ speed: 0.5, at: 0, lane: 1, transform: { scaleX: 0.8 } })
    ]);
    expect(info.fps).toBeCloseTo(60, 2);
    expect(info.duration).toBeCloseTo(4, 1);
    expect((await probeMedia(tools, output, signal())).hasAudio).toBe(true);
    const cached = await render("cache-muted", 60, [clip({ speed: 0.5, volume: 0, at: 0, lane: 1 })]);
    expect(cached.statuses.some((message) => message.includes("缓存"))).toBe(true);
    const file = path.join(root, "muted.pcm");
    await runMediaProcess(
      tools.ffmpeg,
      ["-v", "error", "-y", "-i", cached.output, "-vn", "-ac", "1", "-ar", "8000", "-f", "s16le", file],
      signal()
    );
    const pcm = await fs.readFile(file);
    expect(
      Array.from({ length: pcm.length / 2 }, (_, i) => Math.abs(pcm.readInt16LE(i * 2))).every((sample) => sample < 10)
    ).toBe(true);
  }, 30000);
  it("高倍速有效帧率足够时直接采样，不启动 AI 或解出海量中间图片", async () => {
    const { info, statuses } = await render(
      "fast-downsample",
      30,
      [
        clip({
          speed: 10,
          interpolation: { ...defaultArchiveInterpolation(), engine: "rife" }
        })
      ],
      { ...tools, rife: { executable: "must-not-run", model: "must-not-read", version: "downsample-test" } }
    );
    expect(info.fps).toBeCloseTo(30, 2);
    expect(info.duration).toBeCloseTo(0.2, 1);
    expect(statuses.some((message) => message.includes("源画面帧率已足够，按目标帧率输出"))).toBe(true);
  });
  it("最终保存对包含字幕的完整成片补帧，改变补帧质量复用合成结果", async () => {
    const compositionCacheRoot = path.join(root, "composed-cache"),
      statuses: string[] = [];
    const studio = {
      ...defaultArchiveStudio(),
      subtitles: [
        {
          id: "subtitle_001",
          start: 0,
          end: 2,
          text: "ABC",
          fontSize: 144,
          color: "#ff0000",
          position: "center" as const,
          lane: 0
        }
      ]
    };
    const options = {
      tools,
      source,
      settings,
      frame: defaultArchiveFrame(),
      studio,
      cut: [clip({ interpolation: { ...defaultArchiveInterpolation(), engine: "rife" } })],
      ignoreClipInterpolation: true,
      compositionCacheRoot,
      compositionKey: "b".repeat(64),
      interpolationCacheRoot: path.join(root, "final-cache"),
      maxBytes: 64 * 1024 ** 2,
      onProgress: () => {},
      onStatus: (message: string) => statuses.push(message),
      outputSettings: {
        fps: 30 as const,
        interpolation: { ...defaultArchiveInterpolation(), quality: "fast" as const }
      }
    };
    const output = path.join(root, "final-composed.mp4");
    const result = await renderArchiveVideo({ ...options, output, signal: signal() });
    expect(result.fps).toBeCloseTo(30, 2);
    expect(result.duration).toBeCloseTo(2, 1);
    expect(statuses.some((message) => message.startsWith("智能补帧"))).toBe(true);
    expect(statuses.some((message) => message.startsWith("最终编码"))).toBe(true);
    const cache = path.join(compositionCacheRoot, "b".repeat(64) + ".mkv");
    const info = await probeMedia(tools, cache, signal());
    expect(info.codec).toBe("ffv1");
    const raw = path.join(root, "final-rgb.raw");
    await runMediaProcess(
      tools.ffmpeg,
      ["-v", "error", "-y", "-ss", "0.5", "-i", output, "-frames:v", "1", "-pix_fmt", "rgb24", "-f", "rawvideo", raw],
      signal()
    );
    const rgb = await fs.readFile(raw);
    expect(
      Array.from(
        { length: rgb.length / 3 },
        (_, i) => rgb[i * 3] > rgb[i * 3 + 1] + 30 && rgb[i * 3] > rgb[i * 3 + 2] + 30
      ).some(Boolean)
    ).toBe(true);
    const firstHash = await fs.readFile(cache);
    await renderArchiveVideo({
      ...options,
      output: path.join(root, "final-quality.mp4"),
      signal: signal(),
      outputSettings: { fps: 60, interpolation: defaultArchiveInterpolation() }
    });
    expect(await fs.readFile(cache)).toEqual(firstHash);
    expect(await fs.readdir(compositionCacheRoot)).toEqual(["b".repeat(64) + ".mkv"]);
  }, 30000);
  it("关闭最终补帧时不执行历史片段的 AI 参数，普通帧率转换仍可输出", async () => {
    const info = await renderArchiveVideo({
      tools,
      source,
      output: path.join(root, "final-off.mp4"),
      settings,
      cut: [clip({ interpolation: { ...defaultArchiveInterpolation(), engine: "rife" } })],
      ignoreClipInterpolation: true,
      outputSettings: { fps: 60 },
      signal: signal(),
      maxBytes: 32 * 1024 ** 2,
      onProgress: () => {}
    });
    expect(info.fps).toBeCloseTo(60, 2);
    expect(info.duration).toBeCloseTo(2, 1);
  });
  it("取消成片补帧会清理中间文件，保留原片且不生成成品", async () => {
    const controller = new AbortController(),
      output = path.join(root, "final-cancel.mp4");
    const original = await fs.readFile(source);
    await expect(
      renderArchiveVideo({
        tools,
        source,
        output,
        settings,
        signal: controller.signal,
        outputSettings: { fps: 60, interpolation: defaultArchiveInterpolation() },
        maxBytes: 32 * 1024 ** 2,
        onProgress: () => {},
        onStatus: (message) => {
          if (message.startsWith("智能补帧")) controller.abort();
        }
      })
    ).rejects.toThrow();
    expect(await fs.readFile(source)).toEqual(original);
    expect((await fs.readdir(root)).filter((name) => name.startsWith("final-cancel.mp4"))).toEqual([]);
  });
  it.skipIf(!process.env.TEST_RIFE_PATH || !process.env.TEST_RIFE_MODEL_DIR)(
    "原生 RIFE 对完整合成成片补帧后正确编码",
    async () => {
      const output = path.join(root, "final-rife.mp4");
      const result = await renderArchiveVideo({
        tools: {
          ...tools,
          rife: {
            executable: process.env.TEST_RIFE_PATH!,
            model: process.env.TEST_RIFE_MODEL_DIR!,
            version: "native-final-test"
          }
        },
        source,
        output,
        settings,
        outputSettings: {
          fps: 30,
          interpolation: { ...defaultArchiveInterpolation(), engine: "rife", quality: "fast" }
        },
        signal: signal(),
        maxBytes: 64 * 1024 ** 2,
        onProgress: () => {}
      });
      expect(result.fps).toBeCloseTo(30, 2);
      expect(result.duration).toBeCloseTo(2, 1);
      const middle = await gray(output, 0.125);
      expect(center(middle)).toBeGreaterThan(center(await gray(source, 0)) + 0.5);
      expect(center(middle)).toBeLessThan(center(await gray(source, 0.25)) - 0.5);
    },
    30000
  );
  it("切镜保护不产生跨镜头灰色过渡", async () => {
    const scene = path.join(root, "scene.mkv");
    await runMediaProcess(
      tools.ffmpeg,
      [
        "-v",
        "error",
        "-y",
        "-f",
        "lavfi",
        "-i",
        "nullsrc=s=64x32:r=4:d=2,geq=lum='if(lt(N,4),16,235)':cb=128:cr=128",
        "-c:v",
        "ffv1",
        scene
      ],
      signal()
    );
    const output = path.join(root, "scene-result.mp4");
    await renderArchiveVideo({
      tools,
      source: scene,
      output,
      cut: [clip()],
      settings,
      frame: { ...defaultArchiveFrame(), fps: 60 },
      signal: signal(),
      maxBytes: 32 * 1024 ** 2,
      onProgress: () => {}
    });
    const a = await gray(output, 0.98),
      b = await gray(output, 1.02);
    expect(a[16 * 64 + 32]).toBeLessThan(10);
    expect(b[16 * 64 + 32]).toBeGreaterThan(240);
  }, 30000);
  it("定格取补帧后的当前画面，保存后仍保留该中间帧", async () => {
    const settings = { ...defaultArchiveInterpolation(), quality: "fast" as const };
    const reference = await render("freeze-reference", 60, [clip()]);
    const frozen = await render("freeze-interpolated", 60, [
      clip({
        start: 0,
        end: 3,
        freezeAt: 0,
        interpolation: undefined,
        freezeSample: { start: 0, end: 2, speed: 1, reverse: false, interpolation: settings, time: 0.1, fps: 60 }
      })
    ]);
    expect(frozen.info.duration).toBeCloseTo(3, 1);
    const a = await gray(frozen.output, 0.5),
      b = await gray(frozen.output, 2.5),
      target = await gray(reference.output, 0.1);
    expect(Math.abs(center(a) - center(b))).toBeLessThan(0.2);
    expect(Math.abs(center(a) - center(target))).toBeLessThan(0.6);
  }, 30000);
  it("取消补帧后清理临时目录并保留原视频", async () => {
    const original = await fs.readFile(source),
      controller = new AbortController();
    const promise = renderArchiveVideo({
      tools,
      source,
      output: path.join(root, "cancel.mp4"),
      cut: [clip()],
      settings,
      frame: { ...defaultArchiveFrame(), fps: 60 },
      signal: controller.signal,
      maxBytes: 32 * 1024 ** 2,
      onProgress: () => {},
      onStatus: (message) => {
        if (message.includes("补帧")) setTimeout(() => controller.abort(), 0);
      }
    });
    await expect(promise).rejects.toBeDefined();
    expect(await fs.readFile(source)).toEqual(original);
    expect((await fs.readdir(root)).some((name) => name.includes(".clips-"))).toBe(false);
  }, 30000);
  it("显式允许兼容回退才在缺少 AI 时使用兼容引擎", async () => {
    const interpolation: ArchiveInterpolation = {
      ...defaultArchiveInterpolation(),
      engine: "rife",
      quality: "fast",
      allowFallback: false
    };
    await expect(render("missing-rife", 60, [clip({ interpolation })])).rejects.toMatchObject({
      code: "ARCHIVE_INTERPOLATION_NOT_INSTALLED"
    });
    const result = await render("fallback", 60, [clip({ interpolation: { ...interpolation, allowFallback: true } })]);
    expect(result.statuses.some((message) => message.includes("按设置"))).toBe(true);
    expect(result.info.fps).toBeCloseTo(60, 2);
  }, 30000);
  it.skipIf(!process.env.TEST_RIFE_PATH || !process.env.TEST_RIFE_MODEL_DIR)(
    "RIFE 原生引擎实际输出中间帧和正确帧率",
    async () => {
      const rife = {
        executable: process.env.TEST_RIFE_PATH!,
        model: process.env.TEST_RIFE_MODEL_DIR!,
        version: "validation-rife46"
      };
      const actual = renderer.runMediaProcess;
      let failGpu = true;
      const spy = vi.spyOn(renderer, "runMediaProcess").mockImplementation(async (...args) => {
        if (args[0] === rife.executable && failGpu) {
          failGpu = false;
          args[3]?.onDiagnostic?.("Vulkan allocation failed: out of device memory");
          throw new renderer.VideoEditError("ARCHIVE_EDIT_RENDER_FAILED", "模拟设备资源不足");
        }
        return actual(...args);
      });
      try {
        const result = await render(
          "rife-native",
          60,
          [clip({ end: 0.75, interpolation: { ...defaultArchiveInterpolation(), engine: "rife", quality: "fast" } })],
          { ...tools, rife }
        );
        expect(result.info.fps).toBeCloseTo(60, 2);
        expect(result.info.duration).toBeCloseTo(0.75, 1);
        expect(result.statuses.some((message) => message.includes("CPU 模式重试"))).toBe(true);
        const frame = await gray(result.output, 0.125),
          first = await gray(source, 0),
          second = await gray(source, 0.25);
        expect(center(frame)).toBeGreaterThan(center(first) + 0.5);
        expect(center(frame)).toBeLessThan(center(second) - 0.5);
      } finally {
        spy.mockRestore();
      }
    },
    180000
  );
});
it("补帧缓存忽略音量和空间变换，区间/速度/方向/质量/模型/帧率变化使缓存失效", () => {
  const clip: ArchiveCutClip = { id: "clip_001", start: 0, end: 2, interpolation: defaultArchiveInterpolation() };
  const key = interpolationCacheKey("checksum", clip, 60);
  expect(interpolationCacheKey("checksum", { ...clip, volume: 0, fadeIn: 1, transform: { angle: 90 } }, 60)).toBe(key);
  for (const changed of [
    { speed: 0.5 },
    { reverse: true },
    { end: 1 },
    { interpolation: { ...clip.interpolation!, quality: "high" as const } }
  ])
    expect(interpolationCacheKey("checksum", { ...clip, ...changed }, 60)).not.toBe(key);
  expect(interpolationCacheKey("checksum", clip, 120)).not.toBe(key);
  expect(interpolationCacheKey("checksum", clip, 60, "another-model")).not.toBe(key);
});
it("AI 分镜分组只在切镜处分段，关闭保护可连续处理", () => {
  const gray = new Uint8Array(4 * 64);
  gray.fill(255, 2 * 64);
  expect(sceneGroups(gray, 4, true)).toEqual([
    { start: 0, end: 2 },
    { start: 2, end: 4 }
  ]);
  expect(sceneGroups(gray, 4, false)).toEqual([{ start: 0, end: 4 }]);
});
