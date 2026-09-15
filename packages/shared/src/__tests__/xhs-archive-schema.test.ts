import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import "../api-schema";
import {
  XhsArchiveItemSchema,
  XhsArchiveListResponseSchema,
  XhsArchiveTaskSchema,
  XhsRuntimeStatusSchema,
  XhsTranslationRuntimeStatusSchema,
  XhsTranslationTaskSchema
} from "../xhs-archive";

const now = "2026-09-15T10:00:00.000Z";
const checksum = "a".repeat(64);

const item = {
  id: "archive_123456",
  noteId: "note-100",
  sourceUrl: "https://www.xiaohongshu.com/explore/note-100",
  canonicalUrl: "https://www.xiaohongshu.com/explore/note-100",
  type: "image",
  title: "测试笔记",
  description: "正文",
  topics: [{ id: "topic_1", source: "测试" }],
  author: { id: "author-1", name: "作者" },
  fetchedAt: now,
  updatedAt: now,
  coverMediaId: "media_123456",
  media: [
    {
      id: "media_123456",
      kind: "image",
      index: 0,
      fileName: "image.jpg",
      mimeType: "image/jpeg",
      size: 1024,
      checksum,
      previewUrl: "/api/v1/tools/xhs-archive/items/archive_123456/media/media_123456",
      downloadUrl: "/api/v1/tools/xhs-archive/items/archive_123456/media/media_123456?download=1"
    }
  ],
  status: "ready",
  warnings: [],
  totalBytes: 1024
} as const;

describe("xhs archive response schemas", () => {
  it("validates archive details and paginated summaries", () => {
    expect(Value.Check(XhsArchiveItemSchema, item)).toBe(true);
    expect(Value.Check(XhsArchiveItemSchema, { ...item, localPath: "C:/private/image.jpg" })).toBe(false);

    const { media: _media, ...summary } = item;
    expect(
      Value.Check(XhsArchiveListResponseSchema, {
        items: [{ ...summary, mediaCount: 1, coverUrl: item.media[0].previewUrl, coverKind: "image" }],
        total: 1,
        page: 1,
        pageSize: 20,
        pageCount: 1
      })
    ).toBe(true);
  });

  it("validates archive and translation task state machines", () => {
    expect(
      Value.Check(XhsArchiveTaskSchema, {
        id: "task_123456",
        status: "running",
        stage: "downloading",
        progress: 50,
        message: "正在保存媒体",
        createdAt: now,
        updatedAt: now
      })
    ).toBe(true);
    expect(
      Value.Check(XhsTranslationTaskSchema, {
        id: "translation_123456",
        itemIds: [item.id],
        status: "completed",
        stage: "completed",
        progress: 100,
        completedItems: 1,
        totalItems: 1,
        message: "翻译完成",
        createdAt: now,
        updatedAt: now
      })
    ).toBe(true);
    expect(
      Value.Check(XhsTranslationTaskSchema, {
        id: "translation_123456",
        itemIds: [item.id],
        status: "completed",
        stage: "unknown",
        progress: 100,
        completedItems: 1,
        totalItems: 1,
        message: "翻译完成",
        createdAt: now,
        updatedAt: now
      })
    ).toBe(false);
  });

  it("validates archive and translation runtime status without leaking local paths", () => {
    const archiveRuntime = {
      status: "ready",
      version: "1.0.0",
      providerUrl: "http://127.0.0.1:3230",
      message: "运行正常",
      installProgress: 100,
      authenticated: true
    };
    const translationRuntime = {
      status: "not-installed",
      version: "1.0.0",
      modelId: "Helsinki-NLP/opus-mt-zh-en",
      modelRevision: "main",
      message: "首次翻译时安装",
      installProgress: 0
    };
    expect(Value.Check(XhsRuntimeStatusSchema, archiveRuntime)).toBe(true);
    expect(Value.Check(XhsTranslationRuntimeStatusSchema, translationRuntime)).toBe(true);
    expect(Value.Check(XhsRuntimeStatusSchema, { ...archiveRuntime, executablePath: "C:/private/runtime.exe" })).toBe(
      false
    );
  });
});
