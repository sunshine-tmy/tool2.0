/** 隔离库与生产路由验收：两平台文本、事务内冲突、筛选批次和旧接口可见性；Worker 使用固定夹具。 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { type ContentArchiveItem, type ContentTranslationTask, isContentTranslationTask } from "@toolbox/shared";
import { createApp } from "../app";
import { getConfig } from "../config";
import { ToolboxDatabase } from "../database/toolbox-database";
import { ContentArchiveStore } from "../modules/media-archive/store";
import { archiveTranslationSourceHash } from "../modules/media-archive/text";
import { XhsTranslationRuntime } from "../modules/xhs-archive/translation-runtime";
import {
  ContentArchiveTranslationService,
  ArchiveTranslationError
} from "../modules/media-archive/translation-service";
import { readArchiveZip } from "./helpers/archive-zip";

const base = "/api/v1/tools/media-archive",
  old = "/api/v1/tools/xhs-archive";
const nativeFetch = globalThis.fetch;
let root: string, config: ReturnType<typeof getConfig>, png: Buffer, apps: FastifyInstance[];
let provider: ReturnType<typeof vi.fn<(texts: string[]) => Promise<string[]>>>;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-archive-translation-"));
  apps = [];
  config = getConfig({
    dotenvPath: false,
    environment: {
      NODE_ENV: "test",
      DEPLOYMENT_MODE: "local",
      STORAGE_ROOT: root,
      DATABASE_PATH: path.join(root, "toolbox.db")
    }
  });
  png = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#4488cc" } })
    .png()
    .toBuffer();
  vi.spyOn(XhsTranslationRuntime.prototype, "ensureReady").mockResolvedValue("https://translation.test");
  provider = vi.fn(async (texts) => texts.map((text) => `EN:${text}`));
  globalThis.fetch = vi.fn(async (input, init) => {
    if (String(input) !== "https://translation.test/translate") throw new Error("该测试禁止平台网络访问");
    return new Response(JSON.stringify({ translations: await provider(JSON.parse(String(init?.body)).texts) }), {
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;
});
afterEach(async () => {
  for (const app of apps) await app.close().catch(() => undefined);
  vi.restoreAllMocks();
  globalThis.fetch = nativeFetch;
  if (
    !path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep) ||
    !path.basename(root).startsWith("toolbox-archive-translation-")
  )
    throw new Error("清理目录越界");
  await fs.rm(root, { recursive: true, force: true });
});
async function seed(
  platform: ContentArchiveItem["platform"] = "douyin",
  id = `${platform}_archive123`,
  title = "中文标题"
) {
  const database = new ToolboxDatabase(config.databasePath);
  try {
    const store = new ContentArchiveStore(config, database);
    const source =
      platform === "douyin" ? `https://www.douyin.com/video/${id}` : `https://www.xiaohongshu.com/explore/${id}`;
    const item: ContentArchiveItem = {
      id,
      platform,
      contentId: id,
      title,
      description: "展示正文[彩虹R] #话题[话题]#",
      rawText:
        platform === "douyin" ? "抖音原文[彩虹R]\n中文正文 @author 2026 https://example.test #话题[话题]#" : undefined,
      topics: [{ id: "topic_123456", source: "话题" }],
      type: "image",
      sourceUrl: source,
      canonicalUrl: source,
      fetchedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      warnings: [],
      status: "ready",
      totalBytes: png.length,
      media: [
        {
          id: `${id}_media`,
          kind: "image",
          index: 0,
          fileName: "image.png",
          mimeType: "image/png",
          size: png.length,
          checksum: createHash("sha256").update(png).digest("hex"),
          previewUrl: `${base}/items/${id}/media/${id}_media`,
          downloadUrl: `${base}/items/${id}/media/${id}_media?download=1`
        }
      ]
    };
    const staging = await store.createStaging(`${id}_stage`);
    await fs.writeFile(path.join(staging, "image.png"), png);
    return await store.commit(item, staging);
  } finally {
    database.close();
  }
}
async function appWith() {
  const app = await createApp({ config });
  apps.push(app);
  return app;
}
async function detail(app: FastifyInstance, id: string) {
  return (await app.inject(`${base}/items/${id}`)).json().data as ContentArchiveItem;
}
async function terminal(app: FastifyInstance, id: string) {
  let value!: ContentTranslationTask;
  await vi.waitFor(async () => {
    const response = await app.inject(`${base}/translation/tasks/${id}`);
    expect(response.statusCode).toBe(200);
    value = response.json().data;
    expect(isContentTranslationTask(value)).toBe(true);
    expect(["completed", "failed"]).toContain(value.status);
  });
  return value;
}
async function translate(app: FastifyInstance, id: string, force = false) {
  const response = await app.inject({ method: "POST", url: `${base}/items/${id}/translation`, payload: { force } });
  expect(response.statusCode).toBe(202);
  return terminal(app, response.json().data.id);
}
const edit = (item: ContentArchiveItem, title = "User title") => ({
  sourceHash: item.translation!.sourceHash,
  title: { edited: title },
  description: { edited: "User body" },
  topics: [{ topicId: "topic_123456", edited: "User topic" }]
});

describe("双平台共用翻译契约", () => {
  it("单条/批次队列错误映射稳定错误码，非领域异常按全局 500 契约处理", async () => {
    const item = await seed(),
      xhs = await seed("xiaohongshu"),
      app = await appWith();
    const enqueue = vi.spyOn(ContentArchiveTranslationService.prototype, "enqueue");
    for (const prefix of [base, old]) {
      for (const batch of [false, true]) {
        const id = prefix === old ? xhs.id : item.id;
        for (const domain of [true, false]) {
          enqueue.mockRejectedValueOnce(
            domain
              ? new ArchiveTranslationError("ARCHIVE_TRANSLATION_QUEUE_FULL", "队列已满", 429)
              : new Error("injected enqueue failure")
          );
          const response = await app.inject({
            method: "POST",
            url: batch ? `${prefix}/translation/batches` : `${prefix}/items/${id}/translation`,
            payload: batch ? { mode: "selected", itemIds: [id] } : {}
          });
          expect(response.statusCode).toBe(domain ? 429 : 500);
          expect(response.json().success).toBe(false);
          if (domain)
            expect(response.json().error.code).toBe(
              prefix === old ? "XHS_TRANSLATION_QUEUE_FULL" : "ARCHIVE_TRANSLATION_QUEUE_FULL"
            );
        }
      }
    }
    enqueue.mockRestore();
  });
  it("缺失补全分页只取前 100 条，运行时接口与空译文重置可正常返回", async () => {
    const item = await seed(),
      app = await appWith();
    const listed = vi.spyOn(ContentArchiveStore.prototype, "list").mockImplementation(async ({ page = 1 } = {}) => ({
      items: Array.from({ length: page === 3 ? 5 : 50 }, (_value, index) => ({
        ...item,
        id: `page_${String((page - 1) * 50 + index).padStart(6, "0")}`,
        mediaCount: 1
      })),
      total: 105,
      page,
      pageSize: 50,
      pageCount: 3
    }));
    const enqueue = vi.spyOn(ContentArchiveTranslationService.prototype, "enqueue").mockResolvedValueOnce(undefined);
    const response = await app.inject({
      method: "POST",
      url: `${base}/translation/batches`,
      payload: { mode: "missing-or-stale", filter: { platform: "douyin" } }
    });
    expect(response.statusCode).toBe(200);
    expect(listed).toHaveBeenCalledTimes(2);
    expect(enqueue.mock.calls[0][0]).toHaveLength(100);
    listed.mockRestore();
    enqueue.mockRestore();
    for (const prefix of [base, old]) expect((await app.inject(`${prefix}/translation/runtime`)).statusCode).toBe(200);
    expect(
      (await app.inject({ method: "POST", url: `${base}/items/${item.id}/translation/reset` })).json().data
    ).toBeNull();
  });
  it("未提交的正文/话题编辑不被清空，事务异常不返回虚假的保存成功", async () => {
    const item = await seed(),
      app = await appWith();
    await translate(app, item.id);
    const before = await detail(app, item.id),
      url = `${base}/items/${item.id}/translation`;
    const response = await app.inject({
      method: "PATCH",
      url,
      payload: { sourceHash: before.translation!.sourceHash, title: { edited: "Only title" }, topics: [] }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.description).toEqual(before.translation!.description);
    expect(response.json().data.topics).toEqual(before.translation!.topics);
    const failure = vi
      .spyOn(ContentArchiveStore.prototype, "updateTranslation")
      .mockRejectedValueOnce(new Error("injected edit write failure"));
    expect((await app.inject({ method: "PATCH", url, payload: edit(before, "Must not commit") })).statusCode).toBe(500);
    failure.mockRestore();
    expect((await detail(app, item.id)).translation!.title.edited).toBe("Only title");
  });
  it.each(["xiaohongshu", "douyin"] as const)(
    "%s 翻译保留平台原文/保护标记，完成计数与统一任务一致",
    async (platform) => {
      const item = await seed(platform),
        app = await appWith();
      const task = await translate(app, item.id),
        saved = await detail(app, item.id);
      expect(task).toMatchObject({ status: "completed", completedItems: 1, totalItems: 1 });
      expect(saved.translation).toMatchObject({
        status: "ready",
        sourceHash: archiveTranslationSourceHash(saved),
        title: { source: item.title }
      });
      expect(saved.rawText).toBe(item.rawText);
      expect(saved.description).toBe(item.description);
      expect(saved.translation!.description!.source).toBe(platform === "douyin" ? item.rawText : "展示正文🌈");
      if (platform === "douyin")
        for (const literal of ["[彩虹R]", "@author", "2026", "https://example.test"])
          expect(saved.translation!.description!.machine).toContain(literal);
      expect((await app.inject(`/api/v1/tasks/${task.id}`)).json().data.toolId).toBe(
        platform === "douyin" ? "media-archive-translation" : "xhs-translation"
      );
      const noop = await app.inject({ method: "POST", url: `${base}/items/${item.id}/translation`, payload: {} });
      expect(noop.statusCode).toBe(200);
    }
  );
  it("编辑、重翻译、重置、ZIP 与重启共用同一份元数据，机器译文不丢失", async () => {
    const item = await seed(),
      app = await appWith();
    await translate(app, item.id);
    const before = await detail(app, item.id);
    const edited = await app.inject({
      method: "PATCH",
      url: `${base}/items/${item.id}/translation`,
      payload: edit(before)
    });
    expect(edited.statusCode).toBe(200);
    expect(edited.json().data.title).toMatchObject({
      machine: before.translation!.title.machine,
      edited: "User title"
    });
    await translate(app, item.id, true);
    expect((await detail(app, item.id)).translation!.title.edited).toBe("User title");
    const zip = readArchiveZip((await app.inject(`${base}/items/${item.id}/download.zip`)).rawPayload);
    expect(zip.get("Content-English.txt")!.toString()).toContain("User title");
    expect(zip.get("内容-中英双语.txt")!.toString()).toContain(item.rawText);
    await app.close();
    const restarted = await appWith();
    expect((await detail(restarted, item.id)).translation!.title.edited).toBe("User title");
    for (const route of ["/health/live", "/health/ready"]) expect((await restarted.inject(route)).statusCode).toBe(200);
    const reset = await restarted.inject({ method: "POST", url: `${base}/items/${item.id}/translation/reset` });
    expect(reset.statusCode).toBe(200);
    expect(reset.json().data.title).not.toHaveProperty("edited");
    expect(reset.json().data.title.machine).toBe(before.translation!.title.machine);
  });
  it("混合平台批次计数正确，旧入口仅看到小红书 ID/计数，纯抖音任务返回 404", async () => {
    const dy = await seed(),
      xhs = await seed("xiaohongshu"),
      app = await appWith();
    const response = await app.inject({
      method: "POST",
      url: `${base}/translation/batches`,
      payload: { mode: "selected", itemIds: [dy.id, xhs.id] }
    });
    expect(response.statusCode).toBe(202);
    const task = await terminal(app, response.json().data.id);
    expect(task).toMatchObject({ completedItems: 2, totalItems: 2 });
    const legacy = (await app.inject(`${old}/translation/tasks/${task.id}`)).json().data;
    expect(legacy).toMatchObject({ itemIds: [xhs.id], totalItems: 1, completedItems: 1 });
    expect(legacy.currentItemId).not.toBe(dy.id);
    const dyTask = await translate(app, dy.id, true);
    expect((await app.inject(`${old}/translation/tasks/${dyTask.id}`)).statusCode).toBe(404);
    for (const method of ["POST", "PATCH"] as const) {
      const response = await app.inject({
        method,
        url: `${old}/items/${dy.id}/translation`,
        payload: method === "PATCH" ? edit(await detail(app, dy.id)) : {}
      });
      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe("XHS_ARCHIVE_NOT_FOUND");
    }
    expect((await app.inject({ method: "POST", url: `${old}/items/${dy.id}/translation/reset` })).statusCode).toBe(404);
  });
  it("补全缺失译文限定平台/关键词/类型筛选，不翻译筛选外作品", async () => {
    const selected = await seed("douyin", "selected_123456", "目标作品"),
      other = await seed("douyin", "other_123456", "其他作品"),
      xhs = await seed("xiaohongshu"),
      app = await appWith();
    const response = await app.inject({
      method: "POST",
      url: `${base}/translation/batches`,
      payload: { mode: "missing-or-stale", filter: { platform: "douyin", keyword: "目标", type: "image" } }
    });
    expect(response.statusCode).toBe(202);
    expect((await terminal(app, response.json().data.id)).itemIds).toEqual([selected.id]);
    for (const id of [other.id, xhs.id]) expect((await detail(app, id)).translation).toBeUndefined();
    const noop = await app.inject({
      method: "POST",
      url: `${base}/translation/batches`,
      payload: { mode: "missing-or-stale", filter: { keyword: "不存在" } }
    });
    expect(noop.statusCode).toBe(200);
  });
  it("原文在事务获取时变化，旧编辑请求返回 409，不把过期译文标成 ready", async () => {
    const item = await seed(),
      app = await appWith();
    await translate(app, item.id);
    const before = await detail(app, item.id);
    const original = ContentArchiveStore.prototype.updateTranslation;
    const spy = vi.spyOn(ContentArchiveStore.prototype, "updateTranslation").mockImplementationOnce(async function (
      this: ContentArchiveStore,
      id,
      update
    ) {
      await original.call(this, id, (current) => ({
        ...current,
        rawText: "刷新后的真正原文",
        translation: { ...current.translation!, status: "stale" }
      }));
      return original.call(this, id, update);
    });
    const response = await app.inject({
      method: "PATCH",
      url: `${base}/items/${item.id}/translation`,
      payload: edit(before)
    });
    spy.mockRestore();
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe("ARCHIVE_TRANSLATION_SOURCE_CHANGED");
    expect((await detail(app, item.id)).translation).toMatchObject({
      status: "stale",
      title: { machine: before.translation!.title.machine }
    });
    expect((await detail(app, item.id)).translation!.title.edited).toBeUndefined();
  });
  it("无译文/未知话题/重复话题均拒绝，不写入伪造编辑", async () => {
    const item = await seed(),
      app = await appWith();
    const raw = { sourceHash: archiveTranslationSourceHash(item), title: { edited: "Title" }, topics: [] };
    expect(
      (await app.inject({ method: "PATCH", url: `${base}/items/${item.id}/translation`, payload: raw })).statusCode
    ).toBe(409);
    await translate(app, item.id);
    const before = await detail(app, item.id);
    for (const topics of [
      [{ topicId: "foreign", edited: "X" }],
      [
        { topicId: "topic_123456", edited: "X" },
        { topicId: "topic_123456", edited: "Y" }
      ]
    ]) {
      const response = await app.inject({
        method: "PATCH",
        url: `${base}/items/${item.id}/translation`,
        payload: { ...edit(before), topics }
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("ARCHIVE_TRANSLATION_TOPIC_INVALID");
    }
    expect((await detail(app, item.id)).translation!.title.edited).toBeUndefined();
  });
  it.each([
    { mode: "selected", itemIds: [] },
    { mode: "selected", itemIds: ["same_123456", "same_123456"] },
    { mode: "missing-or-stale", filter: { platform: "tiktok" } },
    { mode: "missing-or-stale", filter: { page: 2 } },
    { mode: "missing-or-stale", cookie: "secret" },
    { mode: "missing-or-stale", filter: { cookie: "secret" } }
  ])("批次异常输入在 AJV 移除字段之前拒绝：%j", async (payload) => {
    const app = await appWith();
    const response = await app.inject({ method: "POST", url: `${base}/translation/batches`, payload });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      success: false,
      error: { code: "REQUEST_INVALID" },
      requestId: expect.any(String)
    });
    expect(provider).not.toHaveBeenCalled();
  });
  it("未知凭据/错误参数/缺失资源具有失败契约，旧批次不会处理抖音", async () => {
    const item = await seed(),
      app = await appWith();
    expect(
      (await app.inject({ method: "POST", url: `${base}/items/${item.id}/translation`, payload: { cookie: "secret" } }))
        .statusCode
    ).toBe(400);
    const responses = await Promise.all([
      app.inject({ method: "POST", url: `${base}/items/missing_123456/translation`, payload: {} }),
      app.inject({
        method: "PATCH",
        url: `${base}/items/missing_123456/translation`,
        payload: { sourceHash: "a".repeat(64), title: { edited: "Title" }, topics: [] }
      }),
      app.inject({ method: "POST", url: `${base}/items/missing_123456/translation/reset` }),
      app.inject(`${base}/translation/tasks/missing_task123`),
      app.inject({
        method: "POST",
        url: `${base}/translation/batches`,
        payload: { mode: "selected", itemIds: [item.id, "missing_123456"] }
      })
    ]);
    for (const response of responses) expect(response.statusCode).toBe(404);
    expect(responses[0].json().error.code).toBe("ARCHIVE_NOT_FOUND");
    const legacy = await app.inject({
      method: "POST",
      url: `${old}/translation/batches`,
      payload: { mode: "missing-or-stale" }
    });
    expect(legacy.statusCode).toBe(200);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `${old}/translation/batches`,
          payload: { mode: "selected", itemIds: [item.id] }
        })
      ).statusCode
    ).toBe(404);
    expect((await app.inject(`${base}/translation/tasks/bad!`)).statusCode).toBe(400);
    expect(provider).not.toHaveBeenCalled();
  });
  it("LAN 翻译与编辑需要管理员和 CSRF，访客不能管理", async () => {
    const item = await seed();
    config.deploymentMode = "lan";
    config.adminPin = "123456";
    config.corsOrigins = ["http://127.0.0.1:5173"];
    const app = await appWith(),
      url = `${base}/items/${item.id}/translation`;
    expect((await app.inject({ method: "POST", url, payload: {} })).statusCode).toBe(401);
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/session",
      payload: { pin: "123456" },
      headers: { origin: config.corsOrigins[0] }
    });
    const cookie = String(login.headers["set-cookie"]).split(";")[0],
      headers = { cookie, origin: config.corsOrigins[0], "x-csrf-token": login.json().data.csrfToken };
    expect(
      (await app.inject({ method: "POST", url, payload: {}, headers: { cookie, origin: headers.origin } })).statusCode
    ).toBe(403);
    expect(
      (await app.inject({ method: "POST", url, payload: {}, headers: { ...headers, origin: "http://attacker.test" } }))
        .statusCode
    ).toBe(403);
    const started = await app.inject({ method: "POST", url, payload: {}, headers });
    expect(started.statusCode).toBe(202);
    // LAN 查询也要求会话，直接从等待后的详情读取任务落库结果，不放开访客接口。
    await vi.waitFor(async () =>
      expect((await app.inject({ url: `${base}/items/${item.id}`, headers })).json().data.translation.status).toBe(
        "ready"
      )
    );
    expect((await app.inject({ method: "POST", url: url + "/reset", headers })).statusCode).toBe(200);
  });
  it("Worker 失败保留归档，可显式重试，错误码采用中性前缀", async () => {
    const item = await seed(),
      app = await appWith();
    provider.mockRejectedValueOnce(new Error("固定 Worker 失败"));
    const failed = await translate(app, item.id);
    expect(failed).toMatchObject({ status: "failed", errorCode: "ARCHIVE_TRANSLATION_FAILED" });
    expect((await detail(app, item.id)).translation).toMatchObject({
      status: "failed",
      error: { code: "ARCHIVE_TRANSLATION_FAILED" }
    });
    expect((await translate(app, item.id)).status).toBe("completed");
    expect((await detail(app, item.id)).media).toHaveLength(1);
  });
});
