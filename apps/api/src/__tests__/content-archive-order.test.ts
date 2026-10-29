/** Real isolated storage, repository and HTTP readers share global date ordering, never user data. */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import type { ContentArchiveItem, ContentArchiveListQuery } from "@toolbox/shared";
import { createApp } from "../app";
import { getConfig } from "../config";
import { ToolboxDatabase } from "../database/toolbox-database";
import { createDevelopmentRuntimeLayout } from "../runtime/runtime-layout";
import { ContentArchiveStore } from "../domains/content-archive/core/store";
import { ContentArchiveRepository } from "../domains/content-archive/core/repository";

let root: string;
let database: ToolboxDatabase | undefined;
let store: ContentArchiveStore;
let repository: ContentArchiveRepository;
let config: ReturnType<typeof getConfig>;
let app: Awaited<ReturnType<typeof createApp>> | undefined;
const id = (index: number) => `archive_${String(index).padStart(2, "0")}`;
const indices = Array.from({ length: 15 }, (_, index) => index);
const day = (value: number) => new Date(Date.UTC(2026, 9, value)).toISOString();
const expected: Record<NonNullable<ContentArchiveListQuery["sort"]>, number[]> = {
  "published-asc": [...indices.slice(2), 0, 1],
  "published-desc": [...indices.slice(4).reverse(), 2, 3, 0, 1],
  "archived-desc": indices,
  "archived-asc": [...indices].reverse()
};
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-archive-order-"));
  config = getConfig({
    layout: createDevelopmentRuntimeLayout({ storageRoot: root, runtimeRoot: path.join(root, "runtime") }),
    dotenvPath: false,
    environment: { NODE_ENV: "test", STORAGE_ROOT: root, DATABASE_PATH: path.join(root, "toolbox.db") }
  });
  config.desktopManagedCapabilities = true;
  database = new ToolboxDatabase(config.databasePath);
  repository = new ContentArchiveRepository(database);
  store = new ContentArchiveStore(config, database);
  // Insert in the opposite order, so ties cannot accidentally pass through insertion ordering.
  for (const index of [...indices].reverse()) {
    const item: ContentArchiveItem = {
      id: id(index),
      platform: (["xiaohongshu", "douyin", "tiktok"] as const)[index % 3]!,
      contentId: String(12345 + index),
      sourceUrl: "https://example.test/",
      canonicalUrl: "https://example.test/",
      title: "排序素材",
      topics: [],
      media: [],
      type: index % 2 ? "video" : "image",
      ...(index === 0
        ? {}
        : { publishedAt: index === 1 ? "invalid-date" : index === 3 ? "2026-10-02T08:00:00+08:00" : day(index) }),
      fetchedAt: day(15 - index),
      updatedAt: day(index + 1),
      status: "ready",
      warnings: [],
      totalBytes: 0
    };
    await store.commit(item, await store.createStaging(`stage_${index}`));
  }
});
afterEach(async () => {
  await app?.close();
  app = undefined;
  database?.close();
  database = undefined;
  if (path.dirname(root) !== os.tmpdir() || !path.basename(root).startsWith("toolbox-archive-order-"))
    throw new Error("Unsafe archive order fixture path");
  await fs.rm(root, { recursive: true, force: true });
});
it.each(["store", "repository"] as const)(
  "%s orders the entire result before paging, puts unknown dates last and stabilizes timezone ties",
  async (reader) => {
    const list = (query: ContentArchiveListQuery) => (reader === "store" ? store.list(query) : repository.list(query));
    for (const sort of Object.keys(expected) as Array<keyof typeof expected>) {
      const actual: string[] = [];
      for (let page = 1; page <= 4; page++) {
        const result = await list({ sort, page, pageSize: 4 });
        expect(result).toMatchObject({ total: 15, pageCount: 4, pageSize: 4, page });
        actual.push(...result.items.map((item) => item.id));
      }
      expect(actual).toEqual(expected[sort].map(id));
      expect(new Set(actual).size).toBe(15);
    }
    // A later translation/edit timestamp must not change the original archive date.
    expect((await list({ pageSize: 50 })).items.map((item) => item.id)).toEqual([...indices].reverse().map(id));
    const group = store.groups.save("排序分组");
    store.groups.assign({ groupId: group.id, itemIds: [1, 4, 7, 10].map(id) });
    const filter: ContentArchiveListQuery = {
      sort: "published-desc",
      platform: "douyin",
      type: "video",
      keyword: "素材",
      groupId: group.id,
      pageSize: 1
    };
    expect(await list(filter)).toMatchObject({ total: 2, pageCount: 2, items: [{ id: id(7) }] });
    expect((await list({ ...filter, page: 2 })).items[0]?.id).toBe(id(1));
  }
);
it("exposes all four orders through the real API after restart and rejects unsupported sort values", async () => {
  database!.close();
  database = undefined;
  app = await createApp({ config });
  for (const sort of Object.keys(expected) as Array<keyof typeof expected>) {
    const response = await app.inject(`/api/v1/tools/media-archive/items?sort=${sort}&pageSize=50`);
    expect(response.statusCode).toBe(200);
    expect(response.json().data.items.map((item: ContentArchiveItem) => item.id)).toEqual(expected[sort].map(id));
  }
  expect((await app.inject("/api/v1/tools/media-archive/items?sort=updated-desc")).statusCode).toBe(400);
  const previous = await app.inject("/api/v1/tools/media-archive/items?pageSize=50");
  expect(previous.json().data.items.map((item: ContentArchiveItem) => item.id)).toEqual([...indices].reverse().map(id));
});
