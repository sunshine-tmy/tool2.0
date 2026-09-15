import { execFile } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import { analyzeVideoText, type VideoTextRecognitionQuality } from "@toolbox/shared/video-text";
import type { AppConfig } from "../../config";
import type { FileMetadataRepository } from "../../database/file-metadata";
import type { Task, TaskStore } from "../../tasks/task-store";
import { resultFilePath, type StoredVideoTextResult } from "./result-store";

const execFileAsync = promisify(execFile);

type VideoTextTaskSource = {
  stream: NodeJS.ReadableStream;
  fileName: string;
  mimeType: string;
  fileSize?: number;
};

export async function createVideoTextTaskFromSource(
  source: VideoTextTaskSource,
  context: {
    config: AppConfig;
    taskStore: TaskStore;
    results: Map<string, StoredVideoTextResult>;
    signal: AbortSignal;
    trackJob: (job: Promise<unknown>) => void;
    fileMetadata?: FileMetadataRepository;
  }
) {
  const { config, taskStore, results, signal, trackJob, fileMetadata } = context;
  const task = taskStore.create("video-text");
  taskStore.update(task.id, { status: "running", progress: 10 });
  const safeName = sanitizeDisplayFileName(source.fileName || "video.mp4");
  const extension = path
    .extname(safeName)
    .toLowerCase()
    .replace(/[^.a-z0-9]/g, "")
    .slice(0, 12);
  const videoPath = path.join(config.videoTextUploadsDir, `${task.id}${extension}`);

  try {
    await fsp.mkdir(config.videoTextUploadsDir, { recursive: true });
    await pipeline(source.stream, fs.createWriteStream(videoPath));
    const running = taskStore.update(task.id, { progress: 35 }) as Task;
    trackJob(
      processVideoTextTask({
        task,
        videoPath,
        safeName,
        mimeType: source.mimeType,
        config,
        taskStore,
        results,
        signal,
        fileMetadata
      })
    );
    return { task: running, result: null };
  } catch (error) {
    const failed = taskStore.update(task.id, {
      status: "failed",
      progress: 100,
      error: error instanceof Error ? error.message : "视频上传失败"
    }) as Task;
    await cleanupVideoTextWorkingFiles(config, task.id, videoPath);
    return { task: failed, result: null };
  }
}

async function processVideoTextTask(input: {
  task: Task;
  videoPath: string;
  safeName: string;
  mimeType: string;
  config: AppConfig;
  taskStore: TaskStore;
  results: Map<string, StoredVideoTextResult>;
  signal: AbortSignal;
  fileMetadata?: FileMetadataRepository;
}) {
  const { task, videoPath, safeName, mimeType, config, taskStore, results, signal, fileMetadata } = input;
  let terminalPatch: Parameters<TaskStore["update"]>[1];
  try {
    const hasTranscriber = Boolean(config.videoTextTranscribeCommand);
    const transcribed = await transcribeVideo(videoPath, task.id, config, signal);
    if (!transcribed.transcript.trim()) {
      terminalPatch = {
        status: "failed",
        progress: 100,
        error: hasTranscriber
          ? "未识别到视频语音文案，请确认视频包含清晰人声后再重试。"
          : "未配置视频语音识别命令，请配置本地识别后再分析。"
      };
    } else {
      taskStore.update(task.id, { progress: 70 });
      const result: StoredVideoTextResult = {
        id: task.id,
        fileName: safeName,
        fileSize: (await fsp.stat(videoPath)).size,
        mimeType,
        source: "transcriber",
        createdAt: new Date().toISOString(),
        ...analyzeVideoText({
          title: safeName,
          transcript: transcribed.transcript,
          recognitionQuality: transcribed.recognitionQuality
        })
      };
      results.set(task.id, result);
      const outputPath = resultFilePath(config, task.id);
      await fsp.writeFile(outputPath, JSON.stringify(result, null, 2), "utf8");
      await fileMetadata
        ?.registerIfExists({
          entityKind: "video-text-result",
          entityId: task.id,
          filePath: outputPath,
          mediaType: "application/json",
          owner: "local"
        })
        .catch(() => undefined);
      terminalPatch = {
        status: "completed",
        progress: 100,
        outputPath: path.basename(outputPath)
      };
    }
  } catch (error) {
    terminalPatch = {
      status: "failed",
      progress: 100,
      error: error instanceof Error ? error.message : "视频文本解析失败"
    };
  }
  try {
    await cleanupVideoTextWorkingFiles(config, task.id, videoPath);
  } catch (error) {
    terminalPatch = {
      status: "failed",
      progress: 100,
      error: error instanceof Error ? `视频临时文件清理失败：${error.message}` : "视频临时文件清理失败"
    };
  }
  return taskStore.update(task.id, terminalPatch) as Task;
}

