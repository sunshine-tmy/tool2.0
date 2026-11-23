import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { defaultArchiveFrame, type ArchiveCutClip } from "@toolbox/shared";
import { renderArchiveVideo, runMediaProcess } from "../domains/content-archive/video-edit/renderer";
const tools = { ffmpeg: process.env.TEST_FFMPEG_PATH ?? "ffmpeg", ffprobe: process.env.TEST_FFPROBE_PATH ?? "ffprobe" };
const available = [tools.ffmpeg, tools.ffprobe].every(
  (tool) => spawnSync(tool, ["-version"], { windowsHide: true, stdio: "ignore" }).status === 0
);
describe.skipIf(!available)("视频工具真实 FFmpeg 渲染", () => {
  let root: string, source: string;
  const signal = () => new AbortController().signal;
  beforeAll(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-video-tools-"));
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
        "nullsrc=s=64x32:r=10:d=4,geq=lum='20+N*4+X/2':cb=128:cr=128",
        "-f",
        "lavfi",
        "-i",
        "aevalsrc=0.2*sin(2*PI*(200*t+50*t*t)):s=8000:d=4",
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
    if (root && path.dirname(root) === os.tmpdir() && path.basename(root).startsWith("toolbox-video-tools-"))
      await fs.rm(root, { recursive: true, force: true });
  });
  async function render(name: string, cut: ArchiveCutClip[]) {
    const output = path.join(root, `${name}.mp4`);
    const result = await renderArchiveVideo({
      tools,
      source,
      output,
      cut,
      frame: { ...defaultArchiveFrame(), fit: "contain" },
      settings: {
        originalVolume: 100,
        musicVolume: 0,
        musicStartSeconds: 0,
        loop: false,
        fadeInSeconds: 0,
        fadeOutSeconds: 0
      },
      signal: signal(),
      maxBytes: 32 * 1024 ** 2,
      preview: false,
      onProgress: () => {}
    });
    return { output, result };
  }
  async function pixels(file: string, time: number) {
    const target = path.join(root, "frame.gray");
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
  async function audio(file: string, time: number) {
    const target = path.join(root, "audio.pcm");
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
        "-t",
        "0.4",
        "-vn",
        "-ac",
        "1",
        "-ar",
        "8000",
        "-f",
        "s16le",
        target
      ],
      signal()
    );
    const bytes = await fs.readFile(target);
    const samples = Array.from({ length: bytes.length / 2 }, (_, i) => bytes.readInt16LE(i * 2));
    return {
      rms: Math.sqrt(samples.reduce((n, v) => n + v * v, 0) / samples.length),
      crossings: samples.slice(1).filter((v, i) => v >= 0 && samples[i] < 0).length
    };
  }
  it("跨两个分块倒放画面和原声，保持区间与时长", async () => {
    const { output, result } = await render("reverse", [{ id: "clip_001", start: 0.5, end: 3.5, reverse: true }]);
    expect(result.duration).toBeCloseTo(3, 1);
    const early = await pixels(output, 0.1),
      late = await pixels(output, 2.8);
    expect(early[16 * 64 + 32]).toBeGreaterThan(late[16 * 64 + 32] + 70);
    expect((await audio(output, 0.1)).crossings).toBeGreaterThan((await audio(output, 2.5)).crossings + 50);
    expect((await fs.readdir(root)).some((name) => name.includes(".clips-"))).toBe(false);
  }, 30000);
  it("定格输出三秒同一画面且无原声，后半段恢复正常声音", async () => {
    const { output, result } = await render("freeze", [
      { id: "clip_001", start: 0, end: 1, at: 0 },
      { id: "clip_002", start: 0, end: 3, freezeAt: 0.7, at: 1 },
      { id: "clip_003", start: 1, end: 4, at: 4 }
    ]);
    expect(result.duration).toBeCloseTo(7, 1);
    const a = await pixels(output, 1.2),
      b = await pixels(output, 3.5),
      reference = await pixels(source, 0.7);
    const center = 16 * 64 + 32;
    expect(Math.abs(a[center] - b[center])).toBeLessThan(3);
    expect(Math.abs(a[center] - reference[center])).toBeLessThan(4);
    expect((await audio(output, 2)).rms).toBeLessThan(30);
    expect((await audio(output, 4.5)).rms).toBeGreaterThan(500);
  }, 30000);
  it("片段镜像与九十度旋转同时进入成片变换", async () => {
    const { output } = await render("transform", [
      { id: "clip_001", start: 0, end: 1, transform: { angle: 90, flipX: true } }
    ]);
    const picture = await pixels(output, 0.1);
    // 水平梯度经镜像和顺时针旋转变成自上向下变暗。
    expect(picture[8 * 64 + 32]).toBeGreaterThan(picture[24 * 64 + 32] + 3);
    expect(picture[16 * 64 + 1]).toBeLessThan(5);
  }, 30000);
});
