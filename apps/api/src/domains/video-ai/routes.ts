/**
 * 中文模块说明：视频去字幕领域，负责任务队列、Worker 调用和本机结果文件
 */
import fs from "node:fs/promises";
import path from "node:path";
import { manualRangesToSegments } from "./manual-ranges";
import type { FastifyInstance } from "fastify";
import {
  ApiFailureSchema,
  VIDEO_AI_ALLOWED_EXTENSIONS,
  VIDEO_AI_MAX_FILE_BYTES,
  VIDEO_AI_MAX_STORAGE_BYTES,
  VideoAiDeleteSchema,
  VideoAiDetectionSchema,
  VideoAiHealthSchema,
  VideoAiHistoryQuerySchema,
  VideoAiHistorySchema,
  VideoAiTaskParamsSchema,
  VideoAiTaskSchema,
  apiSuccessSchema,
  fail,
  ok,
  type VideoAiHistoryQuery,
  type VideoAiRect,
  type VideoAiSegment,
  type VideoAiTaskParams
} from "@toolbox/shared";
import { nanoid } from "nanoid";
import type { AppConfig } from "../../config";
import type { ToolboxDatabase } from "../../database/toolbox-database";
import { REQUEST_QUOTAS } from "../../security/request-quotas";
import type { TaskStore } from "../../tasks/task-store";
import { createVideoAiTaskManager } from "./task-manager";
import { isVideoAiModeValue } from "./task-projections";
import { VideoAiWorkerError } from "./worker-client";
import { probeVideo } from "./media";
import { sendFileRange } from "../../core/media/file-range";

