import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import type { FastifyInstance } from "fastify";
import { fail, ok } from "@toolbox/shared";
import {
  analyzeVideoText,
  type VideoTextAnalysis,
  type VideoTextRecognitionQuality
} from "@toolbox/shared/video-text";
import type { AppConfig } from "../config";
import type { Task, TaskStore } from "../tasks/task-store";

const execAsync = promisify(exec);

type RegisterVideoTextRoutesOptions = {
  app: FastifyInstance;
  config: AppConfig;
  taskStore: TaskStore;
};

type StoredVideoTextResult = VideoTextAnalysis & {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  source: "form-text" | "transcriber";
  createdAt: string;
};

type VideoTextHistoryItem = Pick<
  StoredVideoTextResult,
  "id" | "fileName" | "fileSize" | "mimeType" | "source" | "createdAt"
> & {
  summary: string[];
  textPreview: string;
  characterCount: number;
};

type VideoTextTaskSource = {
  stream: NodeJS.ReadableStream;
  fileName: string;
  mimeType: string;
  fileSize?: number;
};

export async function registerVideoTextRoutes({ app, config, taskStore }: RegisterVideoTextRoutesOptions) {
  const results = new Map<string, StoredVideoTextResult>();
  await fsp.mkdir(config.videoTextUploadsDir, { recursive: true });
  await fsp.mkdir(config.videoTextAudioDir, { recursive: true });
  await fsp.mkdir(config.videoTextResultsDir, { recursive: true });

  app.post("/api/tools/video-text/tasks", async (request, reply) => {
    const file = await request.file();
    if (!file) {
      return reply.code(400).send(fail("FILE_REQUIRED", "Please upload a video file"));
    }

    if (!file.mimetype.startsWith("video/")) {
      return reply.code(400).send(fail("VIDEO_REQUIRED", "Please upload a supported video file"));
    }

    return ok(
      await createVideoTextTaskFromSource(
        {
          stream: file.file,
          fileName: file.filename || "video.mp4",
          mimeType: file.mimetype
        },
        { config, taskStore, results }
      )
    );
  });

  app.post("/api/tools/video-text/tasks/from-url", async (request, reply) => {
    const body = request.body as { url?: string; fileName?: string } | undefined;
    const sourceUrl = typeof body?.url === "string" ? body.url.trim() : "";

    if (!isHttpUrl(sourceUrl)) {
      return reply.code(400).send(fail("INVALID_VIDEO_URL", "请输入有效的视频地址"));
    }

    try {
      const response = await fetchRemoteVideo(sourceUrl);

      if (!response.ok || !response.body) {
        return reply.code(502).send(fail("VIDEO_DOWNLOAD_FAILED", `视频下载失败：${response.status}`));
      }

      const mimeType = normalizeVideoMimeType(response.headers.get("content-type"));
      const fileName = body?.fileName || fileNameFromUrl(sourceUrl);

      return ok(
        await createVideoTextTaskFromSource(
          {
            stream: Readable.fromWeb(response.body as unknown as NodeReadableStream<Uint8Array>),
            fileName,
            mimeType,
            fileSize: parseContentLength(response.headers.get("content-length"))
          },
          { config, taskStore, results }
        )
      );
    } catch (error) {
      return reply
        .code(502)
        .send(fail("VIDEO_DOWNLOAD_FAILED", error instanceof Error ? error.message : "视频下载失败"));
    }
  });

  app.get("/api/tools/video-text/remote-video", async (request, reply) => {
    const query = request.query as { url?: string };
    const sourceUrl = typeof query.url === "string" ? query.url.trim() : "";

    if (!isHttpUrl(sourceUrl)) {
      return reply.code(400).send(fail("INVALID_VIDEO_URL", "请输入有效的视频地址"));
    }

    try {
      const response = await fetchRemoteVideo(sourceUrl, request.headers.range);
      if (!response.ok || !response.body) {
        return reply.code(502).send(fail("VIDEO_DOWNLOAD_FAILED", `视频下载失败：${response.status}`));
      }

      reply.code(response.status === 206 ? 206 : 200);
      reply.header("content-type", normalizeVideoMimeType(response.headers.get("content-type")));
      copyHeader(response, reply, "content-length");
      copyHeader(response, reply, "content-range");
      copyHeader(response, reply, "accept-ranges");
      return reply.send(Readable.fromWeb(response.body as unknown as NodeReadableStream<Uint8Array>));
    } catch (error) {
      return reply
        .code(502)
        .send(fail("VIDEO_DOWNLOAD_FAILED", error instanceof Error ? error.message : "视频下载失败"));
    }
  });

  app.get("/api/tools/video-text/history", async (request) => {
    const query = request.query as {
      keyword?: string;
      page?: string;
      pageSize?: string;
    };
    const page = parsePositiveInteger(query.page, 1);
    const pageSize = Math.min(parsePositiveInteger(query.pageSize, 10), 50);
    const keyword = (query.keyword ?? "").trim().toLowerCase();
    const history = await listHistoryResults(config, results);
    const matched = keyword ? history.filter((result) => matchHistoryKeyword(result, keyword)) : history;
    const start = (page - 1) * pageSize;

    return ok({
      items: matched.slice(start, start + pageSize).map(toHistoryItem),
      total: matched.length,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(matched.length / pageSize))
    });
  });

  app.get("/api/tools/video-text/history/:taskId", async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const result = await loadResult(config, results, taskId);
    if (!result) {
      return reply.code(404).send(fail("RESULT_NOT_FOUND", "Result not found"));
    }
    return ok(result);
  });

  app.delete("/api/tools/video-text/history/:taskId", async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const existed = Boolean(await loadResult(config, results, taskId));
    if (!existed) {
      return reply.code(404).send(fail("RESULT_NOT_FOUND", "Result not found"));
    }

    results.delete(taskId);
    await deleteStoredResultFiles(config, taskId);
    return ok({ removed: true });
  });

  app.get("/api/tools/video-text/tasks/:taskId", async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const task = taskStore.get(taskId);
    if (!task || task.toolId !== "video-text") {
      return reply.code(404).send(fail("TASK_NOT_FOUND", "Task not found"));
    }

    return ok({
      task,
      result: await loadResult(config, results, taskId)
    });
  });

  app.get("/api/tools/video-text/tasks/:taskId/result", async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const result = await loadResult(config, results, taskId);
    if (!result) {
      return reply.code(404).send(fail("RESULT_NOT_FOUND", "Result not found"));
    }
    return ok(result);
  });

  app.get("/api/tools/video-text/tasks/:taskId/export", async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const { format = "txt" } = request.query as { format?: string };
    const result = await loadResult(config, results, taskId);
    if (!result) {
      return reply.code(404).send(fail("RESULT_NOT_FOUND", "Result not found"));
    }

    const exportFormat = format === "json" || format === "srt" ? format : "txt";
    const body = formatResult(result, exportFormat);
    const fileName = encodeURIComponent(`${path.parse(result.fileName).name}.${exportFormat}`);

    reply.header("Content-Disposition", `attachment; filename*=UTF-8''${fileName}`);
    if (exportFormat === "json") {
      reply.type("application/json; charset=utf-8");
    } else {
      reply.type("text/plain; charset=utf-8");
    }
    return reply.send(body);
  });

  app.delete("/api/tools/video-text/tasks/:taskId", async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    results.delete(taskId);
    await deleteStoredResultFiles(config, taskId);
    return ok({ removed: true });
  });
}

