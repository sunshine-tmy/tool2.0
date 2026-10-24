/** Core relocation guards: pure text/errors and isolated synthetic directory commits only. */
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createIsolatedAppFixture } from "./helpers/isolated-app";
import { ArchiveTaskError, normalizeArchiveStorageError } from "../domains/content-archive/core/provider";
import { archiveTranslationSource, archiveTranslationSourceHash } from "../domains/content-archive/core/text";
import { assertArchiveStaging, replaceArchiveDirectory } from "../domains/content-archive/core/file-gateway";

let fixture: Awaited<ReturnType<typeof createIsolatedAppFixture>>;
beforeEach(async () => {
  fixture = await createIsolatedAppFixture();
});
afterEach(async () => {
  await fixture?.dispose();
});

it.each(["ENOSPC", "EDQUOT"])("keeps %s in the same storage-error class with no underlying message", (code) => {
  const failure = normalizeArchiveStorageError(Object.assign(new Error("synthetic private path"), { code }));
  expect(failure).toBeInstanceOf(ArchiveTaskError);
  expect(failure).toMatchObject({ code: "ARCHIVE_DISK_SPACE_INSUFFICIENT", statusCode: 507 });
  expect(String(failure)).not.toContain("synthetic private path");
});
it("returns unrelated storage errors without creating another error identity", () => {
  const failure = Object.assign(new Error("synthetic busy file"), { code: "EBUSY" });
  expect(normalizeArchiveStorageError(failure)).toBe(failure);
});
it("keeps full Douyin text, original topic references and the exact hash input", () => {
  const item = {
    platform: "douyin" as const,
    title: " 商品😀 ",
    description: "展示正文",
    rawText: "原文 [表情] #完整",
    topics: [{ id: "topic_123", source: " 话题 " }]
  };
  const before = structuredClone(item);
  expect(archiveTranslationSource(item)).toEqual({ title: "商品😀", body: item.rawText, topics: item.topics });
  expect(archiveTranslationSource(item).topics).toBe(item.topics);
  const expected = createHash("sha256")
    .update(JSON.stringify({ title: "商品😀", body: item.rawText, topics: ["话题"], description: item.description }))
    .digest("hex");
  expect(archiveTranslationSourceHash(item)).toBe(expected);
  expect(item).toEqual(before);
});
it("keeps the old no-platform text/hash behavior identical to explicit Xiaohongshu", () => {
  const item = { title: " 标题 ", description: "正文 #话题", topics: [] };
  expect(archiveTranslationSourceHash(item)).toBe(archiveTranslationSourceHash({ ...item, platform: "xiaohongshu" }));
});
it.each([
  { label: "root", nested: false },
  { label: "owned child", nested: true }
])("keeps staging containment for $label", async ({ nested }) => {
  const root = path.join(fixture.root, "中文 staging");
  const child = path.join(root, "job_123456");
  await fs.mkdir(child, { recursive: true });
  if (nested) await expect(assertArchiveStaging(child, root)).resolves.toBeUndefined();
  else await expect(assertArchiveStaging(root, root)).rejects.toThrow("ARCHIVE_STAGING_PATH_INVALID");
});
async function directories() {
  const staging = path.join(fixture.root, "中文 staging");
  const target = path.join(fixture.root, "中文 items", "archive_123");
  await fs.mkdir(staging, { recursive: true });
  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(path.join(staging, "media.txt"), "new synthetic bytes");
  await fs.writeFile(path.join(target, "media.txt"), "old synthetic bytes");
  return { staging, target, backup: `${target}.previous` };
}
it("keeps the old directory until the new bytes are installed and the commit callback succeeds", async () => {
  const { staging, target, backup } = await directories();
  await replaceArchiveDirectory(staging, target, async () => {
    expect(await fs.readFile(path.join(target, "media.txt"), "utf8")).toBe("new synthetic bytes");
    expect(await fs.readFile(path.join(backup, "media.txt"), "utf8")).toBe("old synthetic bytes");
  });
  await expect(fs.stat(backup)).rejects.toMatchObject({ code: "ENOENT" });
});
it("restores old bytes and the original thrown error when directory commit fails", async () => {
  const { staging, target, backup } = await directories();
  const failure = new Error("synthetic transaction failure");
  await expect(
    replaceArchiveDirectory(staging, target, async () => {
      throw failure;
    })
  ).rejects.toBe(failure);
  expect(await fs.readFile(path.join(target, "media.txt"), "utf8")).toBe("old synthetic bytes");
  await expect(fs.stat(backup)).rejects.toMatchObject({ code: "ENOENT" });
});
it("refuses to overwrite existing recovery evidence or invoke the directory commit", async () => {
  const { staging, target, backup } = await directories();
  await fs.mkdir(backup);
  await fs.writeFile(path.join(backup, "evidence.txt"), "synthetic recovery evidence");
  let committed = false;
  await expect(
    replaceArchiveDirectory(staging, target, async () => {
      committed = true;
    })
  ).rejects.toThrow("ARCHIVE_RECOVERY_REQUIRED");
  expect(committed).toBe(false);
  expect(await fs.readFile(path.join(backup, "evidence.txt"), "utf8")).toBe("synthetic recovery evidence");
  expect(await fs.readFile(path.join(staging, "media.txt"), "utf8")).toBe("new synthetic bytes");
});
