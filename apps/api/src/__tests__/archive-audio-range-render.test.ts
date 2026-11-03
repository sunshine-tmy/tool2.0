import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { defaultArchiveAudioSettings } from "@toolbox/shared";
import { probeMedia, renderArchiveVideo, runMediaProcess } from "../domains/content-archive/video-edit/renderer";
const tools = { ffmpeg: process.env.TEST_FFMPEG_PATH ?? "ffmpeg", ffprobe: process.env.TEST_FFPROBE_PATH ?? "ffprobe" };
const available = [tools.ffmpeg, tools.ffprobe].every(
  (tool) => spawnSync(tool, ["-version"], { windowsHide: true, stdio: "ignore" }).status === 0
);
describe.skipIf(!available)("real full-length music range rendering with synthetic media", () => {
  let root: string, source: string, music: string;
  const signal = () => new AbortController().signal;
  beforeAll(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-audio-range-"));
    source = path.join(root, "video.mp4");
    music = path.join(root, "music.flac");
    await runMediaProcess(
      tools.ffmpeg,
      [
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "color=c=black:s=64x64:r=5:d=20",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-y",
        source
      ],
      signal()
    );
    await runMediaProcess(
      tools.ffmpeg,
      [
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:duration=12",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=880:duration=24",
        "-filter_complex",
        "[0:a][1:a]concat=n=2:v=0:a=1[a]",
        "-map",
        "[a]",
        "-c:a",
        "flac",
        "-y",
        music
      ],
      signal()
    );
  });
  afterAll(async () => {
    if (root && path.dirname(root) === os.tmpdir() && path.basename(root).startsWith("toolbox-audio-range-"))
      await fs.rm(root, { recursive: true, force: true });
  });
  const settings = () => ({
    ...defaultArchiveAudioSettings(),
    originalVolume: 0,
    musicVolume: 100,
    musicStartSeconds: 14,
    fadeInSeconds: 0,
    fadeOutSeconds: 0,
    loop: false
  });
  async function audio(file: string, time: number) {
    const pcm = path.join(root, `sample-${Math.random().toString(36).slice(2)}.pcm`);
    await runMediaProcess(
      tools.ffmpeg,
      [
        "-v",
        "error",
        "-ss",
        String(time),
        "-i",
        file,
        "-t",
        "1",
        "-vn",
        "-ac",
        "1",
        "-ar",
        "8000",
        "-f",
        "s16le",
        "-y",
        pcm
      ],
      signal()
    );
    const bytes = await fs.readFile(pcm);
    const samples = Array.from({ length: bytes.length / 2 }, (_, i) => bytes.readInt16LE(i * 2));
    const rms = Math.sqrt(samples.reduce((n, v) => n + v * v, 0) / samples.length);
    const frequency = samples.slice(1).filter((n, i) => n >= 0 && samples[i] < 0).length / (samples.length / 8000);
    return { rms, frequency };
  }
  it("full audition and save both use the dragged source range and preserve the entire 20-second video", async () => {
    const original = await fs.readFile(source);
    for (const preview of [true, false]) {
      const output = path.join(root, `full-${preview}.mp4`);
      const result = await renderArchiveVideo({
        tools,
        source,
        music,
        output,
        settings: settings(),
        signal: signal(),
        maxBytes: 20 * 1024 ** 2,
        preview,
        previewFullLength: true,
        previewStartSeconds: 7,
        onProgress: () => undefined
      });
      expect(result.duration).toBeCloseTo(20, 0);
      expect((await audio(output, 1)).frequency).toBeGreaterThan(850);
      expect((await audio(output, 18)).rms).toBeGreaterThan(500);
    }
    expect(await fs.readFile(source)).toEqual(original);
  }, 30000);
  it("keeps old short-preview requests compatible with the 15-second limit", async () => {
    const output = path.join(root, "short.mp4");
    await renderArchiveVideo({
      tools,
      source,
      music,
      output,
      settings: settings(),
      signal: signal(),
      maxBytes: 20 * 1024 ** 2,
      preview: true,
      previewStartSeconds: 2,
      onProgress: () => undefined
    });
    expect((await probeMedia(tools, output, signal())).duration).toBeCloseTo(15, 0);
  }, 30000);
  it("preserves loop and silence behavior when the music is shorter than the video", async () => {
    const short = path.join(root, "short.flac");
    await runMediaProcess(tools.ffmpeg, ["-v", "error", "-i", music, "-t", "5", "-c:a", "flac", "-y", short], signal());
    for (const loop of [true, false]) {
      const output = path.join(root, `loop-${loop}.mp4`);
      const result = await renderArchiveVideo({
        tools,
        source,
        music: short,
        output,
        settings: { ...settings(), musicStartSeconds: 0, loop },
        signal: signal(),
        maxBytes: 20 * 1024 ** 2,
        preview: true,
        previewFullLength: true,
        onProgress: () => undefined
      });
      expect(result.duration).toBeCloseTo(20, 0);
      const tail = await audio(output, 17);
      expect(loop ? tail.rms > 500 : tail.rms < 5).toBe(true);
    }
  }, 30000);
});