async function createVideoTextTaskFromSource(
  source: VideoTextTaskSource,
  context: {
    config: AppConfig;
    taskStore: TaskStore;
    results: Map<string, StoredVideoTextResult>;
  }
) {
  const { config, taskStore, results } = context;
  const task = taskStore.create("video-text");
  taskStore.update(task.id, { status: "running", progress: 10 });

  const safeName = path.basename(source.fileName || "video.mp4");
  const videoPath = path.join(config.videoTextUploadsDir, `${task.id}-${safeName}`);

  try {
    await fsp.mkdir(config.videoTextUploadsDir, { recursive: true });
    await pipeline(source.stream, fs.createWriteStream(videoPath));
    taskStore.update(task.id, { progress: 35 });

    const hasTranscriber = Boolean(config.videoTextTranscribeCommand);
    const transcribed = await transcribeVideo(videoPath, task.id, config);
    const transcript = transcribed.transcript;

    if (!transcript.trim()) {
      const failed = taskStore.update(task.id, {
        status: "failed",
        progress: 100,
        error: hasTranscriber
          ? "未识别到视频语音文案，请确认视频包含清晰人声后再重试。"
          : "未配置视频语音识别命令，请配置本地识别后再分析。"
      }) as Task;

      return {
        task: failed,
        result: null
      };
    }

    taskStore.update(task.id, { progress: 70 });
    const analysis = analyzeVideoText({
      title: safeName,
      transcript,
      recognitionQuality: transcribed.recognitionQuality
    });
    const result: StoredVideoTextResult = {
      id: task.id,
      fileName: safeName,
      fileSize: source.fileSize ?? (await fsp.stat(videoPath)).size,
      mimeType: source.mimeType,
      source: "transcriber",
      createdAt: new Date().toISOString(),
      ...analysis
    };

    results.set(task.id, result);
    const resultPath = resultFilePath(config, task.id);
    await fsp.writeFile(resultPath, JSON.stringify(result, null, 2), "utf8");
    const completed = taskStore.update(task.id, {
      status: "completed",
      progress: 100,
      outputPath: resultPath
    }) as Task;

    return {
      task: completed,
      result
    };
  } catch (error) {
    const failed = taskStore.update(task.id, {
      status: "failed",
      progress: 100,
      error: error instanceof Error ? error.message : "视频文本解析失败"
    }) as Task;
    return {
      task: failed,
      result: null
    };
  }
}

