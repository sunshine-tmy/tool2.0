import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  archiveWatermarkPosition,
  archiveWatermarkSize,
  defaultArchiveAudioSettings,
  defaultArchiveWatermarkSettings,
  type ArchiveWatermarkSettings
} from "@toolbox/shared";
import { renderArchiveVideo, runMediaProcess } from "../domains/content-archive/video-edit/renderer";
const tools = { ffmpeg: process.env.TEST_FFMPEG_PATH ?? "ffmpeg", ffprobe: process.env.TEST_FFPROBE_PATH ?? "ffprobe" };
const available = [tools.ffmpeg, tools.ffprobe].every(
  (tool) => spawnSync(tool, ["-version"], { windowsHide: true, stdio: "ignore" }).status === 0
);
describe.skipIf(!available)("真实 FFmpeg 合成视频水印回归（不使用业务数据）", () => {
  let root: string, source: string, logo: string;
  beforeAll(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-watermark-render-"));
    source = path.join(root, "中文 原片.mp4");
    logo = path.join(root, "透明 logo.png");
    await sharp({ create: { width: 32, height: 16, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0.5 } } })
      .png()
      .toFile(logo);
    await runMediaProcess(
      tools.ffmpeg,
      [
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "color=c=black:s=128x96:r=10:d=3",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:duration=3",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-y",
        source
      ],
      new AbortController().signal
    );
  });
  afterAll(async () => {
    if (root && path.dirname(root) === os.tmpdir() && path.basename(root).startsWith("toolbox-watermark-render-"))
      await fs.rm(root, { recursive: true, force: true });
  });
  async function render(settings: ArchiveWatermarkSettings, previewStartSeconds?: number) {
    const output = path.join(root, `成品-${Math.random().toString(36).slice(2)}.mp4`);
    await renderArchiveVideo({
      tools,
      source,
      output,
      settings: defaultArchiveAudioSettings(),
      watermark: { file: logo, width: 32, height: 16, settings },
      signal: new AbortController().signal,
      maxBytes: 10 * 1024 * 1024,
      preview: previewStartSeconds !== undefined,
      previewStartSeconds,
      onProgress: () => undefined
    });
    return output;
  }
  async function frame(file: string, time: number) {
    const image = path.join(root, `frame-${Math.random().toString(36).slice(2)}.png`);
    await runMediaProcess(
      tools.ffmpeg,
      ["-v", "error", "-i", file, "-ss", String(time), "-frames:v", "1", "-y", image],
      new AbortController().signal
    );
    return sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  }
  async function bounds(file: string, time: number) {
    const { data, info } = await frame(file, time);
    const xs: number[] = [],
      ys: number[] = [],
      reds: number[] = [];
    for (let y = 0; y < info.height; y++)
      for (let x = 0; x < info.width; x++) {
        const index = (y * info.width + x) * info.channels;
        if (data[index] > 35 && data[index + 1] < 25 && data[index + 2] < 25) {
          xs.push(x);
          ys.push(y);
          reds.push(data[index]);
        }
      }
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      count: xs.length,
      red: reds.reduce((a, b) => a + b, 0) / reds.length
    };
  }
  it("固定水印的透明度与原始 alpha 相乘，输出位置尺寸正确，原片不改写", async () => {
    const settings = defaultArchiveWatermarkSettings();
    settings.opacity = 50;
    settings.widthPercent = 25;
    settings.motion.from = { x: 0, y: 0 };
    const original = await fs.readFile(source);
    const file = await render(settings),
      value = await bounds(file, 1);
    expect(value.x).toBeLessThanOrEqual(2);
    expect(value.y).toBeLessThanOrEqual(2);
    expect(value.count).toBeGreaterThan(400);
    expect(value.count).toBeLessThan(600);
    expect(value.red).toBeGreaterThan(45);
    expect(value.red).toBeLessThan(85);
    expect(await fs.readFile(source)).toEqual(original);
  });
  it.each(["linear", "ping-pong", "bounce", "keyframes"])(
    "%s 轨迹输出帧与共享位置算法一致，预览中途不重置",
    async (type) => {
      const settings = defaultArchiveWatermarkSettings();
      settings.widthPercent = 25;
      settings.opacity = 100;
      settings.motion.type = type;
      settings.motion.from = { x: 0.1, y: 0.2 };
      settings.motion.to = { x: 0.9, y: 0.8 };
      settings.motion.periodSeconds = 2;
      settings.motion.keyframes = [
        { timeSeconds: 0, x: 0.1, y: 0.2 },
        { timeSeconds: 2, x: 0.9, y: 0.8 }
      ];
      const full = await render(settings),
        preview = await render(settings, 1);
      const size = archiveWatermarkSize(settings, { width: 32, height: 16 }, { width: 128, height: 96 });
      for (const time of [0.5, 1.5, 2.5]) {
        const point = archiveWatermarkPosition(settings, time),
          actual = await bounds(full, time);
        expect(Math.abs(actual.x - (128 - size.width) * point.x)).toBeLessThanOrEqual(3);
        expect(Math.abs(actual.y - (96 - size.height) * point.y)).toBeLessThanOrEqual(3);
      }
      const a = await bounds(full, 1.5),
        b = await bounds(preview, 0.5);
      expect(Math.abs(a.x - b.x)).toBeLessThanOrEqual(3);
      expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(3);
    }
  );
  it("显示时间外没有水印，无水印保留快速路径，非法时间不生成成品", async () => {
    const settings = defaultArchiveWatermarkSettings();
    settings.startSeconds = 1;
    settings.endSeconds = 2;
    const output = await render(settings);
    expect((await bounds(output, 0.5)).count).toBe(0);
    expect((await bounds(output, 1.5)).count).toBeGreaterThan(0);
    expect((await bounds(output, 2.5)).count).toBe(0);
    await expect(render({ ...settings, endSeconds: 0.5 })).rejects.toMatchObject({
      code: "ARCHIVE_WATERMARK_TIME_INVALID"
    });
    const plain = path.join(root, "plain.mp4");
    await renderArchiveVideo({
      tools,
      source,
      output: plain,
      settings: defaultArchiveAudioSettings(),
      signal: new AbortController().signal,
      maxBytes: 10 * 1024 * 1024,
      onProgress: () => undefined
    });
    expect((await bounds(plain, 1)).count).toBe(0);
  });
  it.each(["z", "zigzag", "cross", "staggered", "polygon", "random"] as const)(
    "新增 %s 反弹轨迹的导出帧和中途预览与客户端位置一致",
    async (style) => {
      const settings = defaultArchiveWatermarkSettings();
      settings.widthPercent = 25;
      settings.opacity = 100;
      settings.motion.type = "bounce";
      settings.motion.bounceStyle = style;
      settings.motion.bounceSeed = 12345;
      settings.motion.periodSeconds = 2;
      settings.motion.from = { x: 0, y: 0 };
      settings.motion.directionX = 1;
      settings.motion.directionY = 1;
      const full = await render(settings),
        preview = await render(settings, 1);
      for (const time of [0.3, 0.7, 1.5, 2.5]) {
        const point = archiveWatermarkPosition(settings, time),
          actual = await bounds(full, time);
        expect(Math.abs(actual.x - 96 * point.x)).toBeLessThanOrEqual(3);
        expect(Math.abs(actual.y - 80 * point.y)).toBeLessThanOrEqual(3);
      }
      const whole = await bounds(full, 1.5),
        partial = await bounds(preview, 0.5);
      expect(Math.abs(whole.x - partial.x)).toBeLessThanOrEqual(3);
      expect(Math.abs(whole.y - partial.y)).toBeLessThanOrEqual(3);
    }
  );
  it("旋转竖屏、无音轨和配乐同时叠加均可生成有效视频", async () => {
    const settings = defaultArchiveWatermarkSettings();
    for (const variant of ["rotated", "silent", "music"]) {
      const input = path.join(root, `${variant}.mp4`),
        output = path.join(root, `${variant}-result.mp4`);
      await runMediaProcess(
        tools.ffmpeg,
        [
          "-v",
          "error",
          ...(variant === "rotated" ? ["-display_rotation:v:0", "90"] : []),
          "-i",
          source,
          "-c",
          "copy",
          ...(variant === "silent" ? ["-an"] : []),
          "-y",
          input
        ],
        new AbortController().signal
      );
      const result = await renderArchiveVideo({
        tools,
        source: input,
        music: variant === "music" ? source : undefined,
        output,
        settings: defaultArchiveAudioSettings(),
        watermark: { file: logo, width: 32, height: 16, settings },
        signal: new AbortController().signal,
        maxBytes: 10 * 1024 * 1024,
        onProgress: () => undefined
      });
      expect(result.hasAudio).toBe(true);
      expect(result.duration).toBeCloseTo(3, 1);
      const probe = async (file: string) =>
        runMediaProcess(
          tools.ffprobe,
          [
            "-v",
            "error",
            "-show_entries",
            "stream=width,height:stream_tags=rotate:stream_side_data=rotation",
            "-of",
            "json",
            file
          ],
          new AbortController().signal
        );
      expect(
        [result.width, result.height],
        JSON.stringify({ input: await probe(input), output: await probe(output) })
      ).toEqual(variant === "rotated" ? [96, 128] : [128, 96]);
      expect((await bounds(output, 1)).count).toBeGreaterThan(0);
      if (variant === "rotated") {
        const unchanged = await renderArchiveVideo({
          tools,
          source: input,
          output: path.join(root, "rotated-audio-only.mp4"),
          settings: defaultArchiveAudioSettings(),
          signal: new AbortController().signal,
          maxBytes: 10 * 1024 * 1024,
          onProgress: () => undefined
        });
        expect([unchanged.width, unchanged.height]).toEqual([128, 96]);
      }
    }
  });
});
