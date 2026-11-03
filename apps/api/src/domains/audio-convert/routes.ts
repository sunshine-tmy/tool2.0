import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { ZipArchive } from "archiver";
import { nanoid } from "nanoid";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AUDIO_CONVERT_MAX_BYTES, ok, fail } from "@toolbox/shared";
import type { AppConfig } from "../../config";
import type { ToolboxDatabase } from "../../database/toolbox-database";
import type { TaskStore } from "../../tasks/task-store";
import type { ComponentManager } from "../../modules/components/component-manager";
import type { AudioLibraryStore } from "../audio-library/store";
import { AudioLibraryError } from "../audio-library/errors";
import { REQUEST_QUOTAS } from "../../security/request-quotas";
import { AudioConvertError } from "./errors";
import { resolveAudioTools } from "./media";
import { AudioConversionService } from "./service";
const Id = Type.String({ pattern: "^[A-Za-z0-9_-]{1,80}$" });
const params = Type.Object({ id: Id }, { additionalProperties: false });
const idOf = (r: FastifyRequest) => (r.params as { id: string }).id;
export async function registerAudioConversionRoutes(
  app: FastifyInstance,
  config: AppConfig,
  database: ToolboxDatabase,
  tasks: TaskStore,
  components: ComponentManager,
  library: AudioLibraryStore
) {
  const service = new AudioConversionService(
    config.storageRoot,
    database,
    tasks,
    () => resolveAudioTools(config, components),
    () => app.log.error("AUDIO_CONVERT_STORAGE_FAILED")
  );
  await service.initialize();
  const root = "/api/v1/tools/audio-convert";
  const wrap =
    (fn: (r: FastifyRequest, p: FastifyReply) => Promise<unknown>) => async (r: FastifyRequest, p: FastifyReply) => {
      try {
        return await fn(r, p);
      } catch (e) {
        if (e instanceof AudioConvertError || e instanceof AudioLibraryError)
          return p.code(e.status).send(fail(e.code, e.message));
        if ((e as { code?: string })?.code === "FST_REQ_FILE_TOO_LARGE")
          return p.code(413).send(fail("AUDIO_CONVERT_FILE_SIZE", "单个文件最大 100 MiB"));
        if (
          ["FST_FILES_LIMIT", "FST_FIELDS_LIMIT", "FST_PARTS_LIMIT", "FST_INVALID_MULTIPART_CONTENT_TYPE"].includes(
            String((e as { code?: string })?.code)
          )
        )
          return p.code(400).send(fail("AUDIO_CONVERT_INPUT_INVALID", "请每次上传一个文件及对应转换参数"));
        r.log.error("AUDIO_CONVERT_OPERATION_FAILED");
        return p.code(500).send(fail("AUDIO_CONVERT_OPERATION_FAILED", "转换操作失败，请检查磁盘和服务状态"));
      }
    };
  app.get(
    `${root}/jobs`,
    {
      schema: {
        querystring: Type.Object(
          {
            page: Type.Optional(Type.Integer({ minimum: 1 })),
            pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 }))
          },
          { additionalProperties: false }
        )
      }
    },
    wrap(async (r) => {
      const q = r.query as { page?: number; pageSize?: number };
      return ok(service.list(q.page, q.pageSize));
    })
  );
  app.get(
    `${root}/jobs/:id`,
    { schema: { params } },
    wrap(async (r) => ok(service.get(idOf(r))))
  );
  app.get(
    `${root}/completed-selection`,
    wrap(async () => ok(service.completedSelection()))
  );
  app.post(
    `${root}/uploads`,
    { config: REQUEST_QUOTAS.audioConvertUpload },
    wrap(async (r) => {
      const stage = await service.staging();
      let admitted = false;
      try {
        let name = "",
          found = false;
        const fields: Record<string, string> = {};
        for await (const part of r.parts({
          limits: { fileSize: AUDIO_CONVERT_MAX_BYTES, files: 1, fields: 2, fieldSize: 20000 }
        })) {
          if (part.type === "file") {
            if (found) throw new AudioConvertError("AUDIO_CONVERT_INPUT_INVALID", "每次请求只允许一个文件");
            found = true;
            name = part.filename;
            await pipeline(part.file, fs.createWriteStream(path.join(stage.directory, "source"), { flags: "wx" }));
            if (part.file.truncated)
              throw new AudioConvertError("AUDIO_CONVERT_FILE_SIZE", "单个文件最大 100 MiB", 413);
          } else if (typeof part.value === "string" && ["bitrate", "ekey"].includes(part.fieldname))
            fields[part.fieldname] = part.value;
          else throw new AudioConvertError("AUDIO_CONVERT_INPUT_INVALID", "上传参数无效");
        }
        if (!found || !(await fsp.stat(path.join(stage.directory, "source"))).size)
          throw new AudioConvertError("AUDIO_CONVERT_INPUT_INVALID", "请选择非空音频文件");
        const job = await service.enqueue(stage.id, name, Number(fields.bitrate ?? 192), fields.ekey);
        admitted = true;
        return ok(job);
      } finally {
        if (!admitted) await service.discard(stage.id);
      }
    })
  );
  app.post(
    `${root}/jobs/:id/cancel`,
    { schema: { params } },
    wrap(async (r) => {
      await service.cancel(idOf(r));
      return ok(service.get(idOf(r)));
    })
  );
  app.delete(
    `${root}/jobs/:id`,
    { schema: { params } },
    wrap(async (r) => {
      await service.remove(idOf(r));
      return ok({ ok: true });
    })
  );
  app.post(
    `${root}/jobs/:id/library`,
    {
      config: REQUEST_QUOTAS.audioConvertLibrary,
      schema: {
        params,
        body: Type.Object(
          {
            groupId: Type.Union([Id, Type.Null()]),
            purpose: Type.Union([Type.Literal("music"), Type.Literal("speech"), Type.Literal("general")])
          },
          { additionalProperties: false }
        )
      }
    },
    wrap(async (r) => {
      const b = r.body as { groupId: string | null; purpose: "music" | "speech" | "general" };
      return ok(await service.addToLibrary(idOf(r), library, b.groupId, b.purpose));
    })
  );
  app.get(
    `${root}/jobs/:id/audio`,
    { schema: { params }, config: REQUEST_QUOTAS.mediaPreview },
    wrap(async (r, p) => {
      const source = await service.acquire(idOf(r));
      const stream = fs.createReadStream(source.file);
      stream.once("close", source.release);
      stream.once("error", source.release);
      p.raw.once("close", () => {
        stream.destroy();
        source.release();
      });
      return p
        .header("content-type", "audio/mpeg")
        .header("content-length", source.job.bytes!)
        .header(
          "content-disposition",
          `attachment; filename="audio.mp3"; filename*=UTF-8''${encodeURIComponent(source.job.name.replace(/\.[^.]+$/, "") + ".mp3").replaceAll("'", "%27")}`
        )
        .send(stream);
    })
  );
  const downloads = new Map<string, { ids: string[]; expires: number }>();
  app.post(
    `${root}/downloads`,
    {
      config: REQUEST_QUOTAS.batchDownload,
      schema: {
        body: Type.Object(
          { ids: Type.Array(Id, { minItems: 1, maxItems: 1000, uniqueItems: true }) },
          { additionalProperties: false }
        )
      }
    },
    wrap(async (r) => {
      for (const [key, value] of downloads) if (value.expires < Date.now()) downloads.delete(key);
      if (downloads.size >= 20)
        throw new AudioConvertError("AUDIO_CONVERT_DOWNLOAD_BUSY", "下载请求较多，请稍后重试", 429);
      const ids = (r.body as { ids: string[] }).ids;
      for (const id of ids)
        if (service.get(id).status !== "completed")
          throw new AudioConvertError("AUDIO_CONVERT_NOT_READY", "所选结果尚未完成", 409);
      const id = nanoid();
      downloads.set(id, { ids, expires: Date.now() + 60000 });
      return ok({ url: `${root}/downloads/${id}` });
    })
  );
  app.get(
    `${root}/downloads/:id`,
    { config: REQUEST_QUOTAS.batchDownload, schema: { params } },
    wrap(async (r, p) => {
      const ticket = downloads.get(idOf(r));
      downloads.delete(idOf(r));
      if (!ticket || ticket.expires < Date.now())
        throw new AudioConvertError("AUDIO_CONVERT_DOWNLOAD_EXPIRED", "下载已过期，请重新选择下载", 404);
      const sources: Awaited<ReturnType<typeof service.acquire>>[] = [];
      const zip = new ZipArchive({ zlib: { level: 1 } });
      let handed = false;
      const release = () => {
        for (const source of sources) source.release();
      };
      try {
        for (const id of ticket.ids) sources.push(await service.acquire(id));
        zip.once("error", () => {
          release();
          zip.destroy();
        });
        zip.once("end", release);
        p.raw.once("close", () => {
          zip.abort();
          release();
        });
        sources.forEach((s, i) =>
          zip.file(s.file, {
            name: `${i + 1}-${s.job.name.replace(/\.[^.]+$/, "").replace(/[<>:"/\\|?*\p{Cc}]/gu, "_")}.mp3`
          })
        );
        p.header("content-type", "application/zip").header(
          "content-disposition",
          'attachment; filename="converted-audio.zip"'
        );
        void zip.finalize().catch(() => zip.destroy());
        handed = true;
        return p.send(zip);
      } finally {
        if (!handed) release();
      }
    })
  );
  app.addHook("onClose", () => service.close());
  return service;
}