async function transcribeVideo(videoPath: string, taskId: string, config: AppConfig, signal: AbortSignal) {
  if (!config.videoTextTranscribeCommand) return { transcript: "" };
  const audioPath = await extractAudio(videoPath, taskId, config, signal);
  const outputPath = path.join(config.videoTextResultsDir, `${taskId}.txt`);
  const { stdout } = await runCommand(
    config.videoTextTranscribeCommand,
    { input: audioPath, audio: audioPath, video: videoPath, output: outputPath },
    "视频语音识别失败：请检查 VIDEO_TEXT_TRANSCRIBE_COMMAND 配置。",
    signal
  );
  const recognitionQuality = await readRecognitionQuality(`${outputPath}.meta.json`);
  return {
    transcript: await fsp.readFile(outputPath, "utf8").catch(() => stdout),
    recognitionQuality
  };
}

async function cleanupVideoTextWorkingFiles(config: AppConfig, taskId: string, videoPath: string) {
  await Promise.all([
    fsp.rm(videoPath, { force: true }),
    fsp.rm(path.join(config.videoTextAudioDir, `${taskId}.wav`), { force: true }),
    fsp.rm(path.join(config.videoTextResultsDir, `${taskId}.txt`), { force: true }),
    fsp.rm(path.join(config.videoTextResultsDir, `${taskId}.txt.meta.json`), { force: true })
  ]);
}

async function readRecognitionQuality(metadataPath: string): Promise<VideoTextRecognitionQuality | undefined> {
  try {
    return sanitizeRecognitionQuality(
      JSON.parse(await fsp.readFile(metadataPath, "utf8")) as VideoTextRecognitionQuality
    );
  } catch {
    return undefined;
  }
}

function sanitizeRecognitionQuality(value: VideoTextRecognitionQuality): VideoTextRecognitionQuality {
  return {
    requestedModel: stringOrUndefined(value.requestedModel),
    model: stringOrUndefined(value.model),
    language: stringOrUndefined(value.language),
    detectedLanguage: stringOrUndefined(value.detectedLanguage),
    languageProbability: numberOrUndefined(value.languageProbability),
    device: stringOrUndefined(value.device),
    computeType: stringOrUndefined(value.computeType),
    averageLogProbability: numberOrUndefined(value.averageLogProbability),
    lowConfidenceSegments: Array.isArray(value.lowConfidenceSegments)
      ? value.lowConfidenceSegments.map((segment) => ({
          index: Number(segment.index) || 0,
          startSeconds: numberOrUndefined(segment.startSeconds),
          endSeconds: numberOrUndefined(segment.endSeconds),
          text: String(segment.text ?? ""),
          averageLogProbability: numberOrUndefined(segment.averageLogProbability),
          noSpeechProbability: numberOrUndefined(segment.noSpeechProbability)
        }))
      : []
  };
}

async function extractAudio(videoPath: string, taskId: string, config: AppConfig, signal: AbortSignal) {
  await fsp.mkdir(config.videoTextAudioDir, { recursive: true });
  const audioPath = path.join(config.videoTextAudioDir, `${taskId}.wav`);
  await runCommand(
    config.videoTextAudioExtractCommand,
    { input: videoPath, video: videoPath, output: audioPath, audio: audioPath },
    "音频提取失败：请确认已安装 ffmpeg，或配置 VIDEO_TEXT_AUDIO_EXTRACT_COMMAND。",
    signal
  );
  return audioPath;
}

async function runCommand(
  template: string,
  values: Record<string, string>,
  fallbackMessage: string,
  signal: AbortSignal
) {
  try {
    const command = parseCommandTemplate(template).map((argument) => replaceCommandPlaceholders(argument, values));
    const [executable, ...args] = command;
    if (!executable) throw new Error("Command is empty");
    return await execFileAsync(executable, args, {
      timeout: 30 * 60 * 1000,
      maxBuffer: 20 * 1024 * 1024,
      windowsHide: true,
      signal
    });
  } catch {
    throw new Error(fallbackMessage);
  }
}

function replaceCommandPlaceholders(argument: string, values: Record<string, string>) {
  let rendered = argument;
  for (const [key, value] of Object.entries(values)) rendered = rendered.replaceAll(`{${key}}`, value);
  if (/\{[A-Za-z][A-Za-z0-9_-]*\}/.test(rendered)) throw new Error("Command contains an unknown placeholder");
  return rendered;
}

function parseCommandTemplate(template: string) {
  const args: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  for (let index = 0; index < template.length; index += 1) {
    const character = template[index];
    if (quote) {
      if (character === quote) quote = null;
      else if (character === "\\" && template[index + 1] === quote) {
        current += quote;
        index += 1;
      } else current += character;
    } else if (character === '"' || character === "'") quote = character;
    else if (/\s/.test(character)) {
      if (current) {
        args.push(current);
        current = "";
      }
    } else current += character;
  }
  if (quote) throw new Error("Command contains an unterminated quote");
  if (current) args.push(current);
  return args;
}

function sanitizeDisplayFileName(value: string) {
  const name = Array.from(path.basename(value))
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint >= 32 && codePoint !== 127;
    })
    .join("")
    .trim()
    .slice(0, 255);
  return name || "video.mp4";
}

function stringOrUndefined(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberOrUndefined(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
