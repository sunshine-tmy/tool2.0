import fsp from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { WORKER_PROTOCOL_VERSION, type EdgeTtsTask, type EdgeTtsVoice } from "@toolbox/shared";
import type { AppConfig } from "../../config";
import { commitStagedFile } from "../../storage/file-commit-gateway";
import type { RuntimeInfo, TaskPaths } from "./types";

const execFileAsync = promisify(execFile);

export class EdgeTtsWorkerGateway {
  constructor(private readonly config: AppConfig) {}

  async check(): Promise<RuntimeInfo> {
    try {
      await Promise.all([fsp.access(this.config.edgeTtsPythonPath), fsp.access(this.config.edgeTtsScriptPath)]);
      const result = await this.execute([this.config.edgeTtsScriptPath, "check"], 15_000);
      return {
        available: result.available === true,
        version: typeof result.version === "string" ? result.version : undefined,
        message: result.available === true ? "Edge-TTS 已就绪" : "Edge-TTS 运行环境不可用"
      };
    } catch {
      return {
        available: false,
        message: "Edge-TTS 尚未安装，请运行 scripts/setup-edge-tts.ps1"
      };
    }
  }

  async listVoices(): Promise<EdgeTtsVoice[]> {
    const result = await this.execute([this.config.edgeTtsScriptPath, "voices"], 30_000);
    if (!Array.isArray(result.voices)) throw new Error("Invalid voice list response");
    return result.voices.filter(isVoice).map((voice) => ({ ...voice, suggested: false }));
  }

  async generate(task: EdgeTtsTask, paths: TaskPaths, signal: AbortSignal) {
    await Promise.all([
      fsp.rm(paths.audioTemp, { force: true }),
      fsp.rm(paths.subtitleTemp, { force: true }),
      fsp.rm(paths.audio, { force: true }),
      fsp.rm(paths.subtitle, { force: true })
    ]);
    const args = [this.config.edgeTtsScriptPath, "generate", "--input", paths.request, "--audio", paths.audioTemp];
    if (task.includeSubtitles) args.push("--subtitle", paths.subtitleTemp);
    const result = await this.execute(args, this.config.edgeTtsTimeoutMs, signal);
    const stat = await fsp.stat(paths.audioTemp);
    if (!stat.isFile() || stat.size <= 0 || !(await isMp3File(paths.audioTemp))) {
      throw new Error("生成结果不是有效的 MP3 文件");
    }
    await commitStagedFile(paths.audioTemp, paths.audio);
    if (task.includeSubtitles) {
      await fsp.access(paths.subtitleTemp);
      await commitStagedFile(paths.subtitleTemp, paths.subtitle);
    }
    return {
      audioBytes: typeof result.audioBytes === "number" ? result.audioBytes : stat.size
    };
  }

  private async execute(args: string[], timeout: number, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await execFileAsync(this.config.edgeTtsPythonPath, args, {
      timeout,
      signal,
      windowsHide: true,
      maxBuffer: 5 * 1024 * 1024,
      encoding: "utf8"
    });
    const stdout = String(result.stdout).trim();
    if (!stdout) throw new Error("Edge-TTS returned an empty response");
    const parsed: unknown = JSON.parse(stdout);
    if (!isRecord(parsed)) throw new Error("Edge-TTS returned a non-object response");
    if (parsed.protocolVersion !== WORKER_PROTOCOL_VERSION) {
      throw new Error("Edge-TTS Worker protocol version mismatch");
    }
    return parsed;
  }
}

function isVoice(value: unknown): value is Omit<EdgeTtsVoice, "suggested"> {
  if (!isRecord(value)) return false;
  return (
    typeof value.name === "string" &&
    typeof value.shortName === "string" &&
    typeof value.locale === "string" &&
    (value.gender === "Female" || value.gender === "Male" || value.gender === "Neutral")
  );
}

async function isMp3File(filePath: string) {
  const handle = await fsp.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(3);
    const { bytesRead } = await handle.read(buffer, 0, 3, 0);
    if (bytesRead < 2) return false;
    return buffer.toString("ascii", 0, 3) === "ID3" || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
  } finally {
    await handle.close();
  }
}

export function readableRunnerError(error: unknown) {
  if (isRecord(error) && typeof error.stderr === "string" && error.stderr.trim()) {
    return `语音生成失败：${error.stderr.trim().slice(0, 300)}`;
  }
  if (error instanceof Error && error.name === "AbortError") return "任务已取消";
  if (error instanceof Error && /timed out|ETIMEDOUT/i.test(error.message)) return "语音生成超时，请缩短文本后重试";
  return `语音生成失败：${error instanceof Error ? error.message.slice(0, 300) : "未知错误"}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
