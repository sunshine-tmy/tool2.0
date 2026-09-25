/** 中文模块说明：从固定 Hugging Face 提交准备离线 faster-whisper-small 模型目录。 */
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const WHISPER_SMALL_REVISION = "536b0662742c02347bc0e980a01041f333bce120";
export const WHISPER_SMALL_FILES = ["config.json", "model.bin", "tokenizer.json", "vocabulary.txt"];
const MAX_MODEL_BYTES = 600_000_000;

export async function prepareWhisperSmallModel({ stagingDirectory }) {
  const stage = path.resolve(stagingDirectory);
  if (await pathExists(stage)) throw new Error("Whisper 模型暂存目录已存在，拒绝覆盖");
  let stageCreated = false;
  try {
    await fs.mkdir(stage, { recursive: false });
    stageCreated = true;
    const modelDirectory = path.join(stage, "model");
    await fs.mkdir(modelDirectory);
    const downloader = path.join(REPOSITORY_ROOT, "scripts", "download-fixed-model-file.ps1");
    const baseUrl = `https://huggingface.co/Systran/faster-whisper-small/resolve/${WHISPER_SMALL_REVISION}`;
    for (const file of WHISPER_SMALL_FILES) {
      execFileSync(
        "pwsh",
        [
          "-NoProfile",
          "-File",
          downloader,
          "-Url",
          `${baseUrl}/${file}`,
          "-Destination",
          path.join(modelDirectory, file)
        ],
        { stdio: "inherit", windowsHide: true, timeout: 60 * 60 * 1000 }
      );
    }
    const config = JSON.parse(await fs.readFile(path.join(modelDirectory, "config.json"), "utf8"));
    const modelBytes = (await fs.stat(path.join(modelDirectory, "model.bin"))).size;
    if (
      !Array.isArray(config.alignment_heads) ||
      config.alignment_heads.length === 0 ||
      !config.lang_ids ||
      Object.keys(config.lang_ids).length < 90 ||
      modelBytes < 450_000_000 ||
      modelBytes > 550_000_000
    ) {
      throw new Error("下载的 Whisper 模型结构或模型权重无效");
    }
    const totalBytes = (
      await Promise.all(WHISPER_SMALL_FILES.map((file) => fs.stat(path.join(modelDirectory, file))))
    ).reduce((total, stat) => total + stat.size, 0);
    if (totalBytes > MAX_MODEL_BYTES) throw new Error("Whisper small 模型超出固定大小上限");
    return { stagingDirectory: stage, revision: WHISPER_SMALL_REVISION, totalBytes };
  } catch (error) {
    if (stageCreated) await fs.rm(stage, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

function pathExists(candidate) {
  return fs.lstat(candidate).then(
    () => true,
    (error) => {
      if (error?.code === "ENOENT") return false;
      throw error;
    }
  );
}

function parseArguments(argv) {
  if (argv.length !== 2 || argv[0] !== "--stage" || !argv[1]) {
    throw new Error("用法：pnpm components:prepare-whisper-small -- --stage <新暂存目录>");
  }
  return { stagingDirectory: argv[1] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await prepareWhisperSmallModel(parseArguments(process.argv.slice(2)));
    console.log(`Whisper small 暂存目录已准备：${result.stagingDirectory}`);
    console.log(`上游固定提交：${result.revision}；模型文件共 ${result.totalBytes} bytes`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Whisper 模型准备失败");
    process.exitCode = 1;
  }
}
