/** 归档组件使用完整共享 DTO 夹具，不通过缺字段断言掩盖平台契约回归。 */
import type { ContentArchiveItem, ContentArchiveTask, ContentArchiveListResponse } from "@toolbox/shared";

export function archiveFixture(overrides: Partial<ContentArchiveItem> = {}): ContentArchiveItem {
  return {
    id: "archive-123",
    platform: "xiaohongshu",
    contentId: "note-123",
    sourceUrl: "https://www.xiaohongshu.com/explore/note-123",
    canonicalUrl: "https://www.xiaohongshu.com/explore/note-123",
    type: "video",
    title: "日落[微笑R]",
    description: "晚霞 #风景[话题]#",
    topics: [],
    fetchedAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    status: "ready",
    warnings: [],
    totalBytes: 10,
    media: [
      {
        id: "media-123",
        kind: "video",
        index: 0,
        fileName: "video.mp4",
        mimeType: "video/mp4",
        size: 10,
        checksum: "a".repeat(64),
        previewUrl: "/video.mp4",
        downloadUrl: "/video.mp4?download=1"
      }
    ],
    ...overrides
  };
}
export function translationFixture(): NonNullable<ContentArchiveItem["translation"]> {
  return {
    status: "ready",
    sourceLanguage: "zh-CN",
    targetLanguage: "en",
    provider: "opus-mt",
    sourceHash: "a".repeat(64),
    modelId: "Helsinki-NLP/opus-mt-zh-en",
    modelRevision: "test-revision",
    title: { source: "日落", machine: "Sunset", edited: "My sunset" },
    description: { source: "晚霞", machine: "Evening", edited: "Golden evening" },
    topics: [{ topicId: "topic-1", source: "风景", machine: "Scenery", edited: "Landscape" }],
    translatedAt: "2026-10-01T00:00:00.000Z"
  };
}
export function listFixture(items: ContentArchiveItem[] = [archiveFixture()]): ContentArchiveListResponse {
  return {
    items: items.map(({ media, ...item }) => ({ ...item, mediaCount: media.length })),
    total: items.length,
    page: 1,
    pageSize: 12,
    pageCount: 1
  };
}
export function taskFixture(overrides: Partial<ContentArchiveTask> = {}): ContentArchiveTask {
  return {
    id: "task-123",
    platform: "xiaohongshu",
    status: "pending",
    stage: "installing",
    progress: 0,
    message: "等待处理",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...overrides
  };
}
