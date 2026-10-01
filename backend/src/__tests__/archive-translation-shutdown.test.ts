/** 自动翻译不能在共享获取服务退出后继续写库或迟到启动 Worker。 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { XhsArchiveItem } from "@toolbox/shared";
import { getConfig } from "../config";
import type { ComponentManager } from "../modules/components/component-manager";
import type { XhsArchiveStore } from "../modules/xhs-archive/store";
import { XhsTranslationService } from "../modules/xhs-archive/translation-service";
import { XhsTranslationRuntime } from "../modules/xhs-archive/translation-runtime";
import type { TaskStore } from "../tasks/task-store";

afterEach(() => vi.restoreAllMocks());
const config = () => getConfig({ dotenvPath: false, environment: { NODE_ENV: "test", DEPLOYMENT_MODE: "local" } });
function setup() {
  const items = new Map<string, XhsArchiveItem>(
    ["first_123456", "second_123456"].map((id) => [
      id,
      {
        id,
        noteId: id,
        type: "image",
        title: "翻译标题",
        description: "正文",
        topics: [],
        media: [],
        status: "ready",
        warnings: [],
        sourceUrl: "https://www.xiaohongshu.com/explore/123456789",
        canonicalUrl: "https://www.xiaohongshu.com/explore/123456789",
        totalBytes: 0,
        fetchedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ])
  );
  const get = vi.fn(async (id: string) => items.get(id));
  const updateTranslation = vi.fn(async (id: string, update: (item: XhsArchiveItem) => XhsArchiveItem) => {
    const item = items.get(id);
    if (!item) return undefined;
    const next = update(structuredClone(item));
    items.set(id, next);
    return next;
  });
  const ready = vi.fn(async (_progress: unknown, _options: unknown) => "https://translate.test");
  const stop = vi.fn(async () => undefined);
  const upsert = vi.fn();
  const service = new XhsTranslationService(
    config(),
    { get, updateTranslation } as unknown as XhsArchiveStore,
    { ensureReady: ready, stop } as unknown as XhsTranslationRuntime,
    { upsert } as unknown as TaskStore
  );
  return { service, items, get, updateTranslation, ready, stop, upsert };
}
describe("翻译有界退出", () => {
  it("运行与排队任务均中断，迟到安装进度不写库，关闭幂等并拒绝新入队", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1790812800000);
    const state = setup();
    let progress!: (value: { message: string; installProgress: number }) => void;
    let signal!: AbortSignal;
    state.ready.mockImplementation((callback, options) => {
      progress = callback as typeof progress;
      signal = (options as { signal: AbortSignal }).signal;
      return new Promise(() => undefined);
    });
    const first = (await state.service.enqueue(["first_123456"]))!;
    await vi.waitFor(() => expect(state.ready).toHaveBeenCalledOnce());
    const second = (await state.service.enqueue(["second_123456"]))!;
    expect(second.id).not.toBe(first.id);
    const closing = state.service.shutdown();
    expect(state.service.shutdown()).toBe(closing);
    await closing;
    expect(signal.aborted).toBe(true);
    for (const task of [first, second])
      expect(state.service.getTask(task.id)).toMatchObject({
        status: "failed",
        errorCode: "XHS_TRANSLATION_INTERRUPTED"
      });
    for (const item of state.items.values())
      expect(item.translation).toMatchObject({ status: "failed", error: { code: "XHS_TRANSLATION_INTERRUPTED" } });
    const calls = state.upsert.mock.calls.length;
    progress({ message: "迟到模型进度", installProgress: 100 });
    expect(state.upsert).toHaveBeenCalledTimes(calls);
    expect(await state.service.enqueue(["first_123456"])).toBeUndefined();
    expect(state.stop).toHaveBeenCalledOnce();
  });
  it("退出等待正在验证的入队操作，不允许迟到读取产生新任务", async () => {
    const state = setup();
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    state.get.mockImplementation(async (id) => {
      await pending;
      return state.items.get(id);
    });
    const enqueue = state.service.enqueue(["first_123456"]).catch((error) => error);
    const closing = state.service.shutdown();
    release();
    expect(await enqueue).toMatchObject({ code: "XHS_TRANSLATION_INTERRUPTED" });
    await closing;
    expect(state.upsert).not.toHaveBeenCalled();
    expect(state.ready).not.toHaveBeenCalled();
  });
  it("运行时预先取消不进行安装，组件检查迟到时不能启动进程", async () => {
    const controller = new AbortController();
    controller.abort(new Error("已取消"));
    const runtime = new XhsTranslationRuntime({ ...config(), desktopManagedCapabilities: true });
    await expect(runtime.ensureReady(undefined, { signal: controller.signal })).rejects.toThrow("已取消");
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const manager = {
      resolveInstalledPython: vi.fn(async () => {
        await pending;
        return { path: "never-start-python" };
      }),
      resolveInstalledAsset: vi.fn(async () => ({ path: "never-start-worker" }))
    };
    const managed = new XhsTranslationRuntime(
      { ...config(), desktopManagedCapabilities: true },
      manager as unknown as ComponentManager
    );
    const internal = managed as unknown as { startWorker: () => Promise<void> };
    const start = vi.spyOn(internal, "startWorker").mockResolvedValue();
    const active = new AbortController();
    const ready = managed.ensureReady(undefined, { signal: active.signal });
    active.abort(new Error("退出"));
    release();
    await expect(ready).rejects.toThrow("退出");
    expect(start).not.toHaveBeenCalled();
  });
});
