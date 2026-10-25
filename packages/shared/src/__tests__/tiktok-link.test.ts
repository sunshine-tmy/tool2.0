import { describe, expect, it } from "vitest";
import { identifyArchiveLink } from "../archive/media-archive-link";
import {
  ArchivePlatformSchema,
  ContentArchiveCreateInputSchema,
  ContentArchiveListQuerySchema,
  ContentTranslationBatchInputSchema
} from "../archive/content-archive";
import { Value } from "@sinclair/typebox/value";

describe("TikTok public work links", () => {
  it.each([
    "https://vt.tiktok.com/ZSgQrEYNG/",
    "https://vm.tiktok.com/Z1234/",
    "https://www.tiktok.com/t/Z12345/",
    "https://www.tiktok.com/@shop/video/7700596613189963029",
    "https://www.tiktok.com/@shop/photo/7700458638191627540?share=public"
  ])("accepts one public work link: %s", (url) => {
    expect(identifyArchiveLink(`分享 ${url}。`)).toEqual({ ok: true, platform: "tiktok", url });
    expect(identifyArchiveLink(url, "tiktok").ok).toBe(true);
  });
  it.each([
    "http://vt.tiktok.com/Z123/",
    "https://tiktok.com.evil.test/@shop/video/12345",
    "https://www.tiktok.com/@shop",
    "https://www.tiktok.com/@shop/live",
    "https://www.tiktok.com/search?q=x",
    "https://name:password@www.tiktok.com/@shop/video/12345",
    "https://www.tiktok.com:444/@shop/video/12345"
  ])("rejects unsupported or disguised input: %s", (url) => expect(identifyArchiveLink(url).ok).toBe(false));
  it("keeps platform mismatch and single-link restrictions", () => {
    expect(identifyArchiveLink("https://vt.tiktok.com/Z123/", "douyin").ok).toBe(false);
    expect(identifyArchiveLink("https://vt.tiktok.com/Z123/ https://vt.tiktok.com/Z456/").ok).toBe(false);
    expect(Value.Check(ArchivePlatformSchema, "tiktok")).toBe(true);
    expect(Value.Check(ArchivePlatformSchema, "instagram")).toBe(false);
    expect(
      Value.Check(ContentArchiveCreateInputSchema, { url: "https://vt.tiktok.com/Z123/", platform: "tiktok" })
    ).toBe(true);
    expect(Value.Check(ContentArchiveListQuerySchema, { platform: "tiktok" })).toBe(true);
    expect(
      Value.Check(ContentTranslationBatchInputSchema, { mode: "missing-or-stale", filter: { platform: "tiktok" } })
    ).toBe(true);
  });
});
