/** 已有 FFmpeg 可用时生成合成曲目，验证下载文件没有扩展名时仍可识别；不下载运行时。 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inspectArchiveSoundtrack } from "../domains/content-archive/core/soundtrack";
import { runMediaProcess } from "../domains/content-archive/video-edit/renderer";
import { soundtrackWav } from "./helpers/soundtrack";

const ffmpeg = process.env.TEST_FFMPEG_PATH ?? "ffmpeg";
const available = spawnSync(ffmpeg, ["-version"], { windowsHide: true, stdio: "ignore" }).status === 0;
describe.skipIf(!available)("真实音频格式识别（仅合成文件，无业务数据）", () => {
  let root: string, source: string;
  beforeAll(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-soundtrack-"));
    source = path.join(root, "source.wav");
    await fs.writeFile(source, soundtrackWav());
  });
  afterAll(async () => {
    if (path.dirname(root) !== os.tmpdir() || !path.basename(root).startsWith("toolbox-soundtrack-"))
      throw new Error("清理目录越界");
    await fs.rm(root, { recursive: true, force: true });
  });
  it.each([
    ["mp3", "libmp3lame", "mp3", "audio/mpeg"],
    ["m4a", "aac", "m4a", "audio/mp4"],
    ["aac", "aac", "aac", "audio/aac"],
    ["flac", "flac", "flac", "audio/flac"],
    ["ogg", "libvorbis", "ogg", "audio/ogg"],
    ["opus", "libopus", "ogg", "audio/ogg"]
  ])("%s 曲目经实际编码后按内容识别，并可立即移动归档", async (suffix, codec, extension, mimeType) => {
    const output = path.join(root, `encoded.${suffix}`),
      temporary = path.join(root, `${suffix}.downloading`);
    await runMediaProcess(
      ffmpeg,
      ["-v", "error", "-i", source, "-ar", "48000", "-c:a", codec, "-y", output],
      new AbortController().signal
    );
    await fs.rename(output, temporary);
    const inspected = await inspectArchiveSoundtrack(temporary);
    expect(inspected).toMatchObject({ extension, mimeType });
    // 原始 ADTS 的元数据时长可能是估算值；格式识别不冒充逐帧播放时长检测。
    expect(inspected.durationMs).toBeGreaterThan(0);
    expect(inspected.durationMs).toBeLessThan(2000);
    await fs.rename(temporary, path.join(root, `committed-${suffix}.${extension}`));
  });
  it("不接受带视频轨的 MP4 冒充配乐附件", async () => {
    const output = path.join(root, "video.mp4");
    await runMediaProcess(
      ffmpeg,
      [
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "color=c=black:s=16x16:r=10:d=1",
        "-i",
        source,
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        "-y",
        output
      ],
      new AbortController().signal
    );
    await expect(inspectArchiveSoundtrack(output)).rejects.toThrow("ARCHIVE_SOUNDTRACK_VIDEO_TRACK");
  });
});
