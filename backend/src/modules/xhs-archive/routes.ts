import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { nanoid } from "nanoid";
import {
  TaskIdParamsSchema,
  XhsArchiveCreateInputSchema,
  XhsArchiveIdParamsSchema,
  XhsArchiveListQuerySchema,
  XhsAuthSessionParamsSchema,
  fail,
  normalizeXhsText,
  ok,
  parseXhsContentText,
  type XhsArchiveItem,
  type XhsArchiveMedia,
  type XhsArchiveTask,
  type TaskIdParams,
  type XhsArchiveCreateInput,
  type XhsArchiveIdParams,
  type XhsArchiveListQuery,
  type XhsAuthSessionParams
} from "@toolbox/shared";
import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../../config";
import type { ToolboxDatabase } from "../../database/toolbox-database";
import type { Task, TaskStore } from "../../tasks/task-store";
import {
  assertRemoteResponseSize,
  fetchRemoteResponse,
  limitedResponseStream,
  type RemoteFetch
} from "../../security/remote-fetch";
import { XhsAuthManager } from "./auth";
import { XhsRuntimeManager } from "./runtime";
import { XhsArchiveStore } from "./store";
import { registerXhsMediaRoutes } from "./media-routes";
import { XhsTranslationRuntime } from "./translation-runtime";
import { XhsTranslationService, translationSourceHash } from "./translation-service";
import { registerXhsTranslationRoutes } from "./translation-routes";

type Upstream = Record<string, unknown>;

