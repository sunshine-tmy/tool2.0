import type { FastifyInstance } from "fastify";
import {
  ApiFailureSchema,
  EDGE_TTS_LANGUAGES,
  EdgeTtsCreateTaskInputSchema,
  EdgeTtsHealthSchema,
  EdgeTtsRemovalSchema,
  EdgeTtsTaskListQuerySchema,
  EdgeTtsTaskListSchema,
  EdgeTtsTaskSchema,
  EdgeTtsVoiceQuerySchema,
  EdgeTtsVoicesSchema,
  TaskIdParamsSchema,
  apiSuccessSchema,
  fail,
  ok,
  type EdgeTtsCreateTaskInput,
  type EdgeTtsTaskListQuery,
  type EdgeTtsVoiceQuery,
  type TaskIdParams
} from "@toolbox/shared";
import type { AppConfig } from "../../config";
import type { ToolboxDatabase } from "../../database/toolbox-database";
import type { FileMetadataRepository } from "../../database/file-metadata";
import { REQUEST_QUOTAS } from "../../security/request-quotas";
import type { TaskStore } from "../../tasks/task-store";
import { sendTaskFile } from "./files";
import { parseCreateInput } from "./input";
import { EdgeTtsTaskService, toPublicTask } from "./task-service";

type RegisterEdgeTtsRoutesOptions = {
  app: FastifyInstance;
  config: AppConfig;
  database: ToolboxDatabase;
  taskStore: TaskStore;
  fileMetadata?: FileMetadataRepository;
};

export async function registerEdgeTtsRoutes({
  app,
  config,
  database,
  taskStore,
  fileMetadata
}: RegisterEdgeTtsRoutesOptions) {
  const service = new EdgeTtsTaskService(config, database, taskStore, fileMetadata);
  await service.initialize();

  app.addHook("onClose", async () => {
    await service.close();
  });

  app.get(
    "/api/v1/tools/edge-tts/health",
    { schema: { response: { 200: apiSuccessSchema(EdgeTtsHealthSchema) } } },
    async () => ok(await service.health())
  );

  app.get<{ Querystring: EdgeTtsVoiceQuery }>(
    "/api/v1/tools/edge-tts/voices",
    {
      schema: {
        querystring: EdgeTtsVoiceQuerySchema,
        response: { 200: apiSuccessSchema(EdgeTtsVoicesSchema), 400: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const query = request.query;
      if (query.language && !isSupportedLanguage(query.language)) {
        return reply.code(400).send(fail("EDGE_TTS_LANGUAGE_INVALID", "不支持该语言"));
      }
      const result = await service.getVoices();
      const voices = result.voices.filter((voice) => !query.language || voice.locale === query.language);
      return ok({ voices, source: result.source });
    }
  );

  app.post(
    "/api/v1/tools/edge-tts/tasks",
    {
      config: REQUEST_QUOTAS.voice,
      schema: {
        body: EdgeTtsCreateTaskInputSchema,
        response: {
          202: apiSuccessSchema(EdgeTtsTaskSchema),
          400: ApiFailureSchema,
          409: ApiFailureSchema,
          413: ApiFailureSchema,
          429: ApiFailureSchema
        }
      }
    },
    async (request, reply) => {
      const parsed = parseCreateInput(request.body, service.getAllowedVoiceNames());
      if (!parsed.success) return reply.code(parsed.statusCode).send(fail(parsed.code, parsed.message));
      const result = await service.create(parsed.value);
      if (!result.success) return reply.code(result.statusCode).send(fail(result.code, result.message));
      return reply.code(202).send(ok(toPublicTask(result.task)));
    }
  );

  app.get<{ Querystring: EdgeTtsTaskListQuery }>(
    "/api/v1/tools/edge-tts/tasks",
    {
      schema: {
        querystring: EdgeTtsTaskListQuerySchema,
        response: { 200: apiSuccessSchema(EdgeTtsTaskListSchema) }
      }
    },
    async (request) => {
      const page = positiveInteger(request.query.page, 1);
      const pageSize = Math.min(50, positiveInteger(request.query.pageSize, 10));
      return ok(service.list(page, pageSize));
    }
  );

  app.get<{ Params: TaskIdParams }>(
    "/api/v1/tools/edge-tts/tasks/:taskId",
    {
      schema: {
        params: TaskIdParamsSchema,
        response: { 200: apiSuccessSchema(EdgeTtsTaskSchema), 404: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const task = service.get(request.params.taskId);
      if (!task) return reply.code(404).send(fail("EDGE_TTS_TASK_NOT_FOUND", "语音任务不存在"));
      return ok(task);
    }
  );

  app.get<{ Params: TaskIdParams }>(
    "/api/v1/tools/edge-tts/tasks/:taskId/audio",
    { schema: { params: TaskIdParamsSchema, response: { 404: ApiFailureSchema, 409: ApiFailureSchema } } },
    async (request, reply) => sendTaskFile(service, request.params.taskId, "audio", reply, false)
  );

  app.get<{ Params: TaskIdParams }>(
    "/api/v1/tools/edge-tts/tasks/:taskId/download",
    { schema: { params: TaskIdParamsSchema, response: { 404: ApiFailureSchema, 409: ApiFailureSchema } } },
    async (request, reply) => sendTaskFile(service, request.params.taskId, "audio", reply, true)
  );

  app.get<{ Params: TaskIdParams }>(
    "/api/v1/tools/edge-tts/tasks/:taskId/subtitle",
    { schema: { params: TaskIdParamsSchema, response: { 404: ApiFailureSchema, 409: ApiFailureSchema } } },
    async (request, reply) => sendTaskFile(service, request.params.taskId, "subtitle", reply, true)
  );

  app.delete<{ Params: TaskIdParams }>(
    "/api/v1/tools/edge-tts/tasks/:taskId",
    {
      schema: {
        params: TaskIdParamsSchema,
        response: { 200: apiSuccessSchema(EdgeTtsRemovalSchema), 404: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      if (!(await service.remove(request.params.taskId))) {
        return reply.code(404).send(fail("EDGE_TTS_TASK_NOT_FOUND", "语音任务不存在"));
      }
      return ok({ removed: true as const });
    }
  );
}

function isSupportedLanguage(value: string): value is EdgeTtsCreateTaskInput["language"] {
  return (EDGE_TTS_LANGUAGES as readonly string[]).includes(value);
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}
