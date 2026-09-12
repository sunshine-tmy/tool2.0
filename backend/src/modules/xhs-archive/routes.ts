import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import archiver from "archiver";
import { nanoid } from "nanoid";
import {
  fail,
  normalizeXhsText,
  ok,
  parseXhsContentText,
  type XhsArchiveItem,
  type XhsArchiveMedia,
  type XhsArchiveTask
} from "@toolbox/shared";
import type { FastifyInstance, FastifyReply } from "fastify";
import type { AppConfig } from "../../config";
import {
  assertRemoteResponseSize,
  fetchRemoteResponse,
  limitedResponseStream,
  type RemoteFetch
} from "../../security/remote-fetch";
import { XhsAuthManager } from "./auth";
import { XhsRuntimeManager } from "./runtime";
import { XhsArchiveStore } from "./store";
import { XhsTranslationRuntime } from "./translation-runtime";
import { XhsTranslationService, effectiveTranslation, translationSourceHash } from "./translation-service";

type Upstream = Record<string, unknown>;

export async function registerXhsArchiveRoutes(options: {
  app: FastifyInstance;
  config: AppConfig;
  remoteFetch: RemoteFetch;
}) {
  const { app, config, remoteFetch } = options;
  const store = new XhsArchiveStore(config);
  const runtime = new XhsRuntimeManager(config);
  const auth = new XhsAuthManager(config);
  const translationRuntime = new XhsTranslationRuntime(config);
  const translation = new XhsTranslationService(config, store, translationRuntime);
  const tasks = new Map<string, XhsArchiveTask>();
  await store.initialize();
  await translation.recoverInterrupted();

  app.get("/api/tools/xhs-archive/runtime", async () =>
    ok({ ...runtime.getStatus(), authenticated: await auth.isAuthenticated() })
  );

  app.get("/api/tools/xhs-archive/translation/runtime", async () => ok(translation.getRuntimeStatus()));

  app.post("/api/tools/xhs-archive/items/:id/translation", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    if (!(await store.get(id))) return reply.code(404).send(fail("XHS_ARCHIVE_NOT_FOUND", "存档不存在"));
    const force = record(request.body).force === true;
    const task = await translation.translateOne(id, force);
    return task ? reply.code(202).send(ok(task)) : ok({ status: "completed", message: "英文翻译已是最新" });
  });

  app.get("/api/tools/xhs-archive/translation/tasks/:taskId", async (request, reply) => {
    const task = translation.getTask((request.params as { taskId: string }).taskId);
    return task ? ok(task) : reply.code(404).send(fail("XHS_TRANSLATION_TASK_NOT_FOUND", "翻译任务不存在"));
  });

  app.post("/api/tools/xhs-archive/translation/batches", async (request, reply) => {
    const body = record(request.body);
    const mode = body.mode;
    let ids: string[] = [];
    if (mode === "selected") {
      ids = Array.isArray(body.itemIds) ? body.itemIds.filter((id): id is string => typeof id === "string") : [];
      if (ids.length > 100)
        return reply.code(400).send(fail("XHS_TRANSLATION_BATCH_TOO_LARGE", "单次最多翻译100条存档"));
      for (const id of ids) {
        if (!(await store.get(id))) return reply.code(404).send(fail("XHS_ARCHIVE_NOT_FOUND", `存档不存在：${id}`));
      }
    } else if (mode === "missing-or-stale") {
      const all = await store.list({ page: 1, pageSize: 50 });
      for (let page = 1; page <= all.pageCount; page += 1) {
        const values = page === 1 ? all : await store.list({ page, pageSize: 50 });
        ids.push(
          ...values.items
            .filter(
              (item) =>
                item.translation?.status !== "ready" ||
                item.translation.sourceHash !== translationSourceHashFromList(item)
            )
            .map((item) => item.id)
        );
      }
      ids = ids.slice(0, 100);
    } else return reply.code(400).send(fail("XHS_TRANSLATION_MODE_INVALID", "翻译批量模式无效"));
    const task = await translation.enqueue(ids, false);
    return task ? reply.code(202).send(ok(task)) : ok({ status: "completed", message: "没有需要翻译的存档" });
  });

  app.patch("/api/tools/xhs-archive/items/:id/translation", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const item = await store.get(id);
    if (!item) return reply.code(404).send(fail("XHS_ARCHIVE_NOT_FOUND", "存档不存在"));
    const body = record(request.body);
    if (typeof body.sourceHash !== "string")
      return reply.code(400).send(fail("XHS_TRANSLATION_SOURCE_HASH_REQUIRED", "缺少来源版本"));
    const currentHash = translationSourceHash(item);
    if (body.sourceHash !== currentHash)
      return reply.code(409).send(fail("XHS_TRANSLATION_SOURCE_CHANGED", "中文内容已变化，请重新翻译"));
    const title = record(body.title);
    const description = record(body.description);
    const topics = Array.isArray(body.topics) ? body.topics : [];
    if (typeof title.edited === "string" && title.edited.length > 2000)
      return reply.code(413).send(fail("XHS_TRANSLATION_TITLE_TOO_LONG", "英文标题不得超过2000个字符"));
    if (typeof description.edited === "string" && description.edited.length > 100000)
      return reply.code(413).send(fail("XHS_TRANSLATION_DESCRIPTION_TOO_LONG", "英文正文不得超过100000个字符"));
    if (
      topics.length > 100 ||
      topics.some((entry) => {
        const edited = record(entry).edited;
        return typeof edited === "string" && edited.length > 200;
      })
    )
      return reply.code(413).send(fail("XHS_TRANSLATION_TOPIC_TOO_LONG", "英文话题数量或长度超出限制"));
    const updated = await store.updateTranslation(id, (current) => {
      const previous = current.translation;
      if (!previous) return current;
      return {
        ...current,
        translation: {
          ...previous,
          status: "ready",
          title: {
            ...previous.title,
            edited: typeof title.edited === "string" ? title.edited.trim() : previous.title.edited,
            editedAt: new Date().toISOString()
          },
          description:
            previous.description && typeof description.edited === "string"
              ? { ...previous.description, edited: description.edited.trim(), editedAt: new Date().toISOString() }
              : previous.description,
          topics: previous.topics.map((topic) => {
            const input = topics.find((entry) => record(entry).topicId === topic.topicId);
            const value = record(input).edited;
            return typeof value === "string"
              ? { ...topic, edited: value.trim(), editedAt: new Date().toISOString() }
              : topic;
          })
        }
      };
    });
    return updated ? ok(updated.translation) : reply.code(404).send(fail("XHS_ARCHIVE_NOT_FOUND", "存档不存在"));
  });

  app.post("/api/tools/xhs-archive/items/:id/translation/reset", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const updated = await store.updateTranslation(id, (current) =>
      current.translation
        ? {
            ...current,
            translation: {
              ...current.translation,
              title: { ...current.translation.title, edited: undefined, editedAt: undefined },
              description: current.translation.description
                ? { ...current.translation.description, edited: undefined, editedAt: undefined }
                : undefined,
              topics: current.translation.topics.map((topic) => ({ ...topic, edited: undefined, editedAt: undefined }))
            }
          }
        : current
    );
    return updated ? ok(updated.translation) : reply.code(404).send(fail("XHS_ARCHIVE_NOT_FOUND", "存档不存在"));
  });

  app.post("/api/tools/xhs-archive/items", async (request, reply) => {
    const source = record(request.body).url;
    if (typeof source !== "string" || !extractXhsUrl(source))
      return reply.code(400).send(fail("XHS_URL_INVALID", "请输入有效的小红书链接或分享文案"));
    const task = createTask();
    tasks.set(task.id, task);
    void processTask(task.id, source);
    return reply.code(202).send(ok(task));
  });

  app.get("/api/tools/xhs-archive/tasks/:taskId", async (request, reply) => {
    const task = tasks.get((request.params as { taskId: string }).taskId);
    return task ? ok(task) : reply.code(404).send(fail("XHS_TASK_NOT_FOUND", "获取任务不存在"));
  });

  app.get("/api/tools/xhs-archive/items", async (request) => {
    const query = request.query as { keyword?: string; type?: string; page?: string; pageSize?: string };
    return ok(
      await store.list({
        keyword: query.keyword,
        type: query.type,
        page: Number(query.page),
        pageSize: Number(query.pageSize)
      })
    );
  });

  app.get("/api/tools/xhs-archive/items/:id", async (request, reply) => {
    const item = await store.get((request.params as { id: string }).id);
    return item ? ok(item) : reply.code(404).send(fail("XHS_ARCHIVE_NOT_FOUND", "存档不存在"));
  });

  app.post("/api/tools/xhs-archive/items/:id/refresh", async (request, reply) => {
    const item = await store.get((request.params as { id: string }).id);
    if (!item) return reply.code(404).send(fail("XHS_ARCHIVE_NOT_FOUND", "存档不存在"));
    const task = createTask();
    tasks.set(task.id, task);
    void processTask(task.id, item.sourceUrl);
    return reply.code(202).send(ok(task));
  });

  app.delete("/api/tools/xhs-archive/items/:id", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const item = await store.get(id);
    if (!item) return reply.code(404).send(fail("XHS_ARCHIVE_NOT_FOUND", "存档不存在"));
    await store.remove(id);
    return ok({ removed: true, mediaCount: item.media.length, releasedBytes: item.totalBytes });
  });

  app.get("/api/tools/xhs-archive/items/:id/media/:mediaId", async (request, reply) => {
    const { id, mediaId } = request.params as { id: string; mediaId: string };
    const value = await store.mediaPath(id, mediaId);
    if (!value) return reply.code(404).send(fail("XHS_MEDIA_NOT_FOUND", "媒体文件不存在"));
    const stat = await fsp.stat(value.filePath).catch(() => undefined);
    if (!stat?.isFile()) return reply.code(404).send(fail("XHS_MEDIA_NOT_FOUND", "媒体文件不存在"));
    const download = record(request.query).download === "1";
    reply
      .header("accept-ranges", "bytes")
      .header("content-type", value.media.mimeType)
      .header("x-content-type-options", "nosniff");
    if (download) reply.header("content-disposition", disposition(value.media.fileName));
    return sendRange(reply, value.filePath, stat.size, request.headers.range);
  });

  app.get("/api/tools/xhs-archive/items/:id/download.zip", async (request, reply) => {
    const item = await store.get((request.params as { id: string }).id);
    if (!item) return reply.code(404).send(fail("XHS_ARCHIVE_NOT_FOUND", "存档不存在"));
    const archive = archiver("zip", { zlib: { level: 6 } });
    reply
      .header("content-type", "application/zip")
      .header(
        "content-disposition",
        disposition(`小红书-${safeName(normalizeXhsText(item.title))}-${item.id.slice(-6)}.zip`)
      );
    archive.append(contentText(item), { name: "内容-中文.txt" });
    if (item.translation?.status === "ready") {
      archive.append(englishContentText(item), { name: "Content-English.txt" });
      archive.append(bilingualContentText(item), { name: "内容-中英双语.txt" });
    }
    archive.append(
      JSON.stringify(
        {
          ...item,
          title: normalizeXhsText(item.title),
          description: item.description ? normalizeXhsText(item.description) : undefined,
          translation: item.translation
            ? {
                ...item.translation,
                effective: {
                  title: effectiveTranslation(item.translation.title),
                  description: effectiveTranslation(item.translation.description),
                  topics: item.translation.topics.map((topic) => ({
                    topicId: topic.topicId,
                    value: effectiveTranslation(topic)
                  }))
                }
              }
            : undefined
        },
        null,
        2
      ),
      { name: "metadata.json" }
    );
    for (const media of item.media) {
      const value = await store.mediaPath(item.id, media.id);
      if (value && fs.existsSync(value.filePath)) archive.file(value.filePath, { name: exportName(media) });
    }
    void archive.finalize();
    return reply.send(archive);
  });

  app.post("/api/tools/xhs-archive/auth/start", async () => ok(auth.start()));
  app.get("/api/tools/xhs-archive/auth/:sessionId", async (request, reply) => {
    const session = auth.get((request.params as { sessionId: string }).sessionId);
    return session ? ok(session) : reply.code(404).send(fail("XHS_AUTH_SESSION_NOT_FOUND", "登录会话不存在"));
  });

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
      if (task)
        tasks.set(taskId, {
          ...task,
          status: "failed",
          stage: "failed",
          message: error instanceof Error ? error.message : "获取失败",
          error: error instanceof Error ? error.message : "获取失败",
          errorCode: error instanceof XhsError ? error.code : "XHS_TASK_FAILED",
          updatedAt: new Date().toISOString()
        });
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
      previewUrl: `/api/tools/xhs-archive/items/${itemId}/media/${id}`,
      downloadUrl: `/api/tools/xhs-archive/items/${itemId}/media/${id}?download=1`
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
    if (task)
      tasks.set(id, {
        ...task,
        status,
        stage,
        progress,
        message,
        archiveId: archiveId ?? task.archiveId,
        updatedAt: new Date().toISOString()
      });
  }
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
function sendRange(reply: FastifyReply, file: string, size: number, header?: string) {
  if (!header) {
    reply.header("content-length", size);
    return reply.send(fs.createReadStream(file));
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match) return reply.code(416).header("content-range", `bytes */${size}`).send();
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end >= size)
    return reply.code(416).header("content-range", `bytes */${size}`).send();
  reply.code(206).headers({ "content-range": `bytes ${start}-${end}/${size}`, "content-length": end - start + 1 });
  return reply.send(fs.createReadStream(file, { start, end }));
}
function disposition(name: string) {
  return `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
function safeName(value: string) {
  return (
    value
      .split("")
      .map((character) => (character.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(character) ? "-" : character))
      .join("")
      .trim()
      .slice(0, 60) || "内容"
  );
}
function exportName(media: XhsArchiveMedia) {
  const ext = path.extname(media.fileName);
  const label =
    media.kind === "image" || media.kind === "cover" ? "图片" : media.kind === "live-photo" ? "实况" : "视频";
  return `${label}-${String(media.index + 1).padStart(2, "0")}${ext}`;
}
function contentText(item: XhsArchiveItem) {
  const parsed = parseXhsContentText(item.description);
  return [
    `标题：${normalizeXhsText(item.title)}`,
    `作者：${item.author?.name ?? ""}`,
    `来源：${item.canonicalUrl}`,
    "",
    parsed.body,
    parsed.topics.length ? `\n话题：${parsed.topics.map((topic) => `#${topic.source}`).join(" ")}` : ""
  ].join("\n");
}

function englishContentText(item: XhsArchiveItem) {
  const translation = item.translation;
  if (!translation) return "";
  const topics = translation.topics.map((topic) => `#${effectiveTranslation(topic)}`).join(" ");
  return [
    `Title: ${effectiveTranslation(translation.title)}`,
    `Author: ${item.author?.name ?? ""}`,
    `Source: ${item.canonicalUrl}`,
    "",
    effectiveTranslation(translation.description),
    topics ? `\nTopics: ${topics}` : ""
  ].join("\n");
}

function bilingualContentText(item: XhsArchiveItem) {
  const translation = item.translation;
  if (!translation) return contentText(item);
  const parsed = parseXhsContentText(item.description);
  const sourceTopics = item.topics.length ? item.topics : parsed.topics;
  return [
    `标题：${item.title}`,
    `Title: ${effectiveTranslation(translation.title)}`,
    `作者：${item.author?.name ?? ""}`,
    `来源：${item.canonicalUrl}`,
    "",
    "正文：",
    parsed.body,
    "",
    "Description:",
    effectiveTranslation(translation.description),
    sourceTopics.length ? `\n话题：${sourceTopics.map((topic) => `#${topic.source}`).join(" ")}` : "",
    sourceTopics.length
      ? `Topics: ${translation.topics.map((topic) => `#${effectiveTranslation(topic)}`).join(" ")}`
      : ""
  ].join("\n");
}

function translationSourceHashFromList(item: Pick<XhsArchiveItem, "title" | "description" | "topics">) {
  return translationSourceHash(item);
}