async function transcribeVideo(videoPath: string, taskId: string, config: AppConfig) {
  if (!config.videoTextTranscribeCommand) {
    return { transcript: "" };
  }

  const audioPath = await extractAudio(videoPath, taskId, config);
  const outputPath = path.join(config.videoTextResultsDir, `${taskId}.txt`);
  const metadataPath = `${outputPath}.meta.json`;
  const { stdout } = await runCommand(
    renderCommand(config.videoTextTranscribeCommand, {
      input: audioPath,
      audio: audioPath,
      video: videoPath,
      output: outputPath
    }),
    "视频语音识别失败：请检查 VIDEO_TEXT_TRANSCRIBE_COMMAND 配置。"
  );

  const recognitionQuality = await readRecognitionQuality(metadataPath);
  try {
    return {
      transcript: await fsp.readFile(outputPath, "utf8"),
      recognitionQuality
    };
  } catch {
    return {
      transcript: stdout,
      recognitionQuality
    };
  }
}

async function readRecognitionQuality(metadataPath: string): Promise<VideoTextRecognitionQuality | undefined> {
  try {
    const parsed = JSON.parse(await fsp.readFile(metadataPath, "utf8")) as VideoTextRecognitionQuality;
    return sanitizeRecognitionQuality(parsed);
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

function stringOrUndefined(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberOrUndefined(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

async function extractAudio(videoPath: string, taskId: string, config: AppConfig) {
  await fsp.mkdir(config.videoTextAudioDir, { recursive: true });
  const audioPath = path.join(config.videoTextAudioDir, `${taskId}.wav`);
  await runCommand(
    renderCommand(config.videoTextAudioExtractCommand, {
      input: videoPath,
      video: videoPath,
      output: audioPath,
      audio: audioPath
    }),
    "音频提取失败：请确认已安装 ffmpeg，或配置 VIDEO_TEXT_AUDIO_EXTRACT_COMMAND。"
  );
  return audioPath;
}

async function runCommand(command: string, fallbackMessage: string) {
  try {
    return await execAsync(command, {
      timeout: 30 * 60 * 1000,
      maxBuffer: 20 * 1024 * 1024
    });
  } catch (error) {
    const detail = error instanceof Error && error.message ? ` ${error.message}` : "";
    throw new Error(`${fallbackMessage}${detail}`);
  }
}

function renderCommand(template: string, values: Record<string, string>) {
  let command = template;
  for (const [key, value] of Object.entries(values)) {
    const quoted = quoteForCommand(value);
    command = command
      .replaceAll(`"{${key}}"`, quoted)
      .replaceAll(`'{${key}}'`, quoted)
      .replaceAll(`{${key}}`, quoted);
  }
  return command;
}

async function loadResult(
  config: AppConfig,
  cache: Map<string, StoredVideoTextResult>,
  taskId: string
): Promise<StoredVideoTextResult | null> {
  const cached = cache.get(taskId);
  if (cached) return cached;

  try {
    const result = sanitizeStoredResult(
      JSON.parse(await fsp.readFile(resultFilePath(config, taskId), "utf8")) as StoredVideoTextResult
    );
    if (!isStoredVideoTextResult(result)) {
      return null;
    }
    cache.set(taskId, result);
    return result;
  } catch {
    return null;
  }
}

async function listHistoryResults(config: AppConfig, cache: Map<string, StoredVideoTextResult>) {
  let files: string[] = [];
  try {
    files = await fsp.readdir(config.videoTextResultsDir);
  } catch {
    return [];
  }

  const results = await Promise.all(
    files
      .filter(isResultJsonFile)
      .map((file) => loadResult(config, cache, path.basename(file, ".json")))
  );

  return results
    .filter((result): result is StoredVideoTextResult => Boolean(result))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function isResultJsonFile(file: string) {
  return file.endsWith(".json") && !file.endsWith(".meta.json") && !file.includes(".txt.");
}

function toHistoryItem(result: StoredVideoTextResult): VideoTextHistoryItem {
  return {
    id: result.id,
    fileName: result.fileName,
    fileSize: result.fileSize,
    mimeType: result.mimeType,
    source: result.source,
    createdAt: result.createdAt,
    summary: result.summary.slice(0, 3),
    textPreview: compactPreview(result.fullText, 160),
    characterCount: result.stats.characterCount
  };
}

function matchHistoryKeyword(result: StoredVideoTextResult, keyword: string) {
  const haystack = [
    result.fileName,
    result.fullText,
    ...result.summary
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(keyword);
}

function sanitizeStoredResult(result: StoredVideoTextResult) {
  const clean = result as StoredVideoTextResult & {
    keywords?: unknown;
    suggestions?: unknown;
    segments?: Array<Record<string, unknown>>;
    timeline?: Array<Record<string, unknown>>;
  };

  delete clean.keywords;
  delete clean.suggestions;
  (clean.segments as Array<Record<string, unknown>> | undefined)?.forEach((segment) => delete segment.keywords);
  (clean.timeline as Array<Record<string, unknown>> | undefined)?.forEach((segment) => delete segment.keywords);
  return clean as StoredVideoTextResult;
}

function isStoredVideoTextResult(value: StoredVideoTextResult) {
  return (
    typeof value.id === "string" &&
    typeof value.fileName === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.fullText === "string" &&
    Array.isArray(value.summary) &&
    value.stats !== undefined &&
    typeof value.stats.characterCount === "number"
  );
}

function compactPreview(text: string, maxLength: number) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

function fetchRemoteVideo(sourceUrl: string, range?: string) {
  const headers: Record<string, string> = {
    accept: "video/*,*/*",
    referer: refererFromUrl(sourceUrl),
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36"
  };

  if (range) {
    headers.range = range;
  }

  return fetch(sourceUrl, { headers });
}

function refererFromUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (hostname.includes("douyin") || hostname.includes("zjcdn.com") || hostname.includes("amemv.com")) {
      return "https://www.douyin.com/";
    }
    if (hostname.includes("xiaohongshu") || hostname.includes("xhscdn.com") || hostname.includes("xhslink.com")) {
      return "https://www.xiaohongshu.com/";
    }
    return `${url.protocol}//${url.hostname}/`;
  } catch {
    return "https://www.douyin.com/";
  }
}

function copyHeader(response: Response, reply: { header: (name: string, value: string) => unknown }, name: string) {
  const value = response.headers.get(name);
  if (value) {
    reply.header(name, value);
  }
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function fileNameFromUrl(value: string) {
  try {
    const parsed = new URL(value);
    const baseName = path.basename(decodeURIComponent(parsed.pathname));
    return baseName && baseName.includes(".") ? baseName : "remote-video.mp4";
  } catch {
    return "remote-video.mp4";
  }
}

function normalizeVideoMimeType(value: string | null) {
  const mimeType = value?.split(";")[0]?.trim().toLowerCase();
  return mimeType?.startsWith("video/") ? mimeType : "video/mp4";
}

function parseContentLength(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

async function deleteStoredResultFiles(config: AppConfig, taskId: string) {
  await Promise.all([
    fsp.rm(resultFilePath(config, taskId), { force: true }),
    fsp.rm(path.join(config.videoTextResultsDir, `${taskId}.txt`), { force: true }),
    fsp.rm(path.join(config.videoTextResultsDir, `${taskId}.txt.meta.json`), { force: true }),
    fsp.rm(path.join(config.videoTextAudioDir, `${taskId}.wav`), { force: true }),
    deleteFilesByPrefix(config.videoTextUploadsDir, `${taskId}-`)
  ]);
}

async function deleteFilesByPrefix(dir: string, prefix: string) {
  let files: string[] = [];
  try {
    files = await fsp.readdir(dir);
  } catch {
    return;
  }

  await Promise.all(
    files
      .filter((file) => file.startsWith(prefix))
      .map((file) => fsp.rm(path.join(dir, file), { force: true }))
  );
}

function resultFilePath(config: AppConfig, taskId: string) {
  return path.join(config.videoTextResultsDir, `${taskId}.json`);
}

function formatResult(result: StoredVideoTextResult, format: "txt" | "srt" | "json") {
  if (format === "json") {
    return JSON.stringify(result, null, 2);
  }

  if (format === "srt") {
    return result.segments
      .map((segment, index) => {
        const start = toSrtTime(segment.startSeconds ?? 0);
        const end = toSrtTime(segment.endSeconds ?? (segment.startSeconds ?? 0) + 2);
        return `${index + 1}\n${start} --> ${end}\n${segment.text}`;
      })
      .join("\n\n");
  }

  return result.fullText;
}

function toSrtTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const wholeSeconds = Math.floor(safe % 60);
  const milliseconds = Math.round((safe - Math.floor(safe)) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(wholeSeconds).padStart(
    2,
    "0"
  )},${String(milliseconds).padStart(3, "0")}`;
}

function quoteForCommand(value: string) {
  return `"${value.replaceAll('"', '\\"')}"`;
}