export async function registerVideoAiRoutes(
  app: FastifyInstance,
  config: AppConfig,
  database: ToolboxDatabase,
  taskStore: TaskStore
) {
  const manager = createVideoAiTaskManager(config, database, taskStore);
  await manager.initialize();
  app.addHook("onClose", async () => manager.close());

  const componentMissing = () => config.desktopManagedCapabilities && !config.videoAiCapabilityReady;

  app.get(
    "/api/v1/tools/video-ai/health",
    { schema: { response: { 200: apiSuccessSchema(VideoAiHealthSchema), 503: ApiFailureSchema } } },
    async (_request, reply) => {
      try {
        return ok(await manager.worker.health());
      } catch (error) {
        const workerError = toWorkerError(error);
        return reply
          .code(503)
          .send(
            fail(
              componentMissing() ? "COMPONENT_NOT_INSTALLED" : workerError.code,
              componentMissing() ? "视频去字幕能力尚未安装，请前往设置 → 能力管理安装。" : workerError.message
            )
          );
      }
    }
  );

  app.get<{ Querystring: VideoAiHistoryQuery }>(
    "/api/v1/tools/video-ai/history",
    {
      schema: {
        querystring: VideoAiHistoryQuerySchema,
        response: { 200: apiSuccessSchema(VideoAiHistorySchema), 400: ApiFailureSchema }
      }
    },
    async (request) => ok(manager.listHistory(request.query))
  );

  app.get<{ Params: VideoAiTaskParams }>(
    "/api/v1/tools/video-ai/tasks/:taskId",
    {
      schema: {
        params: VideoAiTaskParamsSchema,
        response: { 200: apiSuccessSchema(VideoAiTaskSchema), 404: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const task = manager.get(request.params.taskId);
      return task ? ok(task) : reply.code(404).send(fail("TASK_NOT_FOUND", "任务不存在或已被删除"));
    }
  );

  app.post<{ Params: VideoAiTaskParams }>(
    "/api/v1/tools/video-ai/tasks/:taskId/cancel",
    {
      schema: {
        params: VideoAiTaskParamsSchema,
        response: { 200: apiSuccessSchema(VideoAiTaskSchema), 404: ApiFailureSchema, 409: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const task = await manager.cancel(request.params.taskId);
      if (!task) return reply.code(404).send(fail("TASK_NOT_FOUND", "任务不存在或已被删除"));
      if (task.status === "completed" || task.status === "failed") {
        return reply.code(409).send(fail("TASK_ALREADY_FINISHED", "任务已结束，无法取消"));
      }
      return ok(task);
    }
  );

  app.delete<{ Params: VideoAiTaskParams }>(
    "/api/v1/tools/video-ai/tasks/:taskId",
    {
      schema: {
        params: VideoAiTaskParamsSchema,
        response: {
          200: apiSuccessSchema(VideoAiDeleteSchema),
          404: ApiFailureSchema,
          409: ApiFailureSchema,
          500: ApiFailureSchema
        }
      }
    },
    async (request, reply) => {
      try {
        const deleted = await manager.remove(request.params.taskId);
        return deleted
          ? ok({ id: request.params.taskId, deleted: true as const }, "任务记录及本机输入、输出已删除")
          : reply.code(404).send(fail("TASK_NOT_FOUND", "任务不存在或已被删除"));
      } catch (error) {
        const busy = error instanceof Error && "code" in error && error.code === "VIDEO_AI_TASK_BUSY";
        return reply
          .code(busy ? 409 : 500)
          .send(
            fail(
              busy ? "VIDEO_AI_TASK_BUSY" : "VIDEO_AI_DELETE_FAILED",
              busy ? "任务尚在等待或处理中，请先取消并等待结束后再删除" : "未能完整删除本机文件，记录已保留，请稍后重试"
            )
          );
      }
    }
  );

  app.get<{ Params: VideoAiTaskParams }>(
    "/api/v1/tools/video-ai/tasks/:taskId/output",
    { schema: { params: VideoAiTaskParamsSchema } },
    async (request, reply) => {
      const task = manager.getStored(request.params.taskId);
      if (!task?.outputPath) return reply.code(404).send(fail("OUTPUT_NOT_FOUND", "输出视频不存在或尚未生成"));
      try {
        const root = await fs.realpath(config.videoAiOutputsDir);
        const file = await fs.realpath(task.outputPath);
        const relative = path.relative(root, file);
        if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
          throw new Error("Output outside task directory");
        }
        await fs.access(file);
        reply.header("X-Content-Type-Options", "nosniff");
        if (!(request.query as { preview?: string }).preview)
          reply.header("Content-Disposition", `attachment; filename="video-ai-${task.id}.mp4"`);
        reply.header("accept-ranges", "bytes");
        reply.type("video/mp4");
        return sendFileRange(reply, file, (await fs.stat(file)).size, request.headers.range);
      } catch {
        return reply.code(404).send(fail("OUTPUT_NOT_FOUND", "输出视频不存在或已被清理"));
      }
    }
  );

  app.post(
    "/api/v1/tools/video-ai/detect",
    {
      config: REQUEST_QUOTAS.ai,
      schema: {
        response: {
          200: apiSuccessSchema(VideoAiDetectionSchema),
          400: ApiFailureSchema,
          409: ApiFailureSchema,
          413: ApiFailureSchema,
          422: ApiFailureSchema,
          503: ApiFailureSchema
        }
      }
    },
    async (request, reply) => {
      if (componentMissing()) {
        return reply
          .code(422)
          .send(fail("COMPONENT_NOT_INSTALLED", "视频去字幕能力尚未安装，请前往设置 → 能力管理安装。"));
      }
      const tempId = `detect-${nanoid(12)}`;
      const tempDir = path.join(config.videoAiInputsDir, tempId);
      await fs.mkdir(tempDir, { recursive: true });
      try {
        const file = await request.file({
          limits: { files: 1, fields: 0, parts: 1, fileSize: VIDEO_AI_MAX_FILE_BYTES }
        });
        if (!file) return reply.code(400).send(fail("FILE_REQUIRED", "请选择一个视频文件"));
        if (file.fieldname !== "video") {
          file.file.resume();
          throw validationError("FILE_REQUIRED", "请选择 video 字段中的视频");
        }
        assertVideoExtension(file.filename);
        const destination = path.join(tempDir, "input.bin");
        const stored = await storeStream(file.file, destination, VIDEO_AI_MAX_FILE_BYTES);
        if (file.file.truncated) throw validationError("FILE_TOO_LARGE", "上传文件超过大小限制");
        if (!stored.size) throw Object.assign(new Error("上传的视频为空文件"), { code: "EMPTY_FILE" });
        await probeVideo(config, stored.path, new AbortController().signal);
        return ok(await manager.detect(stored.path));
      } catch (error) {
        const info = routeError(error);
        return reply.code(info.status).send(fail(info.code, info.message));
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    }
  );

  app.post(
    "/api/v1/tools/video-ai/tasks",
    {
      config: REQUEST_QUOTAS.ai,
      schema: {
        response: {
          202: apiSuccessSchema(VideoAiTaskSchema),
          400: ApiFailureSchema,
          409: ApiFailureSchema,
          413: ApiFailureSchema,
          422: ApiFailureSchema,
          429: ApiFailureSchema,
          503: ApiFailureSchema
        }
      }
    },
    async (request, reply) => {
      if (componentMissing()) {
        return reply
          .code(422)
          .send(fail("COMPONENT_NOT_INSTALLED", "视频去字幕能力尚未安装，请前往设置 → 能力管理安装。"));
      }
      if (manager.outputBytesTotal() >= VIDEO_AI_MAX_STORAGE_BYTES) {
        return reply
          .code(409)
          .send(fail("VIDEO_AI_STORAGE_FULL", "视频去字幕结果已占用 20 GiB，请先删除部分历史结果再提交"));
      }
      const releaseReservation = manager.tryReserveSlot();
      if (!releaseReservation) {
        return reply.code(429).send(fail("VIDEO_AI_QUEUE_FULL", "视频任务队列已满，请稍后再试"));
      }

      const taskId = nanoid(12);
      const inputDir = path.join(config.videoAiInputsDir, taskId);
      let storedPath: string | undefined;
      try {
        await fs.mkdir(inputDir, { recursive: true });
        let mode = "delogo";
        let inputName = "video.mp4";
        let manualArea: VideoAiRect | undefined;
        let segments: VideoAiSegment[] | undefined;
        let manualRanges: string | undefined;
        let uploaded = 0;
        const fields = new Set<string>();
        for await (const part of request.parts({
          limits: { files: 1, fields: 3, parts: 4, fileSize: VIDEO_AI_MAX_FILE_BYTES }
        })) {
          if (part.type === "field") {
            if (
              !["mode", "manualArea", "segments", "manualRanges"].includes(part.fieldname) ||
              fields.has(part.fieldname)
            )
              throw validationError("INVALID_FIELD", "包含未知或重复字段");
            fields.add(part.fieldname);
            if (part.fieldname === "mode") mode = String(part.value ?? "");
            if (part.fieldname === "manualArea") manualArea = parseManualArea(String(part.value ?? ""));
            if (part.fieldname === "segments") segments = parseSegments(String(part.value ?? ""));
            if (part.fieldname === "manualRanges") manualRanges = String(part.value ?? "");
            continue;
          }
          if (part.fieldname !== "video") {
            part.file.resume();
            throw validationError("FILE_REQUIRED", "请选择 video 字段中的视频");
          }
          if (uploaded > 0) throw validationError("TOO_MANY_FILES", "一次只能处理一个视频");
          assertVideoExtension(part.filename);
          inputName = path.basename(part.filename || "video.mp4");
          const stored = await storeStream(part.file, path.join(inputDir, "input.bin"), VIDEO_AI_MAX_FILE_BYTES);
          if (part.file.truncated) throw validationError("FILE_TOO_LARGE", "上传文件超过大小限制");
          if (!stored.size) throw validationError("EMPTY_FILE", "上传的视频为空文件");
          storedPath = stored.path;
          uploaded += 1;
        }
        if (!storedPath) throw validationError("FILE_REQUIRED", "请选择一个视频文件");
        if (!isVideoAiModeValue(mode)) throw validationError("INVALID_MODE", "不支持的修复档位");
        await manager.ensureStorageCapacity((await fs.stat(storedPath)).size);
        const metadata = await probeVideo(config, storedPath, new AbortController().signal);
        if (manualRanges !== undefined) {
          if (manualArea || segments) throw validationError("INVALID_SEGMENTS", "手动区间不可与其他区域配置同时提交");
          segments = manualRangesToSegments(manualRanges, metadata);
        }
        const health = await manager.worker.health();
        const engine = health.engines.find((engine) => engine.provider === mode);
        if (!health.available || !engine?.available)
          throw validationError("VIDEO_AI_MODE_UNAVAILABLE", engine?.reason || "所选修复引擎尚未安装，请选择可用档位");

        const task = await manager.create({
          id: taskId,
          mode,
          inputPath: storedPath,
          inputName,
          inputBytes: (await fs.stat(storedPath)).size,
          manualArea,
          segments
        });
        return reply.code(202).send(ok(task));
      } catch (error) {
        await fs.rm(inputDir, { recursive: true, force: true });
        const info = routeError(error);
        return reply.code(info.status).send(fail(info.code, info.message));
      } finally {
        releaseReservation();
      }
    }
  );
}

function assertVideoExtension(filename: string | undefined) {
  const extension = path.extname(filename ?? "").toLowerCase();
  if (!(VIDEO_AI_ALLOWED_EXTENSIONS as readonly string[]).includes(extension)) {
    throw validationError("UNSUPPORTED_CONTAINER", "仅支持 MP4、MKV、AVI、MOV、WebM 视频");
  }
}

function parseManualArea(raw: string): VideoAiRect | undefined {
  if (!raw) return undefined;
  try {
    const value = JSON.parse(raw) as unknown;
    if (!isRectValue(value)) throw new Error("invalid rect");
    return { x: value.x, y: value.y, width: value.width, height: value.height };
  } catch {
    throw validationError("INVALID_MANUAL_AREA", "手动框选区域格式无效");
  }
}

function parseSegments(raw: string): VideoAiSegment[] | undefined {
  if (!raw) return undefined;
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value) || !value.every(isSegmentValue) || value.length > 20) throw new Error("invalid segments");
    return value.map((segment) => ({
      rect: segment.rect,
      startFrame: segment.startFrame,
      endFrame: segment.endFrame
    }));
  } catch {
    throw validationError("INVALID_SEGMENTS", "字幕区域列表格式无效");
  }
}

function isRectValue(value: unknown): value is VideoAiRect {
  if (typeof value !== "object" || value === null) return false;
  const rect = value as { x?: unknown; y?: unknown; width?: unknown; height?: unknown };
  const inRange = (candidate: unknown): candidate is number =>
    typeof candidate === "number" && Number.isFinite(candidate) && candidate >= 0 && candidate <= 1;
  return (
    inRange(rect.x) &&
    inRange(rect.y) &&
    inRange(rect.width) &&
    inRange(rect.height) &&
    rect.width > 0 &&
    rect.height > 0 &&
    rect.x + rect.width <= 1.000001 &&
    rect.y + rect.height <= 1.000001
  );
}

function isSegmentValue(value: unknown): value is VideoAiSegment {
  if (typeof value !== "object" || value === null) return false;
  const segment = value as Record<string, unknown>;
  return (
    isRectValue(segment.rect) &&
    typeof segment.startFrame === "number" &&
    typeof segment.endFrame === "number" &&
    Number.isSafeInteger(segment.startFrame) &&
    Number.isSafeInteger(segment.endFrame) &&
    segment.startFrame >= 0 &&
    segment.endFrame >= segment.startFrame
  );
}

function validationError(code: string, message: string) {
  return Object.assign(new Error(message), { code, status: 422 });
}

async function storeStream(stream: NodeJS.ReadableStream, destination: string, limit: number) {
  const handle = await fs.open(destination, "w");
  let size = 0;
  try {
    for await (const value of stream as AsyncIterable<Buffer | Uint8Array>) {
      const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
      size += chunk.length;
      if (size > limit) throw Object.assign(new Error("上传文件超过大小限制"), { code: "FILE_TOO_LARGE" });
      await handle.writeFile(chunk);
    }
  } catch (error) {
    await handle.close();
    await fs.rm(destination, { force: true });
    throw error;
  }
  await handle.close();
  return { path: destination, size };
}

function routeError(error: unknown): { status: 400 | 409 | 413 | 422 | 503; code: string; message: string } {
  const workerError = error instanceof VideoAiWorkerError ? error : undefined;
  const code =
    workerError?.code || (error instanceof Error && "code" in error ? String(error.code) : "VIDEO_AI_REQUEST_FAILED");
  const message = error instanceof Error ? error.message : "视频处理请求失败";
  const status: 400 | 409 | 413 | 422 | 503 = workerError
    ? workerError.status && workerError.status >= 400 && workerError.status < 500
      ? 422
      : 503
    : code === "FILE_TOO_LARGE" || code === "FST_REQ_FILE_TOO_LARGE"
      ? 413
      : code === "VIDEO_AI_QUEUE_FULL" || code === "VIDEO_AI_TASK_BUSY" || code === "VIDEO_AI_STORAGE_FULL"
        ? 409
        : error instanceof Error && "status" in error && error.status === 422
          ? 422
          : 400;
  return { status, code, message };
}

function toWorkerError(error: unknown) {
  return error instanceof VideoAiWorkerError
    ? error
    : new VideoAiWorkerError("VIDEO_AI_WORKER_UNAVAILABLE", "视频处理服务当前不可用");
}
