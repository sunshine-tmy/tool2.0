/** Repository 验证只用内存库；跨平台身份、兼容出口和用户数据不依赖在线平台。 */
import { afterEach, describe, expect, it } from "vitest";
import { fromXhsArchive, toXhsArchive, type ContentArchiveItem, type XhsArchiveItem } from "@toolbox/shared";
import { ToolboxDatabase } from "../database/toolbox-database";
import { ContentArchiveRepository } from "../modules/media-archive/repository";

let database: ToolboxDatabase;
afterEach(() => database?.close());

function environment() {
  database = new ToolboxDatabase(":memory:");
  return new ContentArchiveRepository(database);
}

function fixture(id = "archive_123456", platform: ContentArchiveItem["platform"] = "xiaohongshu"): ContentArchiveItem {
  return {
    id,
    platform,
    contentId: "123456789",
    sourceUrl: "https://example.test/",
    canonicalUrl: "https://example.test/",
    type: "video",
    title: "测试",
    description: "正文",
    topics: [],
    media: [],
    fetchedAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    status: "ready",
    warnings: [],
    totalBytes: 0
  };
}

describe("content archive repository", () => {
  it("keeps equal remote IDs on different platforms separate and rejects same-platform duplicates", () => {
    const repository = environment();
    repository.save(fixture());
    repository.save(fixture("douyin_123456", "douyin"));
    expect(repository.findBySource("xiaohongshu", "123456789")?.id).toBe("archive_123456");
    expect(repository.findBySource("douyin", "123456789")?.id).toBe("douyin_123456");
    expect(() => repository.save(fixture("duplicate_123"))).toThrow("UNIQUE");
    expect(repository.list().total).toBe(2);
    expect(repository.findBySource("douyin", "missing")).toBeUndefined();
    expect(repository.get("missing")).toBeUndefined();
  });

  it("reads legacy noteId through real columns without rewriting old payload or media", () => {
    const repository = environment();
    const legacy: XhsArchiveItem = toXhsArchive(fixture());
    database.upsert({
      id: legacy.id,
      kind: "xhs-archive",
      payload: legacy,
      status: legacy.status,
      createdAt: legacy.fetchedAt,
      updatedAt: legacy.updatedAt
    });
    expect(repository.get(legacy.id)).toEqual(fromXhsArchive(legacy));
    expect(database.get("xhs-archive", legacy.id)?.payload).toEqual(legacy);
  });

  it("reads v1 XHS topic defaults without mutating the stored source text or payload", () => {
    const repository = environment();
    const { topics: _topics, warnings: _warnings, ...legacy } = toXhsArchive(fixture());
    database.upsert({
      id: legacy.id,
      kind: "xhs-archive",
      payload: legacy,
      status: legacy.status,
      createdAt: legacy.fetchedAt,
      updatedAt: legacy.updatedAt
    });
    expect(repository.get(legacy.id)).toMatchObject({ topics: [], warnings: [], description: "正文" });
    expect(database.get("xhs-archive", legacy.id)?.payload).toEqual(legacy);
    expect("media" in repository.list().items[0]).toBe(false);
  });

  it("filters platform, text and type before applying stable pagination", () => {
    const repository = environment();
    repository.save({ ...fixture(), title: "小红书" });
    repository.save({ ...fixture("douyin_123456", "douyin"), rawText: "完整抖音原文", type: "live-photo" });
    repository.save({ ...fixture("douyin_654321", "douyin"), contentId: "987654321", title: "另一条" });
    expect(repository.list({ platform: "douyin", pageSize: 1 })).toMatchObject({
      total: 2,
      pageCount: 2,
      items: [{ id: "douyin_123456" }]
    });
    expect(repository.list({ platform: "douyin", page: 2, pageSize: 1 }).items[0].id).toBe("douyin_654321");
    expect(repository.list({ keyword: "抖音原文", type: "live-photo" }).total).toBe(1);
    expect(repository.list({ keyword: "没有结果" }).pageCount).toBe(1);
    expect(() => repository.list({ platform: "auto" } as never)).toThrow("ARCHIVE_QUERY_INVALID");
  });

  it("keeps stable local identity and returns defensive copies", () => {
    const repository = environment();
    repository.save(fixture());
    const updated = repository.save({ ...fixture(), title: "刷新", updatedAt: "2026-10-01T01:00:00.000Z" });
    updated.title = "调用方修改";
    expect(repository.get(updated.id)?.title).toBe("刷新");
    expect(() => repository.save({ ...fixture(), platform: "douyin" })).toThrow("ARCHIVE_IDENTITY_IMMUTABLE");
    expect(() => repository.save({ ...fixture(), contentId: "different" })).toThrow("ARCHIVE_IDENTITY_IMMUTABLE");
    expect(() => repository.save({ ...fixture(), cookie: "private" } as never)).toThrow("ARCHIVE_PAYLOAD_INVALID");
  });

  it("detects payload/column drift and invalid payloads instead of sending unchecked DTOs", () => {
    const repository = environment();
    repository.save(fixture());
    database.connection.prepare("UPDATE xhs_archives SET content_id = ? WHERE id = ?").run("drift", "archive_123456");
    expect(() => repository.get("archive_123456")).toThrow("ARCHIVE_IDENTITY_MISMATCH");
    database.connection
      .prepare("UPDATE xhs_archives SET content_id = ?, payload_json = ? WHERE id = ?")
      .run("123456789", JSON.stringify({ noteId: "123456789" }), "archive_123456");
    expect(() => repository.get("archive_123456")).toThrow("ARCHIVE_PAYLOAD_INVALID");
  });
});
