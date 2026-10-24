/** 多平台归档契约：复用既有媒体/翻译结构，身份与旧 noteId 解耦，不重写旧接口 DTO。 */
import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import {
  XhsArchiveItemSchema,
  XhsArchiveListQuerySchema,
  XhsArchiveMediaSchema,
  XhsArchiveTaskSchema,
  XhsTranslationTaskSchema,
  XhsTranslationRequestSchema,
  XhsTranslationEditInputSchema,
  XhsTranslationBatchInputSchema,
  type XhsArchiveItem
} from "./xhs-archive";

export const ArchivePlatformSchema = Type.Union([Type.Literal("xiaohongshu"), Type.Literal("douyin")]);
const ContentIdSchema = Type.String({
  minLength: 1,
  maxLength: 256,
  pattern: "^[^\\s\\x00-\\x1f\\x7f](?:[^\\x00-\\x1f\\x7f]*[^\\s\\x00-\\x1f\\x7f])?$"
});
export const ContentArchiveMediaSchema = XhsArchiveMediaSchema;
export const ContentArchiveItemSchema = Type.Composite(
  [
    Type.Omit(XhsArchiveItemSchema, ["noteId"]),
    Type.Object({
      platform: ArchivePlatformSchema,
      contentId: ContentIdSchema,
      rawText: Type.Optional(Type.String({ maxLength: 100_000 }))
    })
  ],
  { additionalProperties: false }
);
export const ContentArchiveListItemSchema = Type.Composite(
  [
    Type.Omit(ContentArchiveItemSchema, ["media"]),
    Type.Object({
      mediaCount: Type.Integer({ minimum: 0 }),
      coverUrl: Type.Optional(Type.String()),
      coverKind: Type.Optional(XhsArchiveMediaSchema.properties.kind)
    })
  ],
  { additionalProperties: false }
);
export const ContentArchiveListResponseSchema = Type.Object(
  {
    items: Type.Array(ContentArchiveListItemSchema),
    total: Type.Integer({ minimum: 0 }),
    page: Type.Integer({ minimum: 1 }),
    pageSize: Type.Integer({ minimum: 1, maximum: 50 }),
    pageCount: Type.Integer({ minimum: 1 })
  },
  { additionalProperties: false }
);
export const ContentArchiveListQuerySchema = Type.Composite(
  [
    XhsArchiveListQuerySchema,
    Type.Object({ platform: Type.Optional(Type.Union([Type.Literal("all"), ArchivePlatformSchema])) })
  ],
  { additionalProperties: false }
);
export const ContentArchiveCreateInputSchema = Type.Object(
  {
    url: Type.String({ minLength: 1, maxLength: 10_000 }),
    platform: Type.Optional(Type.Union([Type.Literal("auto"), ArchivePlatformSchema]))
  },
  { additionalProperties: false }
);
export const ContentArchiveTaskSchema = Type.Composite(
  [XhsArchiveTaskSchema, Type.Object({ platform: ArchivePlatformSchema })],
  { additionalProperties: false }
);
export type ContentArchiveItem = Static<typeof ContentArchiveItemSchema>;
// 翻译字段与旧契约复用；只扩展中性批次的筛选范围，避免维护两套编辑/任务 DTO。
export const ContentTranslationTaskSchema = XhsTranslationTaskSchema;
export const ContentTranslationRequestSchema = XhsTranslationRequestSchema;
export const ContentTranslationEditInputSchema = XhsTranslationEditInputSchema;
export const ContentTranslationBatchInputSchema = Type.Union([
  Type.Object(
    {
      mode: Type.Literal("selected"),
      itemIds: Type.Array(XhsTranslationTaskSchema.properties.id, { minItems: 1, maxItems: 100, uniqueItems: true })
    },
    { additionalProperties: false }
  ),
  Type.Object(
    {
      mode: Type.Literal("missing-or-stale"),
      filter: Type.Optional(Type.Omit(ContentArchiveListQuerySchema, ["page", "pageSize"]))
    },
    { additionalProperties: false }
  )
]);
export type ContentTranslationTask = Static<typeof ContentTranslationTaskSchema>;
export function isContentTranslationTask(value: unknown): value is ContentTranslationTask {
  return Value.Check(ContentTranslationTaskSchema, value);
}
export type ContentTranslationRequest = Static<typeof ContentTranslationRequestSchema>;
export type ContentTranslationEditInput = Static<typeof ContentTranslationEditInputSchema>;
export type ContentTranslationBatchInput = Static<typeof ContentTranslationBatchInputSchema>;
export function isContentTranslationBatchInput(value: unknown): value is ContentTranslationBatchInput {
  return Value.Check(ContentTranslationBatchInputSchema, value);
}
export function isContentTranslationRequest(value: unknown): value is ContentTranslationRequest {
  return Value.Check(ContentTranslationRequestSchema, value);
}
export function isContentTranslationEditInput(value: unknown): value is ContentTranslationEditInput {
  return Value.Check(ContentTranslationEditInputSchema, value);
}
export function isLegacyTranslationBatchInput(value: unknown) {
  return Value.Check(XhsTranslationBatchInputSchema, value);
}
export type ContentArchiveMedia = Static<typeof ContentArchiveMediaSchema>;
export type ContentArchiveListItem = Static<typeof ContentArchiveListItemSchema>;
export type ContentArchiveListResponse = Static<typeof ContentArchiveListResponseSchema>;
export type ContentArchiveListQuery = Static<typeof ContentArchiveListQuerySchema>;
export type ContentArchiveCreateInput = Static<typeof ContentArchiveCreateInputSchema>;
export type ContentArchiveTask = Static<typeof ContentArchiveTaskSchema>;

