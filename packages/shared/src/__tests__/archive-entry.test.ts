import { describe, expect, expectTypeOf, it } from "vitest";
import { Value } from "@sinclair/typebox/value";
import * as root from "../index";
import * as archive from "../archive/index";
import * as core from "../archive/content-archive";
import * as links from "../archive/media-archive-link";
import * as legacy from "../archive/xhs-archive";
import * as text from "../archive/xhs-text";
import * as douyin from "../archive/douyin-runtime";
import * as tiktok from "../archive/tiktok-runtime";
import * as imports from "../archive/archive-import";
import * as groups from "../archive/archive-groups";

describe("archive domain entry", () => {
  it("retains exact existing export names and identities, including legacy contracts", () => {
    const existing = { ...core, ...links, ...legacy, ...text, ...douyin, ...tiktok, ...imports, ...groups };
    expect(Object.keys(archive).sort()).toEqual(Object.keys(existing).sort());
    for (const [key, value] of Object.entries(existing)) {
      expect(Reflect.get(archive, key)).toBe(value);
      expect(Reflect.get(root, key)).toBe(value);
    }
    expect(archive).not.toHaveProperty("registerSharedSchemaFormats");
  });

  it("keeps neutral/legacy type identities and optional raw text", () => {
    expectTypeOf<archive.ContentArchiveItem>().toEqualTypeOf<root.ContentArchiveItem>();
    expectTypeOf<archive.XhsArchiveItem>().toEqualTypeOf<root.XhsArchiveItem>();
    expectTypeOf<archive.ContentTranslationBatchInput>().toEqualTypeOf<root.ContentTranslationBatchInput>();
    expectTypeOf<archive.ContentArchiveItem["rawText"]>().toEqualTypeOf<string | undefined>();
  });

  it("keeps batch filters and legacy request boundaries distinct", () => {
    const samples = [
      { mode: "selected", itemIds: ["archive-123"] },
      { mode: "selected", itemIds: ["archive-123", "archive-123"] },
      { mode: "missing-or-stale", filter: { platform: "douyin", keyword: "标题" } },
      { mode: "missing-or-stale", filter: { platform: "all", page: 2 } },
      { mode: "selected", itemIds: ["archive-123"], cookie: "not-allowed" }
    ];
    for (const sample of samples) {
      expect(archive.isContentTranslationBatchInput(sample)).toBe(root.isContentTranslationBatchInput(sample));
      expect([...Value.Errors(archive.ContentTranslationBatchInputSchema, sample)]).toEqual([
        ...Value.Errors(root.ContentTranslationBatchInputSchema, sample)
      ]);
    }
    expect(archive.isContentTranslationBatchInput(samples[2])).toBe(true);
    expect(archive.isLegacyTranslationBatchInput(samples[2])).toBe(false);
    expect(archive.isContentTranslationBatchInput(samples[1])).toBe(false);
  });

  it("keeps stable identity and legacy adapter output without mutating the source", () => {
    const original: archive.XhsArchiveItem = {
      id: "archive-123",
      noteId: "note-123",
      sourceUrl: "https://www.xiaohongshu.com/explore/note-123",
      canonicalUrl: "https://www.xiaohongshu.com/explore/note-123",
      type: "image",
      title: "标题",
      topics: [],
      media: [],
      fetchedAt: "2026-10-22T00:00:00.000Z",
      updatedAt: "2026-10-22T00:00:00.000Z",
      status: "ready",
      warnings: [],
      totalBytes: 0
    };
    const before = structuredClone(original);
    const converted = archive.fromXhsArchive(original);
    expect(converted).toEqual(root.fromXhsArchive(original));
    expect(archive.toXhsArchive(converted)).toEqual(original);
    expect(original).toEqual(before);
    expect(() => archive.toXhsArchive({ ...converted, platform: "douyin" })).toThrow("ARCHIVE_PLATFORM_MISMATCH");
  });

  it("keeps platform recognition, share tokens and XHS text processing unchanged", () => {
    for (const input of [
      "https://www.douyin.com/video/123456?token=example",
      "https://www.xiaohongshu.com/explore/abc?xsec_token=example",
      "https://attacker.example/video/123"
    ]) {
      expect(archive.identifyArchiveLink(input)).toEqual(root.identifyArchiveLink(input));
    }
    const input = "中文正文 #商品[话题]# [微笑R]";
    expect(archive.parseXhsContentText(input)).toEqual(root.parseXhsContentText(input));
    expect(archive.xhsTopicId("中文商品")).toBe(root.xhsTopicId("中文商品"));
  });
});
