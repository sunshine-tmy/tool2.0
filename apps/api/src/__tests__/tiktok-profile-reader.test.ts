import { EventEmitter } from "node:events";
import { expect, it, vi } from "vitest";
import type { Page, Response } from "playwright-core";
import {
  TikTokProfileReader,
  readProfileWorks,
  type ProfileDiscovery
} from "../domains/content-archive/providers/tiktok/profile-reader";
type State = { scripts: string[]; links: Array<{ url: string; title: string }>; waiting: boolean };
const state = (): State => ({
  scripts: [
    JSON.stringify({
      __DEFAULT_SCOPE__: {
        "webapp.user-detail": { userInfo: { user: { uniqueId: "shop", secUid: "sec-user" }, stats: { videoCount: 2 } } }
      }
    })
  ],
  links: [],
  waiting: false
});
function page(initial = state(), received?: Partial<Response>, location = "https://www.tiktok.com/@shop") {
  const events = new EventEmitter();
  const mainFrame = {};
  const value = Object.assign(events, {
    mainFrame: () => mainFrame,
    isClosed: (): boolean => false,
    url: () => location,
    goto: vi.fn(async () => {
      if (received) events.emit("response", received);
      return { status: () => 200 };
    }),
    evaluate: vi.fn(async (fn: () => unknown) => (fn.toString().includes("scrollBy") ? undefined : initial))
  });
  return value as typeof value & Page;
}
const api = (value: unknown, owner = "sec-user"): Partial<Response> => ({
  url: () => `https://www.tiktok.com/api/post/item_list/?secUid=${owner}&cursor=0`,
  status: () => 200,
  headers: () => ({}),
  body: async () => Buffer.from(JSON.stringify(value))
});
const item = (id: string) => ({ id, author: { uniqueId: "shop" } });
it("captures early normal-browser responses, verifies the end marker and releases its listener", async () => {
  const browser = page(
    state(),
    api({ statusCode: 0, cursor: "20", hasMore: false, itemList: [item("12345"), item("12346")] })
  );
  const update = vi.fn();
  const result = await readProfileWorks(browser, "shop", new AbortController().signal, update, [], { stallMs: 0 });
  expect(result.complete).toBe(true);
  expect(result.works).toHaveLength(2);
  expect(browser.listenerCount("response")).toBe(0);
  expect(update).toHaveBeenCalled();
});
it("keeps same-owner DOM links as incomplete discoveries and ignores another user's pagination", async () => {
  const initial = state();
  initial.links = [{ url: "https://www.tiktok.com/@shop/photo/12345", title: "商品" }];
  const browser = page(
    initial,
    api({ statusCode: 0, cursor: "20", hasMore: false, itemList: [item("12345"), item("12346")] }, "another-user")
  );
  const result = await readProfileWorks(browser, "shop", new AbortController().signal, vi.fn(), [], { stallMs: 0 });
  expect(result.complete).toBe(false);
  expect(result.works).toHaveLength(1);
  expect(browser.listenerCount("response")).toBe(0);
});
it("does not publish a complete result after a concurrent platform refusal", async () => {
  const browser = page();
  browser.goto.mockImplementationOnce(async () => {
    browser.emit("response", { ...api({}), status: () => 429 });
    browser.emit(
      "response",
      api({ statusCode: 0, cursor: "20", hasMore: false, itemList: [item("12345"), item("12346")] })
    );
    return { status: () => 200 };
  });
  await expect(
    readProfileWorks(browser, "shop", new AbortController().signal, vi.fn(), [], { stallMs: 0 })
  ).rejects.toMatchObject({ code: "TIKTOK_RATE_LIMITED" });
  expect(browser.listenerCount("response")).toBe(0);
});
it("retains partial progress when the platform ends below its declared count or the browser closes", async () => {
  const browser = page(state(), api({ statusCode: 0, cursor: "20", hasMore: false, itemList: [item("12345")] }));
  const value = await readProfileWorks(browser, "shop", new AbortController().signal, vi.fn());
  expect(value).toMatchObject({ complete: false, declaredCount: 2 });
  expect(value.works).toHaveLength(1);
  const closed = page();
  closed.isClosed = () => true;
  const seed = [{ id: "12345", url: "https://www.tiktok.com/@shop/video/12345" }];
  const result = await readProfileWorks(closed, "shop", new AbortController().signal, vi.fn(), seed);
  expect(result.works).toEqual(seed);
  expect(result.complete).toBe(false);
  expect(closed.listenerCount("response")).toBe(0);
});
it("treats an empty platform response as waiting for normal browser interaction, never as a complete empty account", async () => {
  const controller = new AbortController(),
    browser = page(state(), { ...api({}), body: async () => Buffer.alloc(0) });
  await expect(
    readProfileWorks(
      browser,
      "shop",
      controller.signal,
      (snapshot) => {
        expect(snapshot.complete).toBe(false);
        expect(snapshot.waitingUser).toBe(true);
        expect(snapshot.message).toContain("空响应（HTTP 200）");
        expect(snapshot.message).toContain("不等于必须登录");
        controller.abort();
      },
      [],
      { pollMs: 1 }
    )
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(browser.listenerCount("response")).toBe(0);
});
it("continues after a manual refresh destroys the execution context and clears the empty-response warning on recovery", async () => {
  const browser = page(state(), { ...api({}), body: async () => Buffer.alloc(0) });
  const updates: ProfileDiscovery[] = [];
  let refreshed = false;
  const result = await readProfileWorks(
    browser,
    "shop",
    new AbortController().signal,
    (snapshot) => {
      updates.push(snapshot);
      if (!refreshed && snapshot.message.includes("空响应")) {
        refreshed = true;
        browser.emit("framenavigated", browser.mainFrame());
        browser.evaluate.mockRejectedValueOnce(
          new Error("Execution context was destroyed, most likely because of a navigation.")
        );
        browser.evaluate.mockImplementationOnce(async () => {
          browser.emit(
            "response",
            api({ statusCode: 0, cursor: "20", hasMore: false, itemList: [item("12345"), item("12346")] })
          );
          return state();
        });
      }
    },
    [{ id: "12345", url: "https://www.tiktok.com/@shop/video/12345" }],
    { pollMs: 1 }
  );
  expect(result).toMatchObject({ complete: true, waitingUser: false });
  expect(result.works).toHaveLength(2);
  expect(updates.some((value) => value.message.includes("正在刷新或跳转"))).toBe(true);
  expect(browser.listenerCount("response")).toBe(0);
  expect(browser.listenerCount("requestfailed")).toBe(0);
  expect(browser.listenerCount("framenavigated")).toBe(0);
});
it("resumes normal discovery when an initial empty response is followed by valid public data without login or refresh", async () => {
  const browser = page(state(), { ...api({}), body: async () => Buffer.alloc(0) });
  let waited = false;
  const result = await readProfileWorks(
    browser,
    "shop",
    new AbortController().signal,
    (snapshot) => {
      if (!waited && snapshot.waitingUser) {
        waited = true;
        browser.emit(
          "response",
          api({ statusCode: 0, cursor: "20", hasMore: false, itemList: [item("12345"), item("12346")] })
        );
      }
    },
    [],
    { pollMs: 1 }
  );
  expect(waited).toBe(true);
  expect(result).toMatchObject({ complete: true, waitingUser: false });
  expect(result.works).toHaveLength(2);
  expect(browser.goto).toHaveBeenCalledOnce();
  expect(browser.eventNames()).toEqual([]);
});
it("reports retained discoveries when a later page is empty without declaring the profile complete", async () => {
  const browser = page(
    state(),
    api({ statusCode: 0, cursor: "20", hasMore: true, itemList: [item("12345"), item("12346")] })
  );
  const controller = new AbortController();
  let sentEmpty = false;
  await expect(
    readProfileWorks(
      browser,
      "shop",
      controller.signal,
      (snapshot) => {
        expect(snapshot.complete).toBe(false);
        expect(snapshot.works).toHaveLength(2);
        if (!sentEmpty) {
          sentEmpty = true;
          browser.emit("response", {
            ...api({}),
            url: () => "https://www.tiktok.com/api/post/item_list/?secUid=sec-user&cursor=20",
            body: async () => Buffer.alloc(0)
          });
        } else {
          expect(snapshot.waitingUser).toBe(true);
          expect(snapshot.message).toContain("当前已发现 2 条作品");
          controller.abort();
        }
      },
      [],
      { pollMs: 1 }
    )
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(browser.eventNames()).toEqual([]);
});
it("ignores a late old-document response after refresh and preserves discovered links", async () => {
  let resolve!: (body: Buffer) => void;
  const controller = new AbortController();
  const browser = page(state(), {
    ...api({}),
    body: () =>
      new Promise<Buffer>((done) => {
        resolve = done;
      })
  });
  let updates = 0;
  const result = readProfileWorks(
    browser,
    "shop",
    controller.signal,
    (snapshot) => {
      expect(snapshot.complete).toBe(false);
      expect(snapshot.works).toHaveLength(1);
      if (updates++ === 0) {
        browser.emit("framenavigated", {});
        browser.emit("framenavigated", browser.mainFrame());
        resolve(
          Buffer.from(
            JSON.stringify({ statusCode: 0, cursor: "20", hasMore: false, itemList: [item("12345"), item("12346")] })
          )
        );
      } else controller.abort();
    },
    [{ id: "12345", url: "https://www.tiktok.com/@shop/video/12345" }],
    { pollMs: 1 }
  );
  await expect(result).rejects.toMatchObject({ name: "AbortError" });
  expect(updates).toBe(2);
  expect(browser.eventNames()).toEqual([]);
});
it.each(["http", "invalid", "network"] as const)(
  "reports a %s list failure without claiming that login is required",
  async (kind) => {
    const controller = new AbortController();
    const browser = page(
      state(),
      kind === "network"
        ? undefined
        : { ...api({}), ...(kind === "http" ? { status: () => 503 } : { body: async () => Buffer.from("not json") }) }
    );
    if (kind === "network")
      browser.goto.mockImplementationOnce(async () => {
        browser.emit("requestfailed", {
          url: () => "https://www.tiktok.com/api/post/item_list/?secUid=sec-user&cursor=0"
        });
        return { status: () => 200 };
      });
    await expect(
      readProfileWorks(
        browser,
        "shop",
        controller.signal,
        (snapshot) => {
          expect(snapshot).toMatchObject({ complete: false, waitingUser: true });
          expect(snapshot.message).toContain(
            kind === "http" ? "HTTP 503" : kind === "invalid" ? "无法解析" : "网络请求未完成"
          );
          expect(snapshot.message).not.toContain("检查登录");
          controller.abort();
        },
        [],
        { pollMs: 1 }
      )
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(browser.eventNames()).toEqual([]);
  }
);
it("stops on cancellation, owner changes and normal rate limits without bypassing login", async () => {
  const waiting = state();
  waiting.waiting = true;
  const controller = new AbortController(),
    browser = page(waiting);
  await expect(
    readProfileWorks(
      browser,
      "shop",
      controller.signal,
      (snapshot) => {
        expect(snapshot.waitingUser).toBe(true);
        controller.abort();
      },
      [],
      { pollMs: 1 }
    )
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(browser.listenerCount("response")).toBe(0);
  await expect(
    readProfileWorks(
      page(state(), undefined, "https://www.tiktok.com/@other"),
      "shop",
      new AbortController().signal,
      vi.fn()
    )
  ).rejects.toMatchObject({ code: "TIKTOK_PROFILE_IDENTITY_MISMATCH" });
  await expect(
    readProfileWorks(
      page(state(), { ...api({}), status: () => 429 }),
      "shop",
      new AbortController().signal,
      vi.fn(),
      [],
      { stallMs: 0 }
    )
  ).rejects.toMatchObject({ code: "TIKTOK_RATE_LIMITED" });
});
it("holds browser ownership through shutdown, cleans up on errors and rejects parallel reads", async () => {
  const close = vi.fn(async () => undefined),
    open = vi.fn(async () => ({ page: page(), close }));
  let resolve!: (value: ProfileDiscovery) => void;
  const read = vi.fn(
    () =>
      new Promise<ProfileDiscovery>((done) => {
        resolve = done;
      })
  );
  const runtime = new TikTokProfileReader(
    { list: vi.fn(), resolveInstalledAsset: vi.fn() },
    { resolveBrowser: vi.fn(async () => "browser.exe"), openBrowser: open, read }
  );
  const task = runtime.read("https://www.tiktok.com/@shop", new AbortController().signal, vi.fn());
  expect(runtime.isActive()).toBe(true);
  expect(() => runtime.read("https://www.tiktok.com/@shop", new AbortController().signal, vi.fn())).toThrow("正在运行");
  await vi.waitFor(() => expect(read).toHaveBeenCalledOnce());
  resolve({ works: [], complete: false, waitingUser: false, message: "未确认完整" });
  await task;
  expect(close).toHaveBeenCalledOnce();
  expect(runtime.isActive()).toBe(false);
  await runtime.close();
  expect(() => runtime.read("https://www.tiktok.com/@shop", new AbortController().signal, vi.fn())).toThrow(
    "服务已关闭"
  );
});
it("cancels during asset resolution without ever launching a late browser", async () => {
  let resolve!: (path: string) => void;
  const opener = vi.fn(),
    runtime = new TikTokProfileReader(
      { list: vi.fn(), resolveInstalledAsset: vi.fn() },
      {
        resolveBrowser: () =>
          new Promise<string>((done) => {
            resolve = done;
          }),
        openBrowser: opener
      }
    );
  const task = runtime.read("https://www.tiktok.com/@shop", new AbortController().signal, vi.fn());
  const rejected = expect(task).rejects.toMatchObject({ name: "AbortError" });
  await vi.waitFor(() => expect(resolve).toBeTypeOf("function"));
  await runtime.stop();
  await rejected;
  resolve("late-browser.exe");
  await Promise.resolve();
  expect(opener).not.toHaveBeenCalled();
  expect(runtime.isActive()).toBe(false);
});
