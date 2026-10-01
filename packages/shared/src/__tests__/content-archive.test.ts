/** 中性归档契约与兼容边界：旧客户端不接收抖音，媒体/译文/截帧不因更名丢失。 */
import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import "../api-schema";
import {
  ArchivePlatformSchema,
  ContentArchiveItemSchema,
  ContentArchiveListItemSchema,
  ContentArchiveListResponseSchema,
  ContentArchiveMediaSchema,
  ContentArchiveListQuerySchema,
  ContentArchiveCreateInputSchema,
  ContentArchiveTaskSchema,
  fromXhsArchive,
  toXhsArchive,
  toContentArchiveListItem,
  isContentArchiveListQuery,
  isContentArchiveTask,
  isContentArchiveCreateInput,
  type ContentArchiveItem,
  type ContentArchiveListItem,
  type ContentArchiveMedia,
  type ContentArchiveListQuery,
  type ContentArchiveCreateInput,
  type ContentArchiveTask
} from "../content-archive";
import type { XhsArchiveItem } from "../xhs-archive";

const now = "2026-10-01T00:00:00.000Z";
const media: ContentArchiveMedia = {
  id: "frame_123456",
  kind: "image",
  index: 0,
  fileName: "frame.png",
  mimeType: "image/png",
  size: 10,
  width: 1280,
  height: 720,
  frameSourceMediaId: "video_123456",
  frameTimestampMs: 2300,
  checksum: "a".repeat(64),
  previewUrl: "/existing/preview",
  downloadUrl: "/existing/download"
};
const legacy: XhsArchiveItem = {
  id: "archive_123456",
  noteId: "123456789",
  sourceUrl: "https://www.xiaohongshu.com/explore/123456789",
  canonicalUrl: "https://www.xiaohongshu.com/explore/123456789",
  type: "video",
  title: "标题",
  description: "原文 #话题",
  topics: [{ id: "topic_123", source: "话题" }],
  media: [media],
  fetchedAt: now,
  updatedAt: now,
  status: "ready",
  warnings: [],
  totalBytes: 10
};

describe("content archive contract", () => {
  it("创建输入仅接受链接和平台，不能带入 Cookie 或内部配置", () => {
    expect(isContentArchiveCreateInput({ url: "https://www.douyin.com/video/123", platform: "auto" })).toBe(true);
    expect(isContentArchiveCreateInput({ url: "link", cookie: "secret" })).toBe(false);
    expect(isContentArchiveCreateInput(null)).toBe(false);
  });
  it("adapts old data without changing media, URLs, timestamps or frame provenance", () => {
    const item = fromXhsArchive(legacy);
    expect(item).toMatchObject({ platform: "xiaohongshu", contentId: legacy.noteId, media: [media] });
    expect("noteId" in item).toBe(false);
    expect(Value.Check(ContentArchiveMediaSchema, media)).toBe(true);
    expect(toXhsArchive(item)).toEqual(legacy);
    item.media[0].fileName = "changed.png";
    expect(legacy.media[0].fileName).toBe("frame.png");
  });

  it("validates Douyin identity and preserves full raw text without XHS text processing", () => {
    const item: ContentArchiveItem = { ...fromXhsArchive(legacy), platform: "douyin", rawText: "抖音原文[话题] #日落" };
    expect(Value.Check(ContentArchiveItemSchema, item)).toBe(true);
    expect(() => toXhsArchive(item)).toThrow("ARCHIVE_PLATFORM_MISMATCH");
    for (const changes of [
      { platform: "tiktok" },
      { contentId: "" },
      { contentId: " id " },
      { noteId: "legacy" },
      { cookie: "private" }
    ]) {
      expect(Value.Check(ContentArchiveItemSchema, { ...item, ...changes })).toBe(false);
    }
    expect(Value.Check(ArchivePlatformSchema, "douyin")).toBe(true);
    expect(Value.Check(ArchivePlatformSchema, "all")).toBe(false);
  });

  it("requires platform on task and summary DTOs", () => {
    const { media: _media, ...rest } = fromXhsArchive(legacy);
    const summary: ContentArchiveListItem = { ...rest, mediaCount: 1, coverUrl: media.previewUrl, coverKind: "image" };
    expect(Value.Check(ContentArchiveListItemSchema, summary)).toBe(true);
    expect(
      Value.Check(ContentArchiveListResponseSchema, { items: [summary], total: 1, page: 1, pageSize: 12, pageCount: 1 })
    ).toBe(true);
    const task: ContentArchiveTask = {
      id: "task_123456",
      platform: "douyin",
      status: "running",
      stage: "downloading",
      progress: 50,
      message: "下载中",
      createdAt: now,
      updatedAt: now
    };
    expect(Value.Check(ContentArchiveTaskSchema, task)).toBe(true);
    const { platform: _platform, ...unbound } = task;
    expect(Value.Check(ContentArchiveTaskSchema, unbound)).toBe(false);
  });

  it("validates platform filters and creation without widening old contracts", () => {
    const query: ContentArchiveListQuery = { platform: "douyin", page: 2, pageSize: 10, type: "video" };
    const input: ContentArchiveCreateInput = { url: "https://v.douyin.com/sample/", platform: "auto" };
    expect(Value.Check(ContentArchiveListQuerySchema, query)).toBe(true);
    expect(isContentArchiveListQuery(query)).toBe(true);
    expect(Value.Check(ContentArchiveCreateInputSchema, input)).toBe(true);
    for (const invalid of [
      { platform: "auto" },
      { platform: "tiktok" },
      { page: 0 },
      { pageSize: 51 },
      { cookie: "private" }
    ]) {
      expect(Value.Check(ContentArchiveListQuerySchema, invalid)).toBe(false);
      expect(isContentArchiveListQuery(invalid)).toBe(false);
    }
  });

  it("rejects malformed legacy payload instead of inventing an identity", () => {
    expect(() => fromXhsArchive({ ...legacy, noteId: "" })).toThrow("ARCHIVE_PAYLOAD_INVALID");
  });

  it("validates persisted platform tasks without accepting internal source URLs", () => {
    const task = {
      id: "task_123456",
      platform: "douyin",
      status: "pending",
      stage: "installing",
      progress: 0,
      message: "已排队",
      createdAt: now,
      updatedAt: now
    };
    expect(isContentArchiveTask(task)).toBe(true);
    expect(isContentArchiveTask({ ...task, sourceUrl: "https://secret.test" })).toBe(false);
    expect(isContentArchiveTask({ ...task, platform: "other" })).toBe(false);
  });

  it("omits heavy media details and excludes captured frames from default covers", () => {
    const item = fromXhsArchive(legacy);
    expect(toContentArchiveListItem(item)).toMatchObject({ mediaCount: 1, coverUrl: undefined });
    item.media.push({ ...media, id: "image_123456", frameSourceMediaId: undefined, frameTimestampMs: undefined });
    expect(toContentArchiveListItem(item).coverKind).toBe("image");
    item.coverMediaId = "frame_123456";
    expect(toContentArchiveListItem(item).coverUrl).toBe(media.previewUrl);
    const summary = toContentArchiveListItem(item);
    expect("media" in summary).toBe(false);
    expect(Value.Check(ContentArchiveListItemSchema, summary)).toBe(true);
  });
});
