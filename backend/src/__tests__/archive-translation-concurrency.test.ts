/** 控制异步边界而非延长等待：迟到结果、重复入队、批量原子性与关闭都不能覆盖用户数据。 */
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { ContentArchiveItem } from "@toolbox/shared";
import { getConfig } from "../config";
import { createTaskStore } from "../tasks/task-store";
import { ContentArchiveTranslationService } from "../modules/media-archive/translation-service";
import { XhsTranslationRuntime } from "../modules/xhs-archive/translation-runtime";
import { archiveTranslationSourceHash } from "../modules/media-archive/text";

function fixture(id = "first_123456", platform: ContentArchiveItem["platform"] = "douyin"): ContentArchiveItem {
  return {
    id,
    platform,
    contentId: id,
    title: "中文标题",
    description: "中文正文",
    rawText: platform === "douyin" ? "原始中文正文" : undefined,
    type: "image",
    media: [],
    topics: [{ id: "topic_123456", source: "中文话题" }],
    totalBytes: 0,
    status: "ready",
    warnings: [],
    sourceUrl: "https://www.douyin.com/video/123456789",
    canonicalUrl: "https://www.douyin.com/video/123456789",
    fetchedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}
const nativeFetch = globalThis.fetch;
let services: ContentArchiveTranslationService[];
beforeEach(() => {
  services = [];
});
afterEach(async () => {
  for (const service of services) await service.shutdown();
  globalThis.fetch = nativeFetch;
  vi.restoreAllMocks();
});
function setup(values: ContentArchiveItem[] = [fixture()]) {
  const config = getConfig({ dotenvPath: false, environment: { NODE_ENV: "test", DEPLOYMENT_MODE: "local" } });
  const items = new Map(values.map((item) => [item.id, structuredClone(item)]));
  const get = vi.fn(async (id: string) => structuredClone(items.get(id)));
  const updateTranslation = vi.fn(async (id: string, update: (item: ContentArchiveItem) => ContentArchiveItem) => {
    const current = items.get(id);
    if (!current) return undefined;
    const next = update(structuredClone(current));
    items.set(id, next);
    return structuredClone(next);
  });
  const list = vi.fn(async (options: { page?: number }) => ({
    items: [...items.values()].slice(((options.page ?? 1) - 1) * 50, (options.page ?? 1) * 50),
    pageCount: Math.ceil(items.size / 50)
  }));
  const ready = vi.spyOn(XhsTranslationRuntime.prototype, "ensureReady").mockResolvedValue("https://translate.test");
  const stop = vi.spyOn(XhsTranslationRuntime.prototype, "stop").mockResolvedValue();
  const fetcher = vi.fn(
    async (_input: unknown, init?: RequestInit) =>
      new Response(
        JSON.stringify({ translations: JSON.parse(String(init?.body)).texts.map((text: string) => "EN:" + text) })
      )
  );
  globalThis.fetch = fetcher as typeof fetch;
  const service = new ContentArchiveTranslationService(
    config,
    { get, list, updateTranslation },
    new XhsTranslationRuntime(config),
    createTaskStore()
  );
  services.push(service);
  return { items, get, list, updateTranslation, ready, stop, fetcher, service };
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function terminal(state: ReturnType<typeof setup>, id: string) {
  await vi.waitFor(() => expect(["completed", "failed"]).toContain(state.service.getTask(id)?.status));
  return state.service.getTask(id)!;
}
function holdWorker(state: ReturnType<typeof setup>) {
  const gate = deferred();
  state.fetcher.mockImplementation(async (_input, init) => {
    await gate.promise;
    return new Response(
      JSON.stringify({ translations: JSON.parse(String(init?.body)).texts.map((text: string) => "EN:" + text) })
    );
  });
  return gate;
}

describe("双平台翻译异步一致性", () => {
  it("并发入队同一作品只创建一个任务，不重复请求模型，返回快照不可修改内部任务", async () => {
    const state = setup(),
      gate = holdWorker(state);
    const values = await Promise.all([1, 2, 3, 4].map(() => state.service.enqueue(["first_123456"])));
    expect(new Set(values.map((value) => value!.id)).size).toBe(1);
    await vi.waitFor(() => expect(state.fetcher).toHaveBeenCalledOnce());
    const snapshot = state.service.getTask(values[0]!.id)!;
    snapshot.itemIds.push("foreign_123456");
    expect(state.service.getTask(snapshot.id)!.itemIds).toEqual(["first_123456"]);
    gate.resolve();
    expect((await terminal(state, values[0]!.id)).completedItems).toBe(1);
  });
  it.each(["rawText", "description", "title"] as const)(
    "网络期间 %s 变化只拒绝旧结果，保留新原文和过期人工译文",
    async (field) => {
      const state = setup(),
        gate = holdWorker(state),
        task = (await state.service.enqueue(["first_123456"]))!;
      await vi.waitFor(() => expect(state.fetcher).toHaveBeenCalledOnce());
      const current = state.items.get("first_123456")!;
      current[field] = "更新后的中文原文";
      current.translation = {
        ...current.translation!,
        status: "stale",
        title: { ...current.translation!.title, machine: "Old machine", edited: "User edit" }
      };
      gate.resolve();
      expect(await terminal(state, task.id)).toMatchObject({
        status: "failed",
        errorCode: "ARCHIVE_TRANSLATION_SOURCE_CHANGED"
      });
      expect(state.items.get(current.id)!.translation).toMatchObject({
        status: "stale",
        title: { machine: "Old machine", edited: "User edit" }
      });
      expect(state.items.get(current.id)![field]).toBe("更新后的中文原文");
    }
  );
  it("刷新后新任务可排队，旧结果不覆盖新任务，最终译文来自新原文", async () => {
    const state = setup(),
      gate = holdWorker(state),
      first = (await state.service.enqueue(["first_123456"]))!;
    await vi.waitFor(() => expect(state.fetcher).toHaveBeenCalledOnce());
    const current = state.items.get("first_123456")!;
    current.title = "刷新后的标题";
    current.rawText = "刷新后的原文";
    const second = (await state.service.enqueue([current.id]))!;
    expect(second.id).not.toBe(first.id);
    gate.resolve();
    expect((await terminal(state, first.id)).status).toBe("failed");
    expect((await terminal(state, second.id)).status).toBe("completed");
    expect(state.items.get(current.id)!.translation).toMatchObject({
      taskId: second.id,
      title: { source: "刷新后的标题" },
      description: { source: "刷新后的原文" }
    });
  });
  it("翻译时删除存档不复活记录，任务明确失败", async () => {
    const state = setup(),
      gate = holdWorker(state),
      task = (await state.service.enqueue(["first_123456"]))!;
    await vi.waitFor(() => expect(state.fetcher).toHaveBeenCalledOnce());
    state.items.delete("first_123456");
    gate.resolve();
    expect(await terminal(state, task.id)).toMatchObject({ status: "failed", errorCode: "ARCHIVE_NOT_FOUND" });
    expect(state.items.size).toBe(0);
  });
  it("同原文的新 taskId 也阻止迟到结果，不污染新任务的编辑", async () => {
    const state = setup(),
      gate = holdWorker(state),
      task = (await state.service.enqueue(["first_123456"]))!;
    await vi.waitFor(() => expect(state.fetcher).toHaveBeenCalledOnce());
    const current = state.items.get("first_123456")!;
    current.translation = {
      ...current.translation!,
      taskId: "new_task123456",
      status: "ready",
      title: { ...current.translation!.title, edited: "Latest user edit" }
    };
    gate.resolve();
    expect((await terminal(state, task.id)).status).toBe("failed");
    expect(state.items.get(current.id)!.translation).toMatchObject({
      status: "ready",
      taskId: "new_task123456",
      title: { edited: "Latest user edit" }
    });
  });
  it("运行期间重置旧话题编辑，完成时不会从请求前快照恢复已清除的编辑", async () => {
    const state = setup();
    await terminal(state, (await state.service.enqueue(["first_123456"]))!.id);
    const current = state.items.get("first_123456")!;
    current.translation!.topics[0].edited = "Old edit";
    const gate = holdWorker(state),
      task = (await state.service.enqueue([current.id], true))!;
    await vi.waitFor(() => expect(state.fetcher).toHaveBeenCalledTimes(4));
    delete state.items.get(current.id)!.translation!.topics[0].edited;
    gate.resolve();
    await terminal(state, task.id);
    expect(state.items.get(current.id)!.translation!.topics[0].edited).toBeUndefined();
  });
  it("批次包含已运行项目时整批拒绝，不能静默丢掉尚未翻译的其他项目", async () => {
    const state = setup([fixture(), fixture("second_123456")]),
      gate = holdWorker(state);
    const task = (await state.service.enqueue(["first_123456"]))!;
    await expect(state.service.enqueue(["first_123456", "second_123456"])).rejects.toMatchObject({
      statusCode: 409,
      code: "ARCHIVE_TRANSLATION_ALREADY_RUNNING"
    });
    expect(state.items.get("second_123456")!.translation).toBeUndefined();
    gate.resolve();
    await terminal(state, task.id);
  });
  it("入队数据库失败释放所有去重键，已有部分入队标记 failed，可显式重试", async () => {
    const state = setup([fixture(), fixture("second_123456")]);
    const original = state.updateTranslation.getMockImplementation()!;
    state.updateTranslation.mockImplementationOnce(original).mockRejectedValueOnce(new Error("injected write failure"));
    await expect(state.service.enqueue(["first_123456", "second_123456"])).rejects.toThrow("injected write failure");
    expect(state.items.get("first_123456")!.translation!.status).toBe("failed");
    const task = (await state.service.enqueue(["first_123456", "second_123456"]))!;
    expect((await terminal(state, task.id)).completedItems).toBe(2);
  });
  it("队列上限 16、批次上限 100；重复请求不占新额度，关闭中断所有任务", async () => {
    const state = setup(
      Array.from({ length: 19 }, (_value, index) => fixture(`item_${String(index).padStart(6, "0")}`))
    );
    state.ready.mockReturnValue(new Promise(() => undefined));
    const first = (await state.service.enqueue(["item_000000"]))!;
    await vi.waitFor(() => expect(state.ready).toHaveBeenCalledOnce());
    for (let index = 1; index <= 16; index++) await state.service.enqueue([`item_${String(index).padStart(6, "0")}`]);
    await expect(state.service.enqueue(["item_000017"])).rejects.toMatchObject({ statusCode: 429 });
    expect((await state.service.enqueue(["item_000000"]))!.id).toBe(first.id);
    await expect(
      state.service.enqueue(Array.from({ length: 101 }, (_value, index) => `long_${index}`))
    ).rejects.toMatchObject({ statusCode: 400 });
    await state.service.shutdown();
    expect(state.service.getTask(first.id)!.errorCode).toBe("ARCHIVE_TRANSLATION_INTERRUPTED");
    for (const item of state.items.values())
      if (item.translation)
        expect(item.translation).toMatchObject({
          status: "failed",
          error: { code: "ARCHIVE_TRANSLATION_INTERRUPTED" }
        });
    expect(state.stop).toHaveBeenCalledOnce();
    expect(await state.service.enqueue(["item_000000"])).toBeUndefined();
  });
  it("分页恢复两个平台的 55 条中断状态，不自动调用模型或删除媒体", async () => {
    const state = setup(
      Array.from({ length: 55 }, (_value, index) =>
        fixture(`item_${String(index).padStart(6, "0")}`, index % 2 ? "douyin" : "xiaohongshu")
      )
    );
    for (const item of state.items.values())
      item.translation = {
        status: "translating",
        sourceHash: archiveTranslationSourceHash(item),
        sourceLanguage: "zh-CN",
        targetLanguage: "en",
        provider: "opus-mt",
        modelId: "Helsinki-NLP/opus-mt-zh-en",
        modelRevision: "fixed",
        title: { source: item.title, machine: "Old", edited: "User" },
        topics: []
      };
    await state.service.recoverInterrupted();
    expect(state.list).toHaveBeenCalledTimes(2);
    expect(state.items.size).toBe(55);
    for (const item of state.items.values())
      expect(item.translation).toMatchObject({
        status: "failed",
        title: { edited: "User" },
        error: { code: item.platform === "douyin" ? "ARCHIVE_TRANSLATION_INTERRUPTED" : "XHS_TRANSLATION_INTERRUPTED" }
      });
    expect(state.ready).not.toHaveBeenCalled();
  });
  it("没有汉字的原文无需安装模型，纯文本仍按相同状态流程保存", async () => {
    const item = fixture();
    item.title = "English";
    item.description = "English body";
    item.rawText = "English body";
    item.topics = [];
    const state = setup([item]),
      task = (await state.service.enqueue([item.id]))!;
    expect((await terminal(state, task.id)).status).toBe("completed");
    expect(state.ready).not.toHaveBeenCalled();
    expect(state.fetcher).not.toHaveBeenCalled();
    expect(state.items.get(item.id)!.translation!.description!.machine).toBe(item.rawText);
  });
});
