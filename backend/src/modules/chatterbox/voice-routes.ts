import fs from "node:fs";
import fsp from "node:fs/promises";
import type { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import {
  ApiFailureSchema,
  CHATTERBOX_LANGUAGES,
  ChatterboxRemovalSchema,
  ChatterboxSavedVoiceListSchema,
  ChatterboxSavedVoiceSchema,
  ChatterboxVoiceIdParamsSchema,
  apiSuccessSchema,
  fail,
  ok,
  type ChatterboxLanguage,
  type ChatterboxSavedVoiceList,
  type ChatterboxVoiceAuthorization,
  type ChatterboxVoiceIdParams
} from "@toolbox/shared";
import { REQUEST_QUOTAS } from "../../security/request-quotas";
import { sanitizeFileName, toPublicVoice } from "./batch-artifacts";
import type { ChatterboxMediaTools } from "./batch-queue";
import { BatchInputError, mapBatchError } from "./errors";
import { receiveBatchMultipart } from "./batch-input";
import type { ChatterboxVoiceStore } from "./stores";

export function registerChatterboxVoiceRoutes(
  app: FastifyInstance,
  voiceStore: ChatterboxVoiceStore,
  media: ChatterboxMediaTools
) {
  app.get(
    "/api/v1/tools/edge-tts/chatterbox/voices",
    { schema: { response: { 200: apiSuccessSchema(ChatterboxSavedVoiceListSchema) } } },
    async () => {
      const data: ChatterboxSavedVoiceList = { voices: voiceStore.list().map(toPublicVoice) };
      return ok(data);
    }
  );

  app.post(
    "/api/v1/tools/edge-tts/chatterbox/voices",
    {
      config: REQUEST_QUOTAS.voice,
      schema: {
        response: {
          201: apiSuccessSchema(ChatterboxSavedVoiceSchema),
          400: ApiFailureSchema,
          404: ApiFailureSchema,
          409: ApiFailureSchema,
          413: ApiFailureSchema,
          429: ApiFailureSchema
        }
      }
    },
    async (request, reply) => {
      const voiceId = nanoid(12);
      const paths = voiceStore.paths(voiceId);
      await fsp.mkdir(paths.dir, { recursive: true });
      try {
        const uploaded = await receiveBatchMultipart(request.parts(), paths.upload, true);
        const name = uploaded.fields.name?.trim();
        if (!name) throw new BatchInputError("CHATTERBOX_VOICE_NAME_REQUIRED", "请输入音色名称", 400);
        if (!isLanguage(uploaded.fields.language)) {
          throw new BatchInputError("CHATTERBOX_LANGUAGE_INVALID", "仅支持马来语、英语或巴西葡萄牙语", 400);
        }
        if (!isAuthorization(uploaded.fields.authorization)) {
          throw new BatchInputError("CHATTERBOX_AUTHORIZATION_REQUIRED", "请选择声音授权来源", 400);
        }
        if (uploaded.fields.consentConfirmed !== "true") {
          throw new BatchInputError("CHATTERBOX_CONSENT_REQUIRED", "必须确认已获得参考声音的合法授权", 400);
        }
        const durationSeconds = await media.normalizeReference(paths.upload, paths.audio);
        const audioBytes = (await fsp.stat(paths.audio)).size;
        const voice = await voiceStore.create({
          id: voiceId,
          name: sanitizeFileName(name),
          language: uploaded.fields.language,
          originalFileName: uploaded.referenceFileName,
          durationSeconds,
          audioBytes,
          authorization: uploaded.fields.authorization,
          consentConfirmed: true
        });
        return reply.code(201).send(ok(toPublicVoice(voice)));
      } catch (error) {
        await fsp.rm(paths.dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
        const mapped = mapBatchError(error);
        return reply.code(mapped.statusCode).send(fail(mapped.code, mapped.message));
      }
    }
  );

  app.get<{ Params: ChatterboxVoiceIdParams }>(
    "/api/v1/tools/edge-tts/chatterbox/voices/:voiceId/audio",
    { schema: { params: ChatterboxVoiceIdParamsSchema } },
    async (request, reply) => {
      const voiceId = voiceIdFrom(request.params);
      const voice = voiceStore.get(voiceId);
      if (!voice) return reply.code(404).send(fail("CHATTERBOX_VOICE_NOT_FOUND", "保存的参考音色不存在"));
      try {
        const stat = await fsp.stat(voiceStore.paths(voiceId).audio);
        reply.header("content-type", "audio/wav");
        reply.header("content-length", String(stat.size));
        reply.header("cache-control", "private, max-age=3600");
        reply.header("x-content-type-options", "nosniff");
        return reply.send(fs.createReadStream(voiceStore.paths(voiceId).audio));
      } catch {
        return reply.code(404).send(fail("CHATTERBOX_FILE_NOT_FOUND", "参考音色文件不存在"));
      }
    }
  );

  app.delete<{ Params: ChatterboxVoiceIdParams }>(
    "/api/v1/tools/edge-tts/chatterbox/voices/:voiceId",
    {
      schema: {
        params: ChatterboxVoiceIdParamsSchema,
        response: { 200: apiSuccessSchema(ChatterboxRemovalSchema), 404: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const voiceId = voiceIdFrom(request.params);
      if (!voiceStore.get(voiceId)) {
        return reply.code(404).send(fail("CHATTERBOX_VOICE_NOT_FOUND", "保存的参考音色不存在"));
      }
      await voiceStore.remove(voiceId);
      return ok({ removed: true });
    }
  );
}

function isLanguage(value: unknown): value is ChatterboxLanguage {
  return typeof value === "string" && (CHATTERBOX_LANGUAGES as readonly string[]).includes(value);
}

function isAuthorization(value: unknown): value is ChatterboxVoiceAuthorization {
  return value === "self" || value === "authorized";
}

function voiceIdFrom(params: unknown) {
  return isRecord(params) && typeof params.voiceId === "string" ? params.voiceId : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
