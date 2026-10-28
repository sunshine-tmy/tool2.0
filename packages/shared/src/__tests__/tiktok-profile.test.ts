import { expect, it } from "vitest";
import { Value } from "@sinclair/typebox/value";
import {
  normalizeTikTokProfileLink,
  identifyArchiveLink,
  TikTokProfileInputSchema,
  TikTokProfileStartSchema
} from "../index";
it("recognizes canonical HTTPS profiles without widening single-work inputs or preserving tracking credentials", () => {
  expect(normalizeTikTokProfileLink("https://www.tiktok.com/@SuperNutriSilite?_r=1&_t=example")).toEqual({
    username: "supernutrisilite",
    url: "https://www.tiktok.com/@supernutrisilite"
  });
  for (const input of [
    "http://www.tiktok.com/@user",
    "https://www.tiktok.com.evil.test/@user",
    "https://user:pass@www.tiktok.com/@user",
    "https://www.tiktok.com:8443/@user",
    "https://www.tiktok.com/@user/video/12345",
    "https://vt.tiktok.com/AAAAA/",
    "not-url",
    "https://www.tiktok.com/@../escape"
  ])
    expect(normalizeTikTokProfileLink(input)).toBeUndefined();
  expect(identifyArchiveLink("https://www.tiktok.com/@user").ok).toBe(false);
  expect(Value.Check(TikTokProfileInputSchema, { url: "https://www.tiktok.com/@user", cookie: "forbidden" })).toBe(
    false
  );
});
it("bounds selections and requires a deliberate partial-list decision", () => {
  const input = { selection: "selected", itemIds: ["12345"], existing: "skip", allowPartial: false };
  expect(Value.Check(TikTokProfileStartSchema, input)).toBe(true);
  for (const invalid of [
    { ...input, allowPartial: undefined },
    { ...input, itemIds: ["12345", "12345"] },
    { ...input, itemIds: Array.from({ length: 10001 }, (_, i) => String(12345 + i)) },
    { ...input, existing: "overwrite" },
    { ...input, cookie: "forbidden" }
  ])
    expect(Value.Check(TikTokProfileStartSchema, invalid)).toBe(false);
});
