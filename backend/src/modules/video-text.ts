import fsp from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import {
  ApiFailureSchema,
  StoredVideoTextResultSchema,
  VideoTextExportQuerySchema,
  VideoTextFromUrlInputSchema,
  VideoTextHistoryQuerySchema,
  VideoTextHistorySchema,
  VideoTextRemoteQuerySchema,
  VideoTextRemovalSchema,
  VideoTextTaskResponseSchema,
  VideoTextTaskParamsSchema,
  apiSuccessSchema,
  fail,
  ok,
  type StoredVideoTextResultDto,
  type VideoTextFromUrlInputDto
} from "@toolbox/shared";
import type { AppConfig } from "../config";
import type { TaskStore } from "../tasks/task-store";
import { assertRemoteResponseSize, limitedResponseStream, type RemoteFetch } from "../security/remote-fetch";
import {
  deleteStoredResultFiles,
  formatResult,
  isValidTaskId,
  listHistoryResults,
  loadResult,
  matchHistoryKeyword,
  parsePositiveInteger,
  toHistoryItem
} from "./video-text/result-store";
import {
  copyHeader,
  fetchRemoteVideo,
  fileNameFromUrl,
  isHttpUrl,
  normalizeVideoMimeType,
  parseContentLength
} from "./video-text/remote-source";
import { createVideoTextTaskFromSource } from "./video-text/task-service";

type RegisterVideoTextRoutesOptions = {
  app: FastifyInstance;
  config: AppConfig;
  taskStore: TaskStore;
  remoteFetch: RemoteFetch;
};

type StoredVideoTextResult = StoredVideoTextResultDto;
type TaskParams = { taskId: string };