export function isContentArchiveItem(value: unknown): value is ContentArchiveItem {
  return Value.Check(ContentArchiveItemSchema, value);
}

export function isContentArchiveTask(value: unknown): value is ContentArchiveTask {
  return Value.Check(ContentArchiveTaskSchema, value);
}

/** 写入入口在 AJV 移除额外字段前验证，避免把 Cookie 等未授权输入静默转换成合法请求。 */
export function isContentArchiveCreateInput(value: unknown): value is ContentArchiveCreateInput {
  return Value.Check(ContentArchiveCreateInputSchema, value);
}

export function isContentArchiveListQuery(value: unknown): value is ContentArchiveListQuery {
  return Value.Check(ContentArchiveListQuerySchema, value);
}

/** 列表不返回整份媒体；默认封面排除用户截帧，保持旧小红书的封面选择规则。 */
export function toContentArchiveListItem(item: ContentArchiveItem): ContentArchiveListItem {
  const { media, ...rest } = structuredClone(item);
  const cover =
    media.find((entry) => entry.id === item.coverMediaId) ??
    media.find(
      (entry) => entry.frameSourceMediaId === undefined && (entry.kind === "image" || entry.kind === "cover")
    ) ??
    media.find((entry) => entry.kind === "video" || entry.kind === "live-photo");
  return { ...rest, mediaCount: media.length, coverUrl: cover?.previewUrl, coverKind: cover?.kind };
}

/** 只做身份字段适配；旧 URL、媒体、用户译文和截帧不被规范化或重建。 */
export function fromXhsArchive(item: XhsArchiveItem): ContentArchiveItem {
  const { noteId, ...rest } = structuredClone(item);
  const result = { ...rest, platform: "xiaohongshu" as const, contentId: noteId };
  if (!isContentArchiveItem(result)) throw new Error("ARCHIVE_PAYLOAD_INVALID");
  return result;
}

/** 兼容出口只接受小红书；抖音记录不能伪装成旧客户端的 noteId。 */
export function toXhsArchive(item: ContentArchiveItem): XhsArchiveItem {
  if (item.platform !== "xiaohongshu") throw new Error("ARCHIVE_PLATFORM_MISMATCH");
  const { platform: _platform, contentId, rawText: _rawText, ...rest } = structuredClone(item);
  return { ...rest, noteId: contentId };
}
