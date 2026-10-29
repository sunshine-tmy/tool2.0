/** 直播音频库接口：只接受本地上传或可信克隆存储引用，所有资产独立归档。 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { Type } from "@sinclair/typebox";
import { nanoid } from "nanoid";
import {
  AUDIO_LIBRARY_MAX_FILE_BYTES,
  audioLibraryPurpose,
  AudioLibraryEditSchema,
  AudioLibraryImportSchema,
  AudioLibraryPresetInputSchema,
  type AudioLibraryPresetInput,
  ok,
  fail,
  type AudioLibraryEdit,
  type AudioLibraryImport,
  type AudioLibraryImportResult
} from "@toolbox/shared";
import type { AppConfig } from "../../config";
import type { ToolboxDatabase } from "../../database/toolbox-database";
import type { AudioLibrarySpeechSource } from "./types";
import { REQUEST_QUOTAS } from "../../security/request-quotas";
import { AudioLibraryStore } from "./store";
import { AudioLibraryError, reject } from "./errors";
import { inspectAudio } from "./media";
import { exportAudioLibrary, readBackup } from "./backup";

const Id = Type.String({ pattern: "^[A-Za-z0-9_-]{1,80}$" });
const params = Type.Object({ id: Id }, { additionalProperties: false });
const nullableId = Type.Union([Id, Type.Null()]);
const ids = Type.Array(Id, { minItems: 1, maxItems: 100, uniqueItems: true });
const groupBody = Type.Object(
  { name: Type.String({ minLength: 1, maxLength: 60 }), parentId: nullableId },
  { additionalProperties: false }
);
const idOf = (r: FastifyRequest) => (r.params as { id: string }).id;
const wrap =
  (fn: (r: FastifyRequest, p: FastifyReply) => Promise<unknown>) => async (r: FastifyRequest, p: FastifyReply) => {
    try {
      return await fn(r, p);
    } catch (error) {
      if (error instanceof AudioLibraryError) return p.code(error.status).send(fail(error.code, error.message));
      if ((error as { code?: string })?.code === "FST_REQ_FILE_TOO_LARGE")
        return p.code(413).send(fail("AUDIO_LIBRARY_FILE_SIZE", "文件超过大小上限"));
      r.log.error({ err: error }, "audio library operation failed");
      return p.code(500).send(fail("AUDIO_LIBRARY_OPERATION_FAILED", "音频库操作失败，原有素材已保留，请稍后重试"));
    }
  };
export async function registerAudioLibraryRoutes(
  app: FastifyInstance,
  config: AppConfig,
  database: ToolboxDatabase,
  batches: AudioLibrarySpeechSource,
  edgeBatches?: AudioLibrarySpeechSource
) {
  const store = new AudioLibraryStore(config.storageRoot, database, config.audioLibraryMaxStorageBytes);
  // 清单损坏只影响本模块，请求时返回恢复提示，不阻断整个工具箱启动。
  await store.initialize().catch((error) => app.log.error({ err: error }, "audio library needs recovery"));
  const prefix = "/api/v1/tools/audio-library";
  app.get(
    `${prefix}/presets`,
    wrap(async () => ok(await store.presets()))
  );
  app.post(
    `${prefix}/presets`,
    { schema: { body: AudioLibraryPresetInputSchema } },
    wrap(async (r) => ok(await store.savePreset(r.body as AudioLibraryPresetInput)))
  );
  app.patch(
    `${prefix}/presets/:id`,
    { schema: { params, body: AudioLibraryPresetInputSchema } },
    wrap(async (r) => ok(await store.savePreset(r.body as AudioLibraryPresetInput, idOf(r))))
  );
  app.delete(
    `${prefix}/presets/:id`,
    {
      schema: { params, body: Type.Object({ revision: Type.Integer({ minimum: 1 }) }, { additionalProperties: false }) }
    },
    wrap(async (r) => {
      await store.deletePreset(idOf(r), (r.body as { revision: number }).revision);
      return ok({ ok: true });
    })
  );
  app.get(
    `${prefix}/presets/:id/load`,
    { schema: { params } },
    wrap(async (r) => ok(await store.loadPreset(idOf(r))))
  );
  app.get(
    `${prefix}/items`,
    wrap(async (r) => ok(await store.list(r.query as Record<string, string>)))
  );
  app.post(
    `${prefix}/items/resolve`,
    { schema: { body: Type.Object({ ids: Type.Array(Id, { maxItems: 200 }) }, { additionalProperties: false }) } },
    wrap(async (r) => {
      const selected = (r.body as { ids: string[] }).ids,
        c = await store.snapshot();
      return ok(
        await Promise.all(c.items.filter((x) => selected.includes(x.id) && !x.deletedAt).map((x) => store.view(x)))
      );
    })
  );
  app.get(
    `${prefix}/items/:id`,
    { schema: { params } },
    wrap(async (r) => ok(await store.view(await store.item(idOf(r)))))
  );
  app.patch(
    `${prefix}/items/:id`,
    { schema: { params, body: AudioLibraryEditSchema } },
    wrap(async (r) => ok(await store.view(await store.edit(idOf(r), r.body as AudioLibraryEdit))))
  );
  app.post(
    `${prefix}/groups`,
    { schema: { body: groupBody } },
    wrap(async (r) => ok(await store.group(r.body as { name: string; parentId: string | null })))
  );
  app.patch(
    `${prefix}/groups/:id`,
    { schema: { params, body: groupBody } },
    wrap(async (r) => ok(await store.group({ ...(r.body as { name: string; parentId: string | null }), id: idOf(r) })))
  );
  app.delete(
    `${prefix}/groups/:id`,
    { schema: { params } },
    wrap(async (r) => {
      await store.removeGroup(idOf(r));
      return ok({ ok: true });
    })
  );
  app.post(
    `${prefix}/items/batch-move`,
    { schema: { body: Type.Object({ ids, groupId: nullableId }, { additionalProperties: false }) } },
    wrap(async (r) => {
      const body = r.body as { ids: string[]; groupId: string | null };
      return ok({ ok: true, undoToken: await store.move(body.ids, body.groupId) });
    })
  );
  app.post(
    `${prefix}/undo/:id`,
    { schema: { params } },
    wrap(async (r) => {
      await store.undo(idOf(r));
      return ok({ ok: true });
    })
  );
  app.post(
    `${prefix}/items/batch-trash`,
    { schema: { body: Type.Object({ ids, restore: Type.Optional(Type.Boolean()) }, { additionalProperties: false }) } },
    wrap(async (r) => {
      const body = r.body as { ids: string[]; restore?: boolean };
      await store.trash(body.ids, body.restore);
      return ok({ ok: true });
    })
  );
  app.delete(
    `${prefix}/items/:id`,
    { schema: { params } },
    wrap(async (r) => {
      await store.trash([idOf(r)]);
      return ok({ ok: true });
    })
  );
  app.post(
    `${prefix}/items/:id/restore`,
    { schema: { params } },
    wrap(async (r) => {
      await store.trash([idOf(r)], true);
      return ok({ ok: true });
    })
  );
  app.delete(
    `${prefix}/trash/:id`,
    { schema: { params } },
    wrap(async (r) => {
      await store.purge(idOf(r));
      return ok({ ok: true });
    })
  );
  app.post(
    `${prefix}/items/:id/clips`,
    { config: REQUEST_QUOTAS.lanUpload, schema: { params } },
    wrap(async (r) => {
      const source = await store.item(idOf(r));
      if (source.deletedAt) reject("AUDIO_LIBRARY_NOT_FOUND", "原音频已在回收站", 404);
      const directory = await store.staging(),
        token = nanoid();
      const release = store.pin([source.id]);
      try {
        const received = await receiveUpload(r, directory, AUDIO_LIBRARY_MAX_FILE_BYTES, (bytes) =>
          store.reserve(token, bytes)
        );
        const start = Number(received.fields.startSeconds),
          end = Number(received.fields.endSeconds);
        const revision = Number(received.fields.revision);
        if (
          !Number.isFinite(start) ||
          !Number.isFinite(end) ||
          start < 0 ||
          end - start < 0.05 - 1e-6 ||
          end > source.duration + 0.001
        )
          reject("AUDIO_LIBRARY_CLIP_RANGE", "裁剪范围无效，结束时间须晚于开始时间且不超过原音频时长");
        if (!Number.isSafeInteger(revision) || revision !== source.revision)
          reject("AUDIO_LIBRARY_CONFLICT", "原音频已被修改，请刷新后重新裁剪", 409);
        const audio = await inspectAudio(received.file);
        if (audio.fileName !== "audio.wav" || Math.abs(audio.duration - (end - start)) > 0.05)
          reject("AUDIO_LIBRARY_CLIP_INVALID", "裁剪文件须为有效 PCM WAV，且时长与选区一致", 415);
        await fsp.rename(received.file, path.join(directory, audio.fileName));
        return ok(
          await store.add(
            {
              ...audio,
              title: `${source.title.slice(0, 110)} · 裁剪`,
              language: source.language,
              foreignText: source.foreignText,
              chineseText: source.chineseText,
              note: source.note,
              purpose: audioLibraryPurpose(source),
              groupId: source.groupId,
              source: {
                kind: "clip",
                originalItemId: source.id,
                originalRevision: revision,
                startSeconds: start,
                endSeconds: end
              }
            },
            directory,
            token,
            true
          )
        );
      } finally {
        release();
        store.release(token);
        await fsp.rm(directory, { recursive: true, force: true });
      }
    })
  );
  app.post(
    `${prefix}/uploads`,
    { config: REQUEST_QUOTAS.lanUpload },
    wrap(async (r) => {
      const directory = await store.staging(),
        token = nanoid();
      try {
        const received = await receiveUpload(r, directory, AUDIO_LIBRARY_MAX_FILE_BYTES, (bytes) =>
          store.reserve(token, bytes)
        );
        const audio = await inspectAudio(received.file);
        await fsp.rename(received.file, path.join(directory, audio.fileName));
        const fields = received.fields;
        if (fields.purpose && !["general", "speech", "music"].includes(fields.purpose))
          reject("AUDIO_LIBRARY_PURPOSE_INVALID", "音频用途无效");
        const result = await store.add(
          {
            ...audio,
            title: (fields.title?.trim() || path.parse(received.name).name || "未命名音频").slice(0, 120),
            purpose: (fields.purpose || "general") as "general" | "speech" | "music",
            language: (fields.language?.trim() || "und").slice(0, 50),
            foreignText: fields.foreignText || "",
            chineseText: fields.chineseText || "",
            note: fields.note || "",
            groupId: fields.groupId?.trim() && fields.groupId.trim() !== "null" ? fields.groupId.trim() : null,
            source: { kind: "upload", originalName: received.name.slice(0, 255) }
          },
          directory,
          token,
          fields.keepDuplicate === "true"
        );
        return ok(result);
      } finally {
        store.release(token);
        await fsp.rm(directory, { recursive: true, force: true });
      }
    })
  );
  for (const engine of ["chatterbox", "edge-tts"] as const)
    app.post(
      `${prefix}/imports/${engine}`,
      { config: REQUEST_QUOTAS.voice, schema: { body: AudioLibraryImportSchema } },
      wrap(async (r) => {
        const input = r.body as AudioLibraryImport;
        const sourceBatches = engine === "chatterbox" ? batches : edgeBatches;
        if (!sourceBatches) reject("AUDIO_LIBRARY_SOURCE_MISSING", "在线配音批次不可用", 404);
        const results: AudioLibraryImportResult["results"] = [];
        for (const itemId of input.itemIds) {
          const directory = await store.staging(),
            token = nanoid();
          try {
            const prepared = await sourceBatches.withArtifact(input.batchId, async () => {
              const batch = await sourceBatches.get(input.batchId),
                item = batch?.items.find((x) => x.id === itemId);
              if (!batch || !item) reject("AUDIO_LIBRARY_SOURCE_MISSING", "原批次或文案段已不存在", 404);
              if (item.status !== "completed") return undefined;
              if (item.error)
                reject(
                  "AUDIO_LIBRARY_SOURCE_UNCERTAIN",
                  "该段重生成曾失败，请成功重生成后添加，避免保存与文案不对应的旧音频",
                  409
                );
              if (input.attempts?.[itemId] !== undefined && input.attempts[itemId] !== item.attempt)
                reject("AUDIO_LIBRARY_SOURCE_CHANGED", "该段已重新生成，请刷新后添加", 409);
              const source = sourceBatches.itemPaths(input.batchId, itemId).audio;
              const stat = await fsp.stat(source);
              store.reserve(token, stat.size);
              const staged = path.join(directory, "source");
              await fsp.copyFile(source, staged);
              const audio = await inspectAudio(staged);
              await fsp.rename(staged, path.join(directory, audio.fileName));
              return {
                ...audio,
                title: (item.fileName || item.text.replace(/\s+/g, " ").slice(0, 40) || "克隆音频").slice(0, 120),
                language:
                  ({ "ms-MY": "ms", "en-US": "en", "en-GB": "en" } as Record<string, string>)[batch.language] ||
                  batch.language,
                foreignText: item.text,
                chineseText: item.referenceTranslation || "",
                groupId: input.groupId ?? null,
                note: "",
                source: {
                  kind: engine,
                  batchId: batch.id,
                  itemId: item.id,
                  attempt: item.attempt,
                  originalText: item.text,
                  originalTranslation: item.referenceTranslation || ""
                }
              };
            });
            if (!prepared) {
              results.push({ sourceId: itemId, status: "skipped", message: "该段尚未生成成功" });
              continue;
            }
            const saved = await store.add(prepared, directory, token);
            results.push({ sourceId: itemId, status: saved.existing ? "existing" : "added", item: saved.item });
          } catch (error) {
            results.push({
              sourceId: itemId,
              status: "failed",
              message: error instanceof AudioLibraryError ? error.message : "源音频无法读取或保存，请检查文件后重试"
            });
          } finally {
            store.release(token);
            await fsp.rm(directory, { recursive: true, force: true });
          }
        }
        return ok({ results });
      })
    );
  app.get(
    `${prefix}/items/:id/audio`,
    { config: REQUEST_QUOTAS.mediaPreview, schema: { params } },
    wrap(async (r, p) => {
      const item = await store.item(idOf(r));
      if (item.deletedAt) reject("AUDIO_LIBRARY_MEDIA_UNAVAILABLE", "素材已在回收站", 404);
      const file = store.file(item),
        stat = await fsp.stat(file).catch(() => undefined);
      if (!stat?.isFile() || stat.size !== item.bytes)
        reject("AUDIO_LIBRARY_MEDIA_UNAVAILABLE", "音频文件缺失或损坏，文案仍保留", 404);
      p.header("content-type", item.mimeType)
        .header("accept-ranges", "bytes")
        .header("x-content-type-options", "nosniff")
        .header("cache-control", "private, no-cache");
      let start = 0,
        end = stat.size - 1;
      const range = r.headers.range;
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!match || (!match[1] && !match[2]))
          return p.code(416).header("content-range", `bytes */${stat.size}`).send();
        if (!match[1]) start = Math.max(0, stat.size - Number(match[2]));
        else {
          start = Number(match[1]);
          if (match[2]) end = Math.min(end, Number(match[2]));
        }
        if (!Number.isSafeInteger(start) || start > end || start >= stat.size)
          return p.code(416).header("content-range", `bytes */${stat.size}`).send();
        p.code(206).header("content-range", `bytes ${start}-${end}/${stat.size}`);
      }
      p.header("content-length", end - start + 1);
      return p.send(fs.createReadStream(file, { start, end }));
    })
  );
  app.post(
    `${prefix}/exports`,
    {
      config: REQUEST_QUOTAS.batchDownload,
      schema: { body: Type.Object({ ids: Type.Optional(ids) }, { additionalProperties: false }) }
    },
    wrap(async (r, p) => exportAudioLibrary(store, p, (r.body as { ids?: string[] }).ids))
  );
  app.get(
    `${prefix}/backup`,
    { config: REQUEST_QUOTAS.batchDownload },
    wrap(async (_r, p) => exportAudioLibrary(store, p))
  );
  app.get(
    `${prefix}/exports`,
    { config: REQUEST_QUOTAS.batchDownload },
    wrap(async (r, p) => {
      const selected = ((r.query as { ids?: string }).ids || "").split(",").filter(Boolean);
      if (!selected.length || selected.length > 100) reject("AUDIO_LIBRARY_EXPORT_INVALID", "请选择 1–100 条素材");
      return exportAudioLibrary(store, p, selected);
    })
  );
  app.post(
    `${prefix}/backup/restore`,
    { config: REQUEST_QUOTAS.batchDownload },
    wrap(async (r) => {
      const directory = await store.staging(),
        token = nanoid();
      try {
        const received = await receiveUpload(r, directory, store.maxBytes + 64 * 1024 * 1024);
        const catalog = await readBackup(received.file, directory, store, token);
        return ok(await store.restore(catalog, directory, token));
      } finally {
        store.release(token);
        await fsp.rm(directory, { recursive: true, force: true });
      }
    })
  );
  return store;
}
async function receiveUpload(
  request: FastifyRequest,
  directory: string,
  maxBytes: number,
  reserve?: (bytes: number) => void
) {
  const fields: Record<string, string> = {};
  let file = "",
    name = "";
  for await (const part of request.parts({ limits: { fileSize: maxBytes, files: 1, fields: 12, fieldSize: 40000 } })) {
    if (part.type === "file") {
      if (file) reject("AUDIO_LIBRARY_UPLOAD_INVALID", "每次请求仅支持一个文件");
      file = path.join(directory, "upload");
      name = path.basename(part.filename);
      await pipeline(
        part.file,
        new Transform({
          transform(chunk, _encoding, callback) {
            try {
              reserve?.(chunk.length);
              callback(null, chunk);
            } catch (error) {
              callback(error as Error);
            }
          }
        }),
        fs.createWriteStream(file, { flags: "wx" })
      );
      if (part.file.truncated) reject("AUDIO_LIBRARY_FILE_SIZE", "文件超过大小上限", 413);
    } else if (typeof part.value === "string") fields[part.fieldname] = part.value;
  }
  if (!file) reject("AUDIO_LIBRARY_UPLOAD_INVALID", "请选择要上传的文件");
  return { fields, file, name };
}
