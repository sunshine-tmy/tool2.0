/** Reuse wire schemas where storage is identical; explicitly describe storage-only fields. */
import { Type, type TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import {
  EdgeTtsTaskSchema,
  ChatterboxTaskSchema,
  ChatterboxSavedVoiceSchema,
  ChatterboxBatchSchema,
  ChatterboxBatchItemSchema,
  ImageAiTaskSchema,
  ImageAiResultSchema,
  ArchiveGroupSchema,
  ContentArchivePublicationSchema,
  ContentArchiveTaskSchema,
  ArchiveImportBatchSchema,
  ArchiveVideoEditJobSchema,
  ArchiveWatermarkLibraryItemSchema,
  ArchiveWatermarkPresetSchema,
  ContentArchiveItemSchema,
  LanFileRecordSchema,
  LanNoteSchema,
  LanNoteImageSchema,
  VideoAiTaskSchema
} from "@toolbox/shared";
import { AudioExtractJobSchema } from "@toolbox/shared/audio-extract";
import { AudioConvertJobSchema } from "@toolbox/shared";
import { TaskSchema } from "@toolbox/shared";
import { archiveMediaAssets } from "../../domains/content-archive/core/media-assets";
import { isStoredTikTokProfileRecord } from "../../domains/content-archive/profile/service";
import type { ModuleData } from "./types";
import { object, array, text, assertOwnedRecord, assertFileOwnership, speechDirectory } from "./registry";

const string = Type.String();
const imageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
const videoTypes = ["video/mp4", "video/quicktime", "video/webm"];
const audioTypes = ["audio/mpeg", "audio/wav", "audio/mp4", "audio/flac"];
const archiveAudioTypes = [...audioTypes, "audio/aac", "audio/ogg"];
function assertMediaType(value: unknown, allowed: string[]) {
  if (typeof value !== "string" || !allowed.includes(value)) throw new Error("备份包含不支持的媒体类型");
}
const imageStoredSchema = Type.Composite(
  [
    Type.Omit(ImageAiTaskSchema, ["inputs", "results"]),
    Type.Object({
      inputs: Type.Array(
        Type.Object(
          {
            path: string,
            originalName: string,
            mimetype: string,
            size: Type.Integer({ minimum: 0 }),
            width: Type.Integer({ minimum: 1 }),
            height: Type.Integer({ minimum: 1 })
          },
          { additionalProperties: false }
        )
      ),
      results: Type.Array(
        Type.Composite([ImageAiResultSchema, Type.Object({ outputPath: string })], { additionalProperties: false })
      ),
      maskPath: Type.Optional(string),
      assets: Type.Optional(
        Type.Object(
          {
            foreground: string,
            original: Type.Optional(string),
            background: Type.Optional(string),
            erase: Type.Optional(string),
            restore: Type.Optional(string)
          },
          { additionalProperties: false }
        )
      ),
      cancelRequested: Type.Optional(Type.Boolean()),
      submissionKey: Type.Optional(string)
    })
  ],
  { additionalProperties: false }
);
const schemas: Record<string, TSchema> = {
  task: TaskSchema,
  "audio-convert-job": AudioConvertJobSchema,
  "video-ai-task": Type.Composite(
    [
      Type.Omit(VideoAiTaskSchema, ["output"]),
      Type.Object({
        inputPath: string,
        outputPath: Type.Optional(string),
        outputBytes: Type.Optional(Type.Integer({ minimum: 0 })),
        outputWidth: Type.Optional(Type.Integer({ minimum: 1 })),
        outputHeight: Type.Optional(Type.Integer({ minimum: 1 })),
        outputDurationMs: Type.Optional(Type.Union([Type.Integer({ minimum: 0 }), Type.Null()])),
        progressPath: Type.Optional(string),
        cancelFlagPath: Type.Optional(string),
        cancelRequested: Type.Optional(Type.Boolean()),
        manualArea: Type.Optional(
          Type.Object({ x: Type.Number(), y: Type.Number(), width: Type.Number(), height: Type.Number() })
        )
      })
    ],
    { additionalProperties: false }
  ),
  "audio-extract-job": AudioExtractJobSchema,
  "xhs-archive": ContentArchiveItemSchema,
  "archive-group": ArchiveGroupSchema,
  "archive-publication": ContentArchivePublicationSchema,
  "archive-fetch-task": ContentArchiveTaskSchema,
  "archive-import-batch": ArchiveImportBatchSchema,
  "archive-video-edit-job": ArchiveVideoEditJobSchema,
  "archive-watermark-library": ArchiveWatermarkLibraryItemSchema,
  "archive-watermark-preset": ArchiveWatermarkPresetSchema,
  "edge-tts-task": EdgeTtsTaskSchema,
  "chatterbox-task": ChatterboxTaskSchema,
  "chatterbox-batch": ChatterboxBatchSchema,
  "chatterbox-item": Type.Composite([ChatterboxBatchItemSchema, Type.Object({ batchId: string })], {
    additionalProperties: false
  }),
  "chatterbox-voice": Type.Omit(ChatterboxSavedVoiceSchema, ["audioUrl"]),
  "image-ai-task": imageStoredSchema,
  "lan-file": LanFileRecordSchema,
  "lan-note": Type.Composite(
    [
      Type.Omit(LanNoteSchema, ["images"]),
      Type.Object({ images: Type.Array(Type.Omit(LanNoteImageSchema, ["previewUrl", "downloadUrl"])) })
    ],
    { additionalProperties: false }
  )
};
export function validateModuleData(module: ModuleData) {
  const ids = new Set<string>();
  const paths = new Set(module.files.map((f) => f.path));
  const required = (filename: string, bytes?: number, hash?: string) => {
    if (!paths.has(filename)) throw new Error("备份缺少记录引用的媒体文件");
    const descriptor = module.files.find((file) => file.path === filename)!;
    if ((bytes !== undefined && descriptor.bytes !== bytes) || (hash !== undefined && descriptor.sha256 !== hash))
      throw new Error("备份领域媒体大小或摘要与记录不一致");
  };
  const checkLinks = (value: unknown, key = "") => {
    if (Array.isArray(value)) {
      for (const item of value) checkLinks(item, key);
      return;
    }
    if (value && typeof value === "object") {
      for (const [name, item] of Object.entries(object(value))) checkLinks(item, name);
      return;
    }
    if (
      typeof value === "string" &&
      /url$/i.test(key) &&
      /^(javascript|vbscript|data|file):/i.test(value.replace(/\p{Cc}/gu, "").trim())
    )
      throw new Error("备份含不安全的媒体或作品链接");
  };
  for (const row of module.records) {
    assertOwnedRecord(module.id, row);
    const key = `${row.kind}/${row.id}`;
    if (ids.has(key)) throw new Error("备份实体身份重复");
    ids.add(key);
    const p = object(row.payload),
      schema = schemas[row.kind];
    checkLinks(p);
    if (schema && !Value.Check(schema, p)) throw new Error(`备份领域格式不兼容：${row.kind}`);
    if (
      row.kind === "archive-watermark-preset" &&
      array(p.points).some(
        (point, index, points) => index > 0 && Number(point.progress) <= Number(points[index - 1].progress)
      )
    )
      throw new Error("水印关键帧顺序无效");
    if (["pending", "running", "queued", "processing", "stopping"].includes(row.status ?? ""))
      throw new Error("备份含未结束任务，不能在新设备自动继续");
    if (["pending", "running", "queued", "processing", "stopping"].includes(String(p.status)))
      throw new Error("备份包含未结束的领域任务");
    if (row.kind === "xhs-archive")
      for (const media of array(p.media)) {
        assertMediaType(
          media.mimeType,
          media.kind === "audio"
            ? archiveAudioTypes
            : ["video", "live-photo"].includes(String(media.kind))
              ? videoTypes
              : imageTypes
        );
        for (const asset of archiveMediaAssets(media as import("@toolbox/shared").ContentArchiveMedia)) {
          if (asset.fileName.includes("/") || asset.fileName.includes("\\")) throw new Error("归档资产文件名不安全");
          assertMediaType(asset.mimeType, [...imageTypes, ...videoTypes, ...archiveAudioTypes]);
        }
        for (const asset of archiveMediaAssets(media as import("@toolbox/shared").ContentArchiveMedia, false))
          required(`xhs-archive/items/${row.id}/${asset.fileName}`, asset.size, asset.checksum);
      }
    if (row.kind === "task" && module.id === "image-compress" && p.outputPath)
      required(`outputs/${text(p.outputPath)}`);
    if (row.kind === "audio-extract-job") {
      if (row.status !== p.status) throw new Error("提取任务状态不一致");
      const types: Record<string, string> = {
        mp3: "audio/mpeg",
        m4a: "audio/mp4",
        flac: "audio/flac",
        ogg: "audio/ogg",
        wav: "audio/wav",
        mka: "audio/x-matroska"
      };
      if (types[String(p.extension)] !== p.mimeType || (p.format === "mp3" && p.extension !== "mp3"))
        throw new Error("提取结果格式不一致");
      if (p.status === "completed") {
        if (typeof p.bytes !== "number" || typeof p.sha256 !== "string" || typeof p.duration !== "number")
          throw new Error("提取结果信息不完整");
        required(`audio-extract/results/${row.id}/audio.${p.extension}`, p.bytes, p.sha256);
      }
    }
    if (row.kind === "audio-convert-job") {
      if (row.status !== p.status) throw new Error("转换任务状态不一致");
      if (p.status === "completed") {
        if (typeof p.bytes !== "number" || typeof p.sha256 !== "string" || typeof p.duration !== "number")
          throw new Error("转换结果信息不完整");
        required(`audio-convert/results/${row.id}/audio.mp3`, p.bytes, p.sha256);
      }
    }
    if (row.kind === "image-ai-task") {
      const requirePath = (value: unknown) => {
        const portable = text(value);
        if (!portable.startsWith("@storage/")) throw new Error("AI 图片路径必须为可移植受管路径");
        required(portable.slice(9));
      };
      for (const input of array(p.inputs)) requirePath(input.path);
      for (const output of array(p.results)) requirePath(output.outputPath);
      if (p.maskPath) requirePath(p.maskPath);
      if (p.assets) for (const value of Object.values(object(p.assets))) if (value) requirePath(value);
    }
    if (row.kind === "video-ai-task") {
      if (p.status === "completed" && !p.outputPath) throw new Error("视频去字幕成功记录缺少输出");
      if (row.status !== p.status) throw new Error("视频去字幕任务状态不一致");
      if (
        p.inputPath !== `@storage/video-ai/inputs/${row.id}/input.bin` ||
        (p.progressPath && p.progressPath !== `@storage/video-ai/tasks/${row.id}/progress.json`) ||
        (p.cancelFlagPath && p.cancelFlagPath !== `@storage/video-ai/tasks/${row.id}/cancel.flag`)
      )
        throw new Error("视频去字幕受管路径无效");
      if (p.outputPath) {
        if (
          p.status !== "completed" ||
          p.outputPath !== `@storage/video-ai/outputs/${row.id}.mp4` ||
          !p.outputWidth ||
          !p.outputHeight ||
          p.expiresAt !== null
        )
          throw new Error("视频去字幕结果元数据无效");
        required(`video-ai/outputs/${row.id}.mp4`, Number(p.outputBytes));
      }
    }
    if (row.kind === "chatterbox-voice")
      required(`${speechDirectory(row.kind, row.id, p)}/reference.wav`, Number(p.audioBytes));
    if (["chatterbox-task", "chatterbox-item", "edge-tts-task"].includes(row.kind) && row.status === "completed")
      required(
        `${speechDirectory(row.kind, row.id, p)}/audio.mp3`,
        typeof p.audioBytes === "number" ? p.audioBytes : undefined
      );
    if (row.kind === "lan-file") required(`lan-transfer/files/${p.storedName}`);
    if (row.kind === "lan-note")
      for (const image of array(p.images)) required(`lan-transfer/notes/images/${image.storedName}`);
    if (row.kind === "archive-watermark-library")
      required(`xhs-archive/watermark-library/${row.id}.png`, Number(p.size), String(p.checksum));
    if (row.kind === "tiktok-profile-job") {
      const meta = object(p.meta);
      if (!isStoredTikTokProfileRecord(p, row.id)) throw new Error("TikTok 主页历史格式不兼容");
      if (["discovering", "waiting-user", "archiving", "stopping"].includes(String(meta.phase)))
        throw new Error("请先结束 TikTok 主页任务");
    }
  }
  for (const file of module.files) assertFileOwnership(module, file);
  if (module.id === "audio-library")
    for (const item of module.catalog?.items ?? []) {
      assertMediaType(item.mimeType, audioTypes);
      required(`audio-library/items/${item.id}/${item.fileName}`, item.bytes, item.sha256);
    }
}
