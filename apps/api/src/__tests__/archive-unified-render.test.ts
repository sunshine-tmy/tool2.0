import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { spawnSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  defaultArchiveAudioSettings,
  defaultArchiveStudio,
  defaultArchiveWatermarkSettings,
  type ArchiveCutClip,
  type ArchiveStudio,
  type ArchiveStudioWatermark
} from "@toolbox/shared";
import { renderArchiveVideo, runMediaProcess } from "../domains/content-archive/video-edit/renderer";
const tools = { ffmpeg: process.env.TEST_FFMPEG_PATH ?? "ffmpeg", ffprobe: process.env.TEST_FFPROBE_PATH ?? "ffprobe" };
const available = Object.values(tools).every(
  (tool) => spawnSync(tool, ["-version"], { windowsHide: true, stdio: "ignore" }).status === 0
);
describe.skipIf(!available)("统一工程真实 FFmpeg 合成", () => {
  let root: string, source: string, logo: string;
  const signal = () => new AbortController().signal;
  beforeAll(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-unified-render-"));
    source = path.join(root, "source.mkv");
    logo = path.join(root, "logo.png");
    await sharp({ create: { width: 32, height: 32, channels: 4, background: "red" } })
      .png()
      .toFile(logo);
    await runMediaProcess(
      tools.ffmpeg,
      [
        "-v",
        "error",
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=black:s=64x64:r=10:d=2",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=400:sample_rate=48000:duration=2",
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
    if (root && path.dirname(root) === os.tmpdir() && path.basename(root).startsWith("toolbox-unified-render-"))
      await fs.rm(root, { recursive: true, force: true });
  });
  const mark = (): ArchiveStudioWatermark => ({
    id: "mark_0001",
    title: "红水印",
    start: 0,
    end: 2,
    sourceStart: 0,
    lane: 0,
    asset: { id: "asset_001", kind: "saved" as const, width: 32, height: 32 },
    settings: {
      ...defaultArchiveWatermarkSettings(),
      widthPercent: 50,
      opacity: 100,
      motion: { ...defaultArchiveWatermarkSettings().motion, type: "fixed" as const, from: { x: 0.5, y: 0.5 } }
    }
  });
  async function render(
    name: string,
    studio: ArchiveStudio,
    cut: ArchiveCutClip[] = [{ id: "video_001", start: 0, end: 2, lane: 2 }]
  ) {
    const output = path.join(root, name + ".mp4");
    await renderArchiveVideo({
      tools,
      source,
      outputSettings: {},
      output,
      cut,
      studio,
      watermarkFiles: { asset_001: { file: logo, width: 32, height: 32 } },
      trackFiles: { music_001: source },
      settings: { ...defaultArchiveAudioSettings(), musicVolume: 0 },
      signal: signal(),
      maxBytes: 64 * 1024 ** 2,
      onProgress: () => {}
    });
    return output;
  }
  async function pixels(file: string, time: number) {
    const raw = path.join(root, "pixels.rgb");
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
        "rgb24",
        "-f",
        "rawvideo",
        raw
      ],
      signal()
    );
    return fs.readFile(raw);
  }
  it("水印服从视频遮挡，视频结束后的空隙中继续显示", async () => {
    const output = await render(
      "occlusion",
      { ...defaultArchiveStudio(), unified: true, watermarks: [{ ...mark(), lane: 2 }] },
      [{ id: "video_001", start: 0, end: 1, at: 0, lane: 0 }]
    );
    const middle = (32 * 64 + 32) * 3;
    expect((await pixels(output, 0.5))[middle]).toBeLessThan(20);
    expect((await pixels(output, 1.5))[middle]).toBeGreaterThan(210);
  }, 30000);
  it("多水印、文本和配乐输入索引正确，文本与水印上下层可互换", async () => {
    const text = {
      id: "text_001",
      text: "HI",
      start: 0,
      end: 2,
      fontSize: 200,
      bold: true,
      color: "#ffffff",
      position: "center" as const,
      x: 0.5,
      y: 0.5,
      outlineWidth: 0,
      lane: 0
    };
    const studio: ArchiveStudio = {
      ...defaultArchiveStudio(),
      unified: true,
      subtitles: [text],
      watermarks: [
        { ...mark(), lane: 1 },
        { ...mark(), id: "mark_0002", lane: 4, hidden: true }
      ],
      musicTracks: [
        {
          id: "music_001",
          title: "音乐",
          libraryItemId: "library_001",
          libraryRevision: 1,
          start: 0,
          end: 2,
          sourceStart: 0,
          volume: 50,
          loop: false,
          fadeIn: 0,
          fadeOut: 0,
          lane: 3
        }
      ]
    };
    const above = await render("text-above", studio),
      a = await pixels(above, 0.5);
    studio.subtitles[0].lane = 1;
    studio.watermarks![0].lane = 0;
    const below = await render("image-above", studio),
      b = await pixels(below, 0.5);
    const white = (bytes: Buffer) => {
      let n = 0;
      for (let i = 0; i < bytes.length; i += 3) if (bytes[i] > 200 && bytes[i + 1] > 200 && bytes[i + 2] > 200) n++;
      return n;
    };
    expect(white(a)).toBeGreaterThan(10);
    expect(white(b)).toBeLessThan(white(a));
    expect((await fs.readdir(root)).some((name) => name.endsWith(".ass") || name.endsWith(".filters.txt"))).toBe(false);
  }, 30000);
  it("左裁剪后的运动时钟延续，旋转与不透明度进入成片", async () => {
    const original = mark();
    original.settings.motion.type = "linear";
    original.settings.motion.from = { x: 0, y: 0.5 };
    original.settings.motion.to = { x: 1, y: 0.5 };
    original.settings.motion.periodSeconds = 2;
    const output = await render("motion", {
      ...defaultArchiveStudio(),
      unified: true,
      watermarks: [
        {
          ...original,
          start: 0.5,
          sourceStart: 0.5,
          offsetX: 0.1,
          angle: 45,
          settings: { ...original.settings, opacity: 50 }
        }
      ]
    });
    const frame = await pixels(output, 1),
      center = (32 * 64 + 32) * 3;
    expect(frame[center]).toBeGreaterThan(90);
    expect(frame[center]).toBeLessThan(170);
    expect(frame[center + 1]).toBeLessThan(20);
    expect(frame[(32 * 64 + 11) * 3]).toBeLessThan(20);
  }, 30000);
});