export async function registerVideoTextRoutes({ app, config, taskStore, remoteFetch }: RegisterVideoTextRoutesOptions) {
  const results = new Map<string, StoredVideoTextResult>();
  const activeJobs = new Set<Promise<unknown>>();
  const shutdownController = new AbortController();
  const trackJob = (job: Promise<unknown>) => {
    activeJobs.add(job);
    void job.then(
      () => activeJobs.delete(job),
      () => activeJobs.delete(job)
    );
  };
  await fsp.mkdir(config.videoTextUploadsDir, { recursive: true });
  await fsp.mkdir(config.videoTextAudioDir, { recursive: true });
  await fsp.mkdir(config.videoTextResultsDir, { recursive: true });

  app.post(
    "/api/v1/tools/video-text/tasks",
    {
      schema: {
        response: { 202: apiSuccessSchema(VideoTextTaskResponseSchema), 400: ApiFailureSchema, 413: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const file = await request.file();
      if (!file) {
        return reply.code(400).send(fail("FILE_REQUIRED", "Please upload a video file"));
      }

      if (!file.mimetype.startsWith("video/")) {
        return reply.code(400).send(fail("VIDEO_REQUIRED", "Please upload a supported video file"));
      }

      return reply.code(202).send(
        ok(
          await createVideoTextTaskFromSource(
            {
              stream: file.file,
              fileName: file.filename || "video.mp4",
              mimeType: file.mimetype
            },
            { config, taskStore, results, signal: shutdownController.signal, trackJob }
          )
        )
      );
    }
  );

  app.post<{ Body: VideoTextFromUrlInputDto }>(
    "/api/v1/tools/video-text/tasks/from-url",
    {
      schema: {
        body: VideoTextFromUrlInputSchema,
        response: {
          202: apiSuccessSchema(VideoTextTaskResponseSchema),
          400: ApiFailureSchema,
          502: ApiFailureSchema
        }
      }
    },
    async (request, reply) => {
      const body = request.body;
      const sourceUrl = body.url.trim();

      if (!isHttpUrl(sourceUrl)) {
        return reply.code(400).send(fail("INVALID_VIDEO_URL", "请输入有效的视频地址"));
      }

      try {
        const response = await fetchRemoteVideo(sourceUrl, remoteFetch, config);

        if (!response.ok || !response.body) {
          return reply.code(502).send(fail("VIDEO_DOWNLOAD_FAILED", `视频下载失败：${response.status}`));
        }
        assertRemoteResponseSize(response, config.remoteMediaMaxBytes);

        const mimeType = normalizeVideoMimeType(response.headers.get("content-type"));
        const fileName = body.fileName || fileNameFromUrl(sourceUrl);

        return reply.code(202).send(
          ok(
            await createVideoTextTaskFromSource(
              {
                stream: limitedResponseStream(response, config.remoteMediaMaxBytes),
                fileName,
                mimeType,
                fileSize: parseContentLength(response.headers.get("content-length"))
              },
              { config, taskStore, results, signal: shutdownController.signal, trackJob }
            )
          )
        );
      } catch (error) {
        return reply
          .code(502)
          .send(fail("VIDEO_DOWNLOAD_FAILED", error instanceof Error ? error.message : "视频下载失败"));
      }
    }
  );

  app.get<{ Querystring: { url: string } }>(
    "/api/v1/tools/video-text/remote-video",
    { schema: { querystring: VideoTextRemoteQuerySchema } },
    async (request, reply) => {
      const sourceUrl = request.query.url.trim();

      if (!isHttpUrl(sourceUrl)) {
        return reply.code(400).send(fail("INVALID_VIDEO_URL", "请输入有效的视频地址"));
      }

      try {
        const response = await fetchRemoteVideo(sourceUrl, remoteFetch, config, request.headers.range);
        if (!response.ok || !response.body) {
          return reply.code(502).send(fail("VIDEO_DOWNLOAD_FAILED", `视频下载失败：${response.status}`));
        }
        assertRemoteResponseSize(response, config.remoteMediaMaxBytes);

        reply.code(response.status === 206 ? 206 : 200);
        reply.header("content-type", normalizeVideoMimeType(response.headers.get("content-type")));
        copyHeader(response, reply, "content-length");
        copyHeader(response, reply, "content-range");
        copyHeader(response, reply, "accept-ranges");
        return reply.send(limitedResponseStream(response, config.remoteMediaMaxBytes));
      } catch (error) {
        return reply
          .code(502)
          .send(fail("VIDEO_DOWNLOAD_FAILED", error instanceof Error ? error.message : "视频下载失败"));
      }
    }
  );

  app.get<{ Querystring: { keyword?: string; page?: string; pageSize?: string } }>(
    "/api/v1/tools/video-text/history",
    {
      schema: {
        querystring: VideoTextHistoryQuerySchema,
        response: { 200: apiSuccessSchema(VideoTextHistorySchema) }
      }
    },
    async (request) => {
      const query = request.query;
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
    }
  );

  app.get<{ Params: TaskParams }>(
    "/api/v1/tools/video-text/history/:taskId",
    {
      schema: {
        params: VideoTextTaskParamsSchema,
        response: { 200: apiSuccessSchema(StoredVideoTextResultSchema), 400: ApiFailureSchema, 404: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const { taskId } = request.params;
      if (!isValidTaskId(taskId)) {
        return reply.code(400).send(fail("INVALID_TASK_ID", "Invalid task id"));
      }
      const result = await loadResult(config, results, taskId);
      if (!result) {
        return reply.code(404).send(fail("RESULT_NOT_FOUND", "Result not found"));
      }
      return ok(result);
    }
  );

  app.delete<{ Params: TaskParams }>(
    "/api/v1/tools/video-text/history/:taskId",
    {
      schema: {
        params: VideoTextTaskParamsSchema,
        response: { 200: apiSuccessSchema(VideoTextRemovalSchema), 400: ApiFailureSchema, 404: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const { taskId } = request.params;
      if (!isValidTaskId(taskId)) {
        return reply.code(400).send(fail("INVALID_TASK_ID", "Invalid task id"));
      }
      const existed = Boolean(await loadResult(config, results, taskId));
      if (!existed) {
        return reply.code(404).send(fail("RESULT_NOT_FOUND", "Result not found"));
      }

      results.delete(taskId);
      taskStore.remove(taskId);
      await deleteStoredResultFiles(config, taskId);
      return ok({ removed: true as const });
    }
  );

  app.get<{ Params: TaskParams }>(
    "/api/v1/tools/video-text/tasks/:taskId",
    {
      schema: {
        params: VideoTextTaskParamsSchema,
        response: { 200: apiSuccessSchema(VideoTextTaskResponseSchema), 400: ApiFailureSchema, 404: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const { taskId } = request.params;
      if (!isValidTaskId(taskId)) {
        return reply.code(400).send(fail("INVALID_TASK_ID", "Invalid task id"));
      }
      const task = taskStore.get(taskId);
      if (!task || task.toolId !== "video-text") {
        return reply.code(404).send(fail("TASK_NOT_FOUND", "Task not found"));
      }

      return ok({
        task,
        result: await loadResult(config, results, taskId)
      });
    }
  );

  app.get<{ Params: TaskParams }>(
    "/api/v1/tools/video-text/tasks/:taskId/result",
    {
      schema: {
        params: VideoTextTaskParamsSchema,
        response: { 200: apiSuccessSchema(StoredVideoTextResultSchema), 400: ApiFailureSchema, 404: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const { taskId } = request.params;
      if (!isValidTaskId(taskId)) {
        return reply.code(400).send(fail("INVALID_TASK_ID", "Invalid task id"));
      }
      const result = await loadResult(config, results, taskId);
      if (!result) {
        return reply.code(404).send(fail("RESULT_NOT_FOUND", "Result not found"));
      }
      return ok(result);
    }
  );

  app.get<{ Params: TaskParams; Querystring: { format?: "txt" | "srt" | "json" } }>(
    "/api/v1/tools/video-text/tasks/:taskId/export",
    { schema: { params: VideoTextTaskParamsSchema, querystring: VideoTextExportQuerySchema } },
    async (request, reply) => {
      const { taskId } = request.params;
      if (!isValidTaskId(taskId)) {
        return reply.code(400).send(fail("INVALID_TASK_ID", "Invalid task id"));
      }
      const { format = "txt" } = request.query;
      const result = await loadResult(config, results, taskId);
      if (!result) {
        return reply.code(404).send(fail("RESULT_NOT_FOUND", "Result not found"));
      }

      const body = formatResult(result, format);
      const fileName = encodeURIComponent(`${path.parse(result.fileName).name}.${format}`);

      reply.header("Content-Disposition", `attachment; filename*=UTF-8''${fileName}`);
      if (format === "json") {
        reply.type("application/json; charset=utf-8");
      } else {
        reply.type("text/plain; charset=utf-8");
      }
      return reply.send(body);
    }
  );

  app.delete<{ Params: TaskParams }>(
    "/api/v1/tools/video-text/tasks/:taskId",
    {
      schema: {
        params: VideoTextTaskParamsSchema,
        response: { 200: apiSuccessSchema(VideoTextRemovalSchema), 400: ApiFailureSchema, 404: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const { taskId } = request.params;
      if (!isValidTaskId(taskId)) {
        return reply.code(400).send(fail("INVALID_TASK_ID", "Invalid task id"));
      }
      const task = taskStore.get(taskId);
      const result = await loadResult(config, results, taskId);
      if ((!task || task.toolId !== "video-text") && !result) {
        return reply.code(404).send(fail("TASK_NOT_FOUND", "Task not found"));
      }
      results.delete(taskId);
      taskStore.remove(taskId);
      await deleteStoredResultFiles(config, taskId);
      return ok({ removed: true as const });
    }
  );

  app.addHook("onClose", async () => {
    shutdownController.abort();
    await Promise.allSettled([...activeJobs]);
  });
}