export async function registerXhsArchiveRoutes(options: {
  app: FastifyInstance;
  config: AppConfig;
  remoteFetch: RemoteFetch;
  database: ToolboxDatabase;
  taskStore: TaskStore;
}) {
  const { app, config, remoteFetch, database, taskStore } = options;
  const store = new XhsArchiveStore(config, database);
  const runtime = new XhsRuntimeManager(config);
  const auth = new XhsAuthManager(config);
  const translationRuntime = new XhsTranslationRuntime(config);
  const translation = new XhsTranslationService(config, store, translationRuntime, taskStore);
  const tasks = new Map<string, XhsArchiveTask>();
  await store.initialize();
  await translation.recoverInterrupted();

  app.get("/api/v1/tools/xhs-archive/runtime", async () =>
    ok({ ...runtime.getStatus(), authenticated: await auth.isAuthenticated() })
  );

  registerXhsTranslationRoutes({ app, store, translation });

  app.post<{ Body: XhsArchiveCreateInput }>(
    "/api/v1/tools/xhs-archive/items",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: { body: XhsArchiveCreateInputSchema }
    },
    async (request, reply) => {
      const { url: source } = request.body;
      if (!extractXhsUrl(source))
        return reply.code(400).send(fail("XHS_URL_INVALID", "请输入有效的小红书链接或分享文案"));
      const task = createTask();
      tasks.set(task.id, task);
      taskStore.upsert(toUnifiedArchiveTask(task));
      void processTask(task.id, source);
      return reply.code(202).send(ok(task));
    }
  );

  app.get<{ Params: TaskIdParams }>(
    "/api/v1/tools/xhs-archive/tasks/:taskId",
    { schema: { params: TaskIdParamsSchema } },
    async (request, reply) => {
      const task = tasks.get(request.params.taskId);
      return task ? ok(task) : reply.code(404).send(fail("XHS_TASK_NOT_FOUND", "获取任务不存在"));
    }
  );

  app.get<{ Querystring: XhsArchiveListQuery }>(
    "/api/v1/tools/xhs-archive/items",
    { schema: { querystring: XhsArchiveListQuerySchema } },
    async (request) => ok(await store.list(request.query))
  );

  app.get<{ Params: XhsArchiveIdParams }>(
    "/api/v1/tools/xhs-archive/items/:id",
    { schema: { params: XhsArchiveIdParamsSchema } },
    async (request, reply) => {
      const item = await store.get(request.params.id);
      return item ? ok(item) : reply.code(404).send(fail("XHS_ARCHIVE_NOT_FOUND", "存档不存在"));
    }
  );

  app.post<{ Params: XhsArchiveIdParams }>(
    "/api/v1/tools/xhs-archive/items/:id/refresh",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: { params: XhsArchiveIdParamsSchema }
    },
    async (request, reply) => {
      const item = await store.get(request.params.id);
      if (!item) return reply.code(404).send(fail("XHS_ARCHIVE_NOT_FOUND", "存档不存在"));
      const task = createTask();
      tasks.set(task.id, task);
      taskStore.upsert(toUnifiedArchiveTask(task));
      void processTask(task.id, item.sourceUrl);
      return reply.code(202).send(ok(task));
    }
  );

  app.delete<{ Params: XhsArchiveIdParams }>(
    "/api/v1/tools/xhs-archive/items/:id",
    { schema: { params: XhsArchiveIdParamsSchema } },
    async (request, reply) => {
      const { id } = request.params;
      const item = await store.get(id);
      if (!item) return reply.code(404).send(fail("XHS_ARCHIVE_NOT_FOUND", "存档不存在"));
      await store.remove(id);
      return ok({ removed: true, mediaCount: item.media.length, releasedBytes: item.totalBytes });
    }
  );

  registerXhsMediaRoutes({ app, store });

  app.post(
    "/api/v1/tools/xhs-archive/auth/start",
    { config: { rateLimit: { max: 3, timeWindow: "1 minute" } } },
    async () => ok(auth.start())
  );
  app.get<{ Params: XhsAuthSessionParams }>(
    "/api/v1/tools/xhs-archive/auth/:sessionId",
    { schema: { params: XhsAuthSessionParamsSchema } },
    async (request, reply) => {
      const session = auth.get(request.params.sessionId);
      return session ? ok(session) : reply.code(404).send(fail("XHS_AUTH_SESSION_NOT_FOUND", "登录会话不存在"));
    }
  );

  app.addHook("onClose", async () => {
    await runtime.stop();
    await translation.shutdown();
  });

  async function processTask(taskId: string, source: string) {
    const staging = await store.createStaging(taskId);
    try {
      updateTask(taskId, "running", "installing", 3, "准备小红书解析环境");
      const provider = await runtime.ensureReady((status) =>
        updateTask(
          taskId,
          "running",
          "installing",
          Math.max(3, Math.round(status.installProgress * 0.3)),
          status.message
        )
      );
      updateTask(taskId, "running", "parsing", 32, "正在解析标题、正文和媒体");
      const cookie = await auth.cookieHeader();
      const providerInput = await resolveShortLink(extractXhsUrl(source)!);
      const response = await fetch(`${provider}/extract`, {
        method: "POST",
        headers: { "content-type": "application/json" },
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
      const normalized = normalize(raw, source);
      const previous = await store.findByNoteId(normalized.noteId);
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
          let downloaded = await downloadMedia(sourceMedia.url, sourceMedia.kind, sourceMedia.index, staging, itemId);
          const unchanged = previous?.media.find(
            (entry) =>
              entry.kind === downloaded.kind &&
              entry.index === downloaded.index &&
              entry.checksum === downloaded.checksum
          );
          if (unchanged) {
            const old = await store.mediaPath(previous!.id, unchanged.id);
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
        updateTask(
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
      const used = await store.totalBytes();
      if (used - (previous?.totalBytes ?? 0) + totalBytes > config.xhsArchiveMaxStorageBytes)
        throw new XhsError("XHS_STORAGE_QUOTA_EXCEEDED", "小红书存档空间不足，请在存储与清理中释放空间");
      updateTask(taskId, "running", "archiving", 92, "正在写入本地存档");
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
      await store.commit(item, staging);
      updateTask(taskId, "completed", "completed", 100, previous ? "存档已更新" : "内容已获取并存档", item.id);
      void translation.enqueue([item.id], false).catch(() => undefined);
    } catch (error) {
      await fsp.rm(staging, { recursive: true, force: true });
      const task = tasks.get(taskId);
      if (task) {
        const failedTask: XhsArchiveTask = {
          ...task,
          status: "failed",
          stage: "failed",
          message: error instanceof Error ? error.message : "获取失败",
          error: error instanceof Error ? error.message : "获取失败",
          errorCode: error instanceof XhsError ? error.code : "XHS_TASK_FAILED",
          updatedAt: new Date().toISOString()
        };
        tasks.set(taskId, failedTask);
        taskStore.upsert(toUnifiedArchiveTask(failedTask));
      }
    }
  }

  async function resolveShortLink(url: string) {
    const hostname = new URL(url).hostname.toLowerCase();
    if (
      hostname !== "xhslink.com" &&
      hostname !== "www.xhslink.com" &&
      hostname !== "xhslink.cn" &&
      hostname !== "www.xhslink.cn"
    )
      return url;
    const response = await fetchRemoteResponse(
      remoteFetch,
      url,
      { method: "GET", headers: { "user-agent": "Mozilla/5.0" } },
      config.remoteFetchTimeoutMs
    );
    await response.body?.cancel();
    const resolved = extractXhsUrl(response.url);
    if (!resolved || !new URL(resolved).hostname.toLowerCase().endsWith("xiaohongshu.com"))
      throw new XhsError("XHS_URL_INVALID", "小红书短链未跳转到受支持的内容地址");
    return resolved;
  }

  async function downloadMedia(
    url: string,
    kind: XhsArchiveMedia["kind"],
    index: number,
    directory: string,
    itemId: string
  ) {
    const response = await fetchRemoteResponse(
      remoteFetch,
      url,
      { headers: { referer: "https://www.xiaohongshu.com/", "user-agent": "Mozilla/5.0" } },
      config.remoteFetchTimeoutMs
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    assertRemoteResponseSize(response, config.remoteMediaMaxBytes);
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
    await pipeline(limitedResponseStream(response, config.remoteMediaMaxBytes), hasher, fs.createWriteStream(target));
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

  function updateTask(
    id: string,
    status: XhsArchiveTask["status"],
    stage: XhsArchiveTask["stage"],
    progress: number,
    message: string,
    archiveId?: string
  ) {
    const task = tasks.get(id);
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
      tasks.set(id, next);
      taskStore.upsert(toUnifiedArchiveTask(next));
    }
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
function extractXhsUrl(value: string) {
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
function normalize(raw: Upstream, source: string) {
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
