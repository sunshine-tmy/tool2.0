/** Local uploads and opaque IDs only. All existing application security hooks remain in scope. */
import fs from "node:fs";
import fsp from "node:fs/promises";
import { createHash } from "node:crypto";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { ZipArchive } from "archiver";
import { nanoid } from "nanoid";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { ok, fail } from "@toolbox/shared/common";
import {
  AUDIO_EXTRACT_MAX_BYTES,
  AudioExtractInputSchema,
  type AudioExtractInput
} from "@toolbox/shared/audio-extract";
import type { AppConfig } from "../../config";
import type { ToolboxDatabase } from "../../database/toolbox-database";
import type { TaskStore } from "../../tasks/task-store";
import type { ComponentManager } from "../../modules/components/component-manager";
import { resolveFfmpegTools } from "../../core/media/runtime";
import type { AudioLibraryStore } from "../audio-library/store";
import { AudioLibraryError } from "../audio-library/errors";
import { REQUEST_QUOTAS } from "../../security/request-quotas";
import { AudioExtractError } from "./errors";
import { AudioExtractionService } from "./service";
const params = Type.Object({ id: Type.String({ pattern: "^[A-Za-z0-9_-]{1,80}$" }) }, { additionalProperties: false });
const ids = Type.Array(Type.String({ pattern: "^[A-Za-z0-9_-]{1,80}$" }), {
  minItems: 1,
  maxItems: 1000,
  uniqueItems: true
});
const idOf = (r: FastifyRequest) => (r.params as { id: string }).id;
export async function registerAudioExtractionRoutes(
  app: FastifyInstance,
  config: AppConfig,
  database: ToolboxDatabase,
  tasks: TaskStore,
  components: ComponentManager,
  library: AudioLibraryStore
) {
  const service = new AudioExtractionService(
    config.storageRoot,
    database,
    tasks,
    async () => {
      try {
        return await resolveFfmpegTools({
          managed: config.desktopManagedCapabilities,
          fallback: { ffmpeg: config.chatterboxFfmpegPath, ffprobe: config.chatterboxFfprobePath },
          asset: async (relative) => (await components.resolveInstalledAsset("ffmpeg", relative)).path
        });
      } catch {
        throw new AudioExtractError(
          "AUDIO_EXTRACT_RUNTIME_UNAVAILABLE",
          "请先在能力管理安装 FFmpeg 共享媒体运行时",
          503
        );
      }
    },
    () => app.log.error("AUDIO_EXTRACT_STORAGE_FAILED")
  );
  await service.initialize();
  app.addHook("onClose", () => service.close());
  const root = "/api/v1/tools/audio-extract";
  const wrap =
    (fn: (r: FastifyRequest, p: FastifyReply) => Promise<unknown>) => async (r: FastifyRequest, p: FastifyReply) => {
      try {
        return await fn(r, p);
      } catch (e) {
        if (e instanceof AudioExtractError || e instanceof AudioLibraryError)
          return p.code(e.status).send(fail(e.code, e.message));
        const code = String((e as { code?: string })?.code);
        if (code === "FST_REQ_FILE_TOO_LARGE")
          return p.code(413).send(fail("AUDIO_EXTRACT_FILE_SIZE", "单个视频最大 2 GiB"));
        if (
          ["FST_FILES_LIMIT", "FST_FIELDS_LIMIT", "FST_PARTS_LIMIT", "FST_INVALID_MULTIPART_CONTENT_TYPE"].includes(
            code
          )
        )
          return p.code(400).send(fail("AUDIO_EXTRACT_INPUT_INVALID", "每次请求只接受一个视频文件"));
        r.log.error("AUDIO_EXTRACT_OPERATION_FAILED");
        return p.code(500).send(fail("AUDIO_EXTRACT_OPERATION_FAILED", "操作失败，请检查磁盘和媒体运行时"));
      }
    };
  app.post(
    `${root}/sources`,
    { config: REQUEST_QUOTAS.audioExtractUpload },
    wrap(async (r, p) =>
      service.trackOperation(async () => {
        let stage: Awaited<ReturnType<typeof service.reserve>> | undefined,
          accepted = false;
        let uploaded: { sha256: string; bytes: number } | undefined;
        const disconnect = () => stage?.controller.abort();
        r.raw.once("aborted", disconnect);
        p.raw.once("close", disconnect);
        try {
          for await (const part of r.parts({
            limits: { files: 1, fields: 0, parts: 1, fileSize: AUDIO_EXTRACT_MAX_BYTES }
          })) {
            if (part.type !== "file" || part.fieldname !== "file" || stage)
              throw new AudioExtractError("AUDIO_EXTRACT_INPUT_INVALID", "请选择一个视频文件");
            if (!/\.(mp4|mkv|avi|mov|webm)$/i.test(part.filename))
              throw new AudioExtractError("AUDIO_EXTRACT_FORMAT", "支持 MP4、MKV、AVI、MOV、WebM", 415);
            stage = await service.reserve(part.filename);
            if (r.raw.aborted) stage.controller.abort();
            const hash = createHash("sha256");
            let bytes = 0;
            await pipeline(
              part.file,
              new Transform({
                transform(chunk: Buffer, _enc, cb) {
                  bytes += chunk.length;
                  if (bytes > AUDIO_EXTRACT_MAX_BYTES)
                    return cb(new AudioExtractError("AUDIO_EXTRACT_FILE_SIZE", "单个视频最大 2 GiB", 413));
                  hash.update(chunk);
                  cb(null, chunk);
                }
              }),
              fs.createWriteStream(stage.file, { flags: "wx" }),
              { signal: stage.controller.signal }
            );
            if (!bytes || part.file.truncated)
              throw new AudioExtractError("AUDIO_EXTRACT_FILE_SIZE", "视频为空或超过 2 GiB", 413);
            const head = Buffer.alloc(16),
              handle = await fsp.open(stage.file, "r");
            try {
              await handle.read(head, 0, head.length, 0);
            } finally {
              await handle.close();
            }
            const ebml = head.readUInt32BE(0) === 0x1a45dfa3,
              avi = head.toString("ascii", 0, 4) === "RIFF" && head.toString("ascii", 8, 12) === "AVI ",
              mov = ["ftyp", "moov", "mdat", "wide", "free", "skip"].includes(head.toString("ascii", 4, 8));
            const ext = part.filename.split(".").at(-1)!.toLowerCase();
            if (!(ext === "mkv" || ext === "webm" ? ebml : ext === "avi" ? avi : mov))
              throw new AudioExtractError("AUDIO_EXTRACT_FORMAT", "文件内容与视频容器不匹配", 415);
            uploaded = { sha256: hash.digest("hex"), bytes };
          }
          if (!stage || !uploaded) throw new AudioExtractError("AUDIO_EXTRACT_INPUT_INVALID", "请选择视频文件");
          const info = await service.inspect(stage.id, uploaded.sha256, uploaded.bytes);
          accepted = true;
          return ok(info);
        } finally {
          r.raw.removeListener("aborted", disconnect);
          p.raw.removeListener("close", disconnect);
          if (stage && !accepted) await service.discard(stage.id);
        }
      })
    )
  );
  app.delete(
    `${root}/sources/:id`,
    { schema: { params } },
    wrap(async (r) => {
      await service.discard(idOf(r));
      return ok({ ok: true });
    })
  );
  app.post(
    `${root}/jobs`,
    {
      schema: { body: AudioExtractInputSchema },
      preValidation: async (r, p) => {
        if (!Value.Check(AudioExtractInputSchema, r.body))
          return p.code(400).send(fail("AUDIO_EXTRACT_INPUT_INVALID", "提取参数无效"));
      }
    },
    wrap(async (r) => ok(await service.create(r.body as AudioExtractInput)))
  );
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
    `${root}/completed-selection`,
    wrap(async () => ok(service.selection()))
  );
  app.get(
    `${root}/jobs/:id`,
    { schema: { params }, config: { rateLimit: { max: 2400, timeWindow: "1 minute" } } },
    wrap(async (r) => ok(service.get(idOf(r))))
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
      config: REQUEST_QUOTAS.audioExtractLibrary,
      schema: {
        params,
        body: Type.Object(
          {
            groupId: Type.Union([Type.String({ pattern: "^[A-Za-z0-9_-]{1,80}$" }), Type.Null()]),
            purpose: Type.Union([Type.Literal("music"), Type.Literal("speech"), Type.Literal("general")]),
            mp3: Type.Boolean()
          },
          { additionalProperties: false }
        )
      }
    },
    wrap(async (r) => {
      const b = r.body as { groupId: string | null; purpose: "music" | "speech" | "general"; mp3: boolean };
      return ok(await service.addToLibrary(idOf(r), library, b.groupId, b.purpose, b.mp3));
    })
  );
  app.get(
    `${root}/jobs/:id/audio`,
    {
      schema: {
        params,
        querystring: Type.Object({ download: Type.Optional(Type.Literal("1")) }, { additionalProperties: false })
      },
      config: REQUEST_QUOTAS.mediaPreview
    },
    wrap(async (r, p) => {
      const source = await service.acquire(idOf(r));
      let stream: fs.ReadStream | undefined;
      try {
        const size = source.job.bytes!;
        let start = 0,
          end = size - 1;
        if (r.headers.range) {
          const match = /^bytes=(\d*)-(\d*)$/.exec(r.headers.range);
          if (!match || (!match[1] && !match[2])) return p.code(416).header("content-range", `bytes */${size}`).send();
          if (!match[1]) start = Math.max(0, size - Number(match[2]));
          else {
            start = Number(match[1]);
            if (match[2]) end = Math.min(end, Number(match[2]));
          }
          if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size)
            return p.code(416).header("content-range", `bytes */${size}`).send();
          p.code(206).header("content-range", `bytes ${start}-${end}/${size}`);
        }
        stream = fs.createReadStream(source.file, { start, end });
        stream.once("close", source.release);
        stream.once("error", source.release);
        p.raw.once("close", () => {
          stream?.destroy();
          source.release();
        });
        p.header("accept-ranges", "bytes")
          .header("content-type", source.job.mimeType)
          .header("content-length", end - start + 1);
        if ((r.query as { download?: string }).download)
          p.header(
            "content-disposition",
            `attachment; filename="audio.${source.job.extension}"; filename*=UTF-8''${encodeURIComponent(service.title(source.job) + "." + source.job.extension).replaceAll("'", "%27")}`
          );
        return p.send(stream);
      } finally {
        if (!stream) source.release();
      }
    })
  );
  const tickets = new Map<string, { ids: string[]; expires: number }>();
  app.post(
    `${root}/downloads`,
    { config: REQUEST_QUOTAS.batchDownload, schema: { body: Type.Object({ ids }, { additionalProperties: false }) } },
    wrap(async (r) => {
      for (const [id, t] of tickets) if (t.expires < Date.now()) tickets.delete(id);
      if (tickets.size >= 20)
        throw new AudioExtractError("AUDIO_EXTRACT_DOWNLOAD_BUSY", "下载请求较多，请稍后重试", 429);
      const selected = (r.body as { ids: string[] }).ids;
      for (const id of selected)
        if (service.get(id).status !== "completed")
          throw new AudioExtractError("AUDIO_EXTRACT_NOT_READY", "所选结果尚未完成", 409);
      const id = nanoid();
      tickets.set(id, { ids: selected, expires: Date.now() + 60000 });
      return ok({ url: `${root}/downloads/${id}` });
    })
  );
  app.get(
    `${root}/downloads/:id`,
    { config: REQUEST_QUOTAS.batchDownload, schema: { params } },
    wrap(async (r, p) => {
      const ticket = tickets.get(idOf(r));
      tickets.delete(idOf(r));
      if (!ticket || ticket.expires < Date.now())
        throw new AudioExtractError("AUDIO_EXTRACT_DOWNLOAD_EXPIRED", "下载已过期，请重新选择", 404);
      const held: Awaited<ReturnType<typeof service.acquire>>[] = [],
        zip = new ZipArchive({ zlib: { level: 1 } });
      let handed = false;
      const release = () => {
        for (const h of held) h.release();
      };
      try {
        for (const id of ticket.ids) held.push(await service.acquire(id));
        zip.once("error", () => {
          release();
          zip.destroy();
        });
        zip.once("end", release);
        p.raw.once("close", () => {
          zip.abort();
          release();
        });
        held.forEach((h, i) => zip.file(h.file, { name: `${i + 1}-${service.title(h.job)}.${h.job.extension}` }));
        p.header("content-type", "application/zip").header(
          "content-disposition",
          'attachment; filename="extracted-audio.zip"'
        );
        void zip.finalize().catch(() => zip.destroy());
        handed = true;
        return p.send(zip);
      } finally {
        if (!handed) release();
      }
    })
  );
  return service;
}
