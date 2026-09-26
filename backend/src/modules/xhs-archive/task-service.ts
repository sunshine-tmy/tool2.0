/**
 * 中文模块说明：小红书归档领域，负责获取、媒体、翻译、运行时和恢复
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { nanoid } from "nanoid";
import {
  normalizeXhsText,
  parseXhsContentText,
  type XhsArchiveItem,
  type XhsArchiveMedia,
  type XhsArchiveTask
} from "@toolbox/shared";
import type { AppConfig } from "../../config";
import { workerAuthHeaders } from "../../security/worker-auth";
import type { Task, TaskStore } from "../../tasks/task-store";
import {
  assertRemoteResponseSize,
  fetchRemoteResponse,
  limitedResponseStream,
  type RemoteFetch
} from "../../security/remote-fetch";
import { XhsAuthManager } from "./auth";
import { XhsArchiveStore, XhsArchiveStoreError } from "./store";
import { XhsRuntimeError, XhsRuntimeManager } from "./runtime";
import { XhsTranslationService, translationSourceHash } from "./translation-service";

type Upstream = Record<string, unknown>;

export class XhsArchiveTaskService {
  private readonly tasks = new Map<string, XhsArchiveTask>();
  private readonly store: XhsArchiveStore;
  private readonly runtime: XhsRuntimeManager;
  private readonly auth: XhsAuthManager;
  private readonly translation: XhsTranslationService;

  constructor(
    private readonly config: AppConfig,
    private readonly remoteFetch: RemoteFetch,
    store: XhsArchiveStore,
    runtime: XhsRuntimeManager,
    auth: XhsAuthManager,
    translation: XhsTranslationService,
    private readonly taskStore: TaskStore
  ) {
    this.store = store;
    this.runtime = runtime;
    this.auth = auth;
    this.translation = translation;
  }

  async initialize() {
    await this.store.initialize();
    await this.translation.recoverInterrupted();
  }

  async runtimeStatus() {
    return { ...(await this.runtime.refreshCapabilityStatus()), authenticated: await this.auth.isAuthenticated() };
  }

  create(source: string) {
    const task = createTask();
    this.tasks.set(task.id, task);
    this.taskStore.upsert(toUnifiedArchiveTask(task));
    void this.processTask(task.id, source);
    return task;
  }

  get(taskId: string) {
    return this.tasks.get(taskId);
  }

  async refresh(archiveId: string) {
    const item = await this.store.get(archiveId);
    return item ? this.create(item.sourceUrl) : undefined;
  }

  async close() {
    await this.runtime.stop();
    await this.translation.shutdown();
  }

  async processTask(taskId: string, source: string) {
    // 每个获取任务使用独立 staging 目录；只有全部媒体下载并校验成功后才替换旧存档。
    const staging = await this.store.createStaging(taskId);
    try {
      this.updateTask(taskId, "running", "installing", 3, "准备小红书解析环境");
      const provider = await this.runtime.ensureReady((status) =>
        this.updateTask(
          taskId,
          "running",
          "installing",
          Math.max(3, Math.round(status.installProgress * 0.3)),
          status.message
        )
      );
      this.updateTask(taskId, "running", "parsing", 32, "正在解析标题、正文和媒体");
      const cookie = await this.auth.cookieHeader();
      const providerInput = await this.resolveShortLink(extractXhsUrl(source)!);
      const response = await fetch(`${provider}/extract`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...workerAuthHeaders(isLoopbackProvider(provider) ? this.config.xhsProviderToken : undefined)
        },
        body: JSON.stringify({ url: providerInput, cookie }),
        signal: AbortSignal.timeout(90_000)
      });
      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        items?: unknown[];
        detail?: string;
      };
      const raw = Array.isArray(payload.items) ? record(payload.items[0]) : {};
      if (!response.ok || !payload.success || !Object.keys(raw).length) {
        const unavailable = /已删除|不存在|not found|unavailable/i.test(payload.detail || "");
        const code = unavailable ? "XHS_CONTENT_UNAVAILABLE" : cookie ? "XHS_PARSE_FAILED" : "XHS_AUTH_REQUIRED";
        throw new XhsError(
          code,
          unavailable
            ? "该内容已删除、不可见或链接已失效"
            : cookie
              ? payload.detail || "小红书内容解析失败"
              : "内容不完整或触发访问限制，请登录小红书后重试"
        );
      }
      const normalized = normalizeXhsProviderItem(raw, source);
      const previous = await this.store.findByNoteId(normalized.noteId);
      const itemId = previous?.id ?? nanoid(14);
      const mediaSources = normalized.media;
      if (!mediaSources.length)
        throw new XhsError(
          cookie ? "XHS_MEDIA_EMPTY" : "XHS_AUTH_REQUIRED",
          "未获取到媒体文件，请登录后重试或检查内容是否已删除"
        );
      const media: XhsArchiveMedia[] = [];
      let completed = 0;
      const warnings: string[] = [];
      for (const sourceMedia of mediaSources) {
        try {
          // 媒体逐个流式下载并计算摘要；与旧摘要一致时复用旧文件，减少重复流量和磁盘写入。
          let downloaded = await this.downloadMedia(
            sourceMedia.url,
            sourceMedia.kind,
            sourceMedia.index,
            staging,
            itemId
          );
          const unchanged = previous?.media.find(
            (entry) =>
              entry.kind === downloaded.kind &&
              entry.index === downloaded.index &&
              entry.checksum === downloaded.checksum
          );
          if (unchanged) {
            const old = await this.store.mediaPath(previous!.id, unchanged.id);
            if (old && fs.existsSync(old.filePath)) {
              await fsp.rm(path.join(staging, downloaded.fileName), { force: true });
              await fsp.copyFile(old.filePath, path.join(staging, unchanged.fileName));
              downloaded = { ...unchanged };
            }
          }
          media.push(downloaded);
        } catch (error) {
          warnings.push(
            `第 ${sourceMedia.index + 1} 个媒体下载失败：${error instanceof Error ? error.message : "未知错误"}`
          );
        }
        completed += 1;
        this.updateTask(
          taskId,
          "running",
          "downloading",
          38 + Math.round((completed / mediaSources.length) * 48),
          `正在保存媒体 ${completed}/${mediaSources.length}`
        );
      }
      if (!media.length) throw new XhsError("XHS_MEDIA_DOWNLOAD_FAILED", "所有媒体均下载失败，旧存档未被覆盖");
      if (warnings.length)
        throw new XhsError(
          "XHS_MEDIA_DOWNLOAD_PARTIAL",
          `${warnings.length} 个媒体下载失败，未覆盖现有存档，请稍后重试`
        );
      const totalBytes = media.reduce((sum, entry) => sum + entry.size, 0);
      const used = await this.store.totalBytes();
      if (used - (previous?.totalBytes ?? 0) + totalBytes > this.config.xhsArchiveMaxStorageBytes)
        throw new XhsError("XHS_STORAGE_QUOTA_EXCEEDED", "小红书存档空间不足，请在存储与清理中释放空间");
      this.updateTask(taskId, "running", "archiving", 92, "正在写入本地存档");
      const now = new Date().toISOString();
      const item: XhsArchiveItem = {
        id: itemId,
        noteId: normalized.noteId,
        sourceUrl: extractXhsUrl(source)!,
        canonicalUrl: normalized.canonicalUrl,
        type: normalized.type,
        title: normalized.title,
        description: normalized.description,
        topics: normalized.topics,
        author: normalized.author,
        publishedAt: normalized.publishedAt,
        fetchedAt: previous?.fetchedAt ?? now,
        updatedAt: now,
        coverMediaId: media.find((entry) => entry.kind === "image" || entry.kind === "cover")?.id,
        media,
        status: warnings.length ? "partial" : "ready",
        warnings,
        totalBytes,
        translation: previous?.translation
      };
      if (previous?.translation) {
        const nextSourceHash = translationSourceHash(item);
        item.translation =
          previous.translation.sourceHash === nextSourceHash
            ? previous.translation
            : {
                ...previous.translation,
                status: "stale",
                sourceHash: nextSourceHash,
                error: undefined
              };
      }
      // store.commit 负责原子替换清单和媒体；提交前任一异常都会删除 staging，旧存档保持可用。
      await this.store.commit(item, staging);
      this.updateTask(taskId, "completed", "completed", 100, previous ? "存档已更新" : "内容已获取并存档", item.id);
      // Web mode keeps its historical automatic translation behavior. Desktop
      // mode makes translation an explicit optional capability managed in Settings.
      if (!this.config.desktopManagedCapabilities) {
        void this.translation.enqueue([item.id], false).catch(() => undefined);
      }
    } catch (error) {
      // 失败只更新任务状态，不覆盖已有存档；staging 清理失败也不能影响错误回传。
      await fsp.rm(staging, { recursive: true, force: true });
      const task = this.tasks.get(taskId);
      if (task) {
        const failedTask: XhsArchiveTask = {
          ...task,
          status: "failed",
          stage: "failed",
          message: error instanceof Error ? error.message : "获取失败",
          error: error instanceof Error ? error.message : "获取失败",
          errorCode:
            error instanceof XhsError || error instanceof XhsRuntimeError || error instanceof XhsArchiveStoreError
              ? error.code
              : "XHS_TASK_FAILED",
          updatedAt: new Date().toISOString()
        };
        this.tasks.set(taskId, failedTask);
        this.taskStore.upsert(toUnifiedArchiveTask(failedTask));
      }
    }
  }

  async resolveShortLink(url: string) {
    const hostname = new URL(url).hostname.toLowerCase();
    if (
      hostname !== "xhslink.com" &&
      hostname !== "www.xhslink.com" &&
      hostname !== "xhslink.cn" &&
      hostname !== "www.xhslink.cn"
    )
      return url;
    const response = await fetchRemoteResponse(
      this.remoteFetch,
      url,
      { method: "GET", headers: { "user-agent": "Mozilla/5.0" } },
      this.config.remoteFetchTimeoutMs
    );
    await response.body?.cancel();
    // 短链只允许解析到官方域名，且通过统一远程抓取器逐跳执行 SSRF 校验。
    const resolved = extractXhsUrl(response.url);
    if (!resolved || !new URL(resolved).hostname.toLowerCase().endsWith("xiaohongshu.com"))
      throw new XhsError("XHS_URL_INVALID", "小红书短链未跳转到受支持的内容地址");
    return resolved;
  }

  async downloadMedia(url: string, kind: XhsArchiveMedia["kind"], index: number, directory: string, itemId: string) {
    const response = await fetchRemoteResponse(
      this.remoteFetch,
      url,
      { headers: { referer: "https://www.xiaohongshu.com/", "user-agent": "Mozilla/5.0" } },
      this.config.remoteFetchTimeoutMs
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    assertRemoteResponseSize(response, this.config.remoteMediaMaxBytes);
    const mimeType = (response.headers.get("content-type") || defaultMime(kind)).split(";")[0];
    const extension = extensionFor(mimeType, kind);
    const id = nanoid(10);
    const fileName = `${String(index + 1).padStart(3, "0")}-${id}.${extension}`;
    const target = path.join(directory, fileName);
    const hash = createHash("sha256");
    const hasher = new Transform({
      transform(chunk, _encoding, callback) {
        hash.update(chunk);
        callback(null, chunk);
      }
    });
    // 以流方式写入 staging 并限制响应体大小，大文件不会一次性进入内存。
    await pipeline(
      limitedResponseStream(response, this.config.remoteMediaMaxBytes),
      hasher,
      fs.createWriteStream(target)
    );
    const stat = await fsp.stat(target);
    return {
      id,
      kind,
      index,
      fileName,
      mimeType,
      size: stat.size,
      checksum: hash.digest("hex"),
      previewUrl: `/api/v1/tools/xhs-archive/items/${itemId}/media/${id}`,
      downloadUrl: `/api/v1/tools/xhs-archive/items/${itemId}/media/${id}?download=1`
    } satisfies XhsArchiveMedia;
  }

  updateTask(
    id: string,
    status: XhsArchiveTask["status"],
    stage: XhsArchiveTask["stage"],
    progress: number,
    message: string,
    archiveId?: string
  ) {
    const task = this.tasks.get(id);
    if (task) {
      const next: XhsArchiveTask = {
        ...task,
        status,
        stage,
        progress,
        message,
        archiveId: archiveId ?? task.archiveId,
        updatedAt: new Date().toISOString()
      };
      this.tasks.set(id, next);
      this.taskStore.upsert(toUnifiedArchiveTask(next));
    }
  }
}

function isLoopbackProvider(value: string) {
  try {
    const url = new URL(value);
    return ["127.0.0.1", "localhost", "::1"].includes(url.hostname.replace(/^\[|\]$/g, ""));
  } catch {
    return false;
  }
}

function toUnifiedArchiveTask(task: XhsArchiveTask): Task {
  return {
    id: task.id,
    toolId: "xhs-archive",
    status: task.status,
    progress: task.progress,
    outputPath: task.archiveId,
    error: task.errorCode ?? task.error,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  };
}

class XhsError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

function createTask(): XhsArchiveTask {
  const now = new Date().toISOString();
  return {
    id: nanoid(12),
    status: "pending",
    stage: "installing",
    progress: 0,
    message: "任务已创建",
    createdAt: now,
    updatedAt: now
  };
}
function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}
export function extractXhsUrl(value: string) {
  const match = value.match(/https?:\/\/(?:www\.)?(?:xiaohongshu\.com|xhslink\.com|xhslink\.cn)\/[^\s"<>]+/i);
  if (!match) return undefined;
  try {
    const url = new URL(match[0].replace(/[，。；！？、）\]}]+$/, ""));
    if (
      ![
        "xiaohongshu.com",
        "www.xiaohongshu.com",
        "xhslink.com",
        "www.xhslink.com",
        "xhslink.cn",
        "www.xhslink.cn"
      ].includes(url.hostname.toLowerCase())
    )
      return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}
function list(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && /^https?:\/\//.test(entry))
    : typeof value === "string" && /^https?:\/\//.test(value)
      ? [value]
      : [];
}
export function normalizeXhsProviderItem(raw: Upstream, source: string) {
  const noteId = String(raw["作品ID"] ?? raw.id ?? "").trim();
  if (!noteId) throw new XhsError("XHS_PARSE_FAILED", "解析结果缺少笔记 ID");
  const downloads = list(raw["下载地址"] ?? raw.downloads);
  const lives = list(raw["动图地址"] ?? raw.livePhotos);
  const rawType = String(raw["作品类型"] ?? raw.type ?? "");
  const type = lives.length
    ? "live-photo"
    : /视频|video/i.test(rawType)
      ? "video"
      : downloads.length
        ? "image"
        : "unknown";
  const description = normalizeXhsText(String(raw["作品描述"] ?? raw.description ?? "")).trim() || undefined;
  return {
    noteId,
    type: type as XhsArchiveItem["type"],
    title: normalizeXhsText(String(raw["作品标题"] ?? raw.title ?? "未命名小红书内容")).trim() || "未命名小红书内容",
    description,
    topics: parseXhsContentText(description).topics,
    canonicalUrl: String(raw["作品链接"] ?? raw.url ?? extractXhsUrl(source) ?? ""),
    author: {
      id: String(raw["作者ID"] ?? raw.authorId ?? "") || undefined,
      name: String(raw["作者昵称"] ?? raw.authorName ?? "") || undefined
    },
    publishedAt: normalizeDate(raw["发布时间"] ?? raw.publishedAt),
    media: [
      ...downloads.map((url, index) => ({
        url,
        index,
        kind: (/视频|video/i.test(rawType) ? "video" : "image") as XhsArchiveMedia["kind"]
      })),
      ...lives.map((url, offset) => ({ url, index: downloads.length + offset, kind: "live-photo" as const }))
    ]
  };
}
function normalizeDate(value: unknown) {
  if (!value) return undefined;
  const date = new Date(typeof value === "number" && value < 10_000_000_000 ? value * 1000 : String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}
function defaultMime(kind: XhsArchiveMedia["kind"]) {
  return kind === "video" || kind === "live-photo" ? "video/mp4" : "image/jpeg";
}
function extensionFor(mime: string, kind: XhsArchiveMedia["kind"]) {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/quicktime": "mov"
  };
  return map[mime] ?? (kind === "image" || kind === "cover" ? "jpg" : "mp4");
}
