/** 在线模式只依赖可信的媒体能力，不依赖 Chatterbox 模型或运行时。 */
import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AppConfig } from "../../config";
import { replaceFile } from "../chatterbox/batch-artifacts";
const execute = promisify(execFile);
export async function combineOnlineAudio(config: AppConfig, inputs: string[], target: string) {
  if (!inputs.length) throw new Error("没有可合并的在线配音");
  const temporary = `${target}.tmp.mp3`;
  if (inputs.length === 1) await fs.copyFile(inputs[0], temporary);
  else {
    if (!config.edgeTtsFfmpegPath) throw new Error("请安装 FFmpeg 能力以合并批次音频");
    const streams = inputs.map((_, index) => `[${index}:a:0]`).join("");
    await execute(
      config.edgeTtsFfmpegPath,
      [
        "-y",
        "-v",
        "error",
        ...inputs.flatMap((input) => ["-i", input]),
        "-filter_complex",
        `${streams}concat=n=${inputs.length}:v=0:a=1[out]`,
        "-map",
        "[out]",
        "-codec:a",
        "libmp3lame",
        "-b:a",
        "192k",
        temporary
      ],
      { timeout: 300000, windowsHide: true, maxBuffer: 1024 * 1024 }
    );
  }
  const handle = await fs.open(temporary, "r");
  try {
    const header = Buffer.alloc(3),
      result = await handle.read(header, 0, 3, 0);
    if (
      result.bytesRead < 2 ||
      !(header.toString("ascii") === "ID3" || (header[0] === 0xff && (header[1] & 0xe0) === 0xe0))
    )
      throw new Error("在线配音合并产物不是有效 MP3");
  } finally {
    await handle.close();
  }
  await replaceFile(temporary, target);
}
