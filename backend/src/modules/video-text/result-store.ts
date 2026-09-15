/**
 * 中文模块说明：视频文本分析领域，负责上传、转写任务、历史和导出
 */
import fsp from "node:fs/promises";
import path from "node:path";
import type { StoredVideoTextResultDto, VideoTextHistoryItemDto } from "@toolbox/shared";
import type { AppConfig } from "../../config";

export type StoredVideoTextResult = StoredVideoTextResultDto;
type VideoTextHistoryItem = VideoTextHistoryItemDto;

export async function loadResult(
  config: AppConfig,
  cache: Map<string, StoredVideoTextResult>,
  taskId: string
): Promise<StoredVideoTextResult | null> {
  if (!isValidTaskId(taskId)) return null;
  const cached = cache.get(taskId);
  if (cached) return cached;

  try {
    const result = sanitizeStoredResult(
      JSON.parse(await fsp.readFile(resultFilePath(config, taskId), "utf8")) as StoredVideoTextResult
    );
    if (!isStoredVideoTextResult(result)) return null;
    cache.set(taskId, result);
    return result;
  } catch {
    return null;
  }
}

export async function listHistoryResults(config: AppConfig, cache: Map<string, StoredVideoTextResult>) {
  let files: string[] = [];
  try {
    files = await fsp.readdir(config.videoTextResultsDir);
  } catch {
    return [];
  }

  const results = await Promise.all(
    files.filter(isResultJsonFile).map((file) => loadResult(config, cache, path.basename(file, ".json")))
  );
  return results
    .filter((result): result is StoredVideoTextResult => Boolean(result))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function toHistoryItem(result: StoredVideoTextResult): VideoTextHistoryItem {
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

export function matchHistoryKeyword(result: StoredVideoTextResult, keyword: string) {
  return [result.fileName, result.fullText, ...result.summary].join(" ").toLowerCase().includes(keyword);
}

export function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : fallback;
}

export async function deleteStoredResultFiles(config: AppConfig, taskId: string) {
  if (!isValidTaskId(taskId)) throw new Error("Invalid task id");
  await Promise.all([
    fsp.rm(resultFilePath(config, taskId), { force: true }),
    fsp.rm(path.join(config.videoTextResultsDir, `${taskId}.txt`), { force: true }),
    fsp.rm(path.join(config.videoTextResultsDir, `${taskId}.txt.meta.json`), { force: true }),
    fsp.rm(path.join(config.videoTextAudioDir, `${taskId}.wav`), { force: true }),
    deleteFilesByPrefix(config.videoTextUploadsDir, `${taskId}-`)
  ]);
}

export function resultFilePath(config: AppConfig, taskId: string) {
  if (!isValidTaskId(taskId)) throw new Error("Invalid task id");
  return resolvePathWithin(config.videoTextResultsDir, `${taskId}.json`);
}

export function isValidTaskId(value: string) {
  return /^[A-Za-z0-9_-]{1,64}$/.test(value);
}

export function formatResult(result: StoredVideoTextResult, format: "txt" | "srt" | "json") {
  if (format === "json") return JSON.stringify(result, null, 2);
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

function isResultJsonFile(file: string) {
  return file.endsWith(".json") && !file.endsWith(".meta.json") && !file.includes(".txt.");
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
  return clean;
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

async function deleteFilesByPrefix(dir: string, prefix: string) {
  const files = await fsp.readdir(dir).catch(() => [] as string[]);
  await Promise.all(
    files.filter((file) => file.startsWith(prefix)).map((file) => fsp.rm(path.join(dir, file), { force: true }))
  );
}

function resolvePathWithin(directory: string, fileName: string) {
  const root = path.resolve(directory);
  const target = path.resolve(root, fileName);
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Resolved path escapes its storage directory");
  }
  return target;
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
