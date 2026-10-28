// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { resolve } from "node:path";
import { build } from "vite";
import {
  installTikTokCollector,
  createTikTokCollectorBookmarklet,
  createTikTokCollectorHelpHtml
} from "./tiktok-browser-collector";
const browser = {
  location: { href: "https://www.tiktok.com/@shop" },
  innerHeight: 800,
  alert: vi.fn(),
  scrollBy: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  document.body.replaceChildren();
  browser.location.href = "https://www.tiktok.com/@shop";
  vi.stubGlobal("window", browser);
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});
function click(text: string) {
  const button = Array.from(document.querySelectorAll("button")).find((value) => value.textContent === text);
  expect(button).toBeDefined();
  button!.click();
}
function work(id: number, extra = "") {
  const a = document.createElement("a");
  a.href = `https://www.tiktok.com/@shop/video/${id}${extra}`;
  document.body.append(a);
  return a;
}
function exports() {
  return Array.from(document.querySelectorAll<HTMLAnchorElement>("a[download]"));
}
it("refuses other sites, work pages, credentials and non-HTTPS without creating UI or requesting data", () => {
  for (const url of [
    "https://evil.test/@shop",
    "https://www.tiktok.com/@shop/video/12345",
    "http://www.tiktok.com/@shop",
    "https://user:pass@www.tiktok.com/@shop",
    "https://www.tiktok.com:444/@shop"
  ]) {
    browser.location.href = url;
    installTikTokCollector();
    expect(document.querySelector("section")).toBeNull();
  }
  expect(browser.alert).toHaveBeenCalledTimes(5);
  expect(vi.getTimerCount()).toBe(0);
});
it("deduplicates only this public profile's works and generates bounded CSV files without downloading automatically", () => {
  for (let i = 0; i < 201; i++) work(12345 + i, "?_t=share");
  work(12345);
  for (const href of [
    "https://www.tiktok.com/@other/video/99999",
    "https://evil.test/@shop/video/99998",
    "https://user:pass@www.tiktok.com/@shop/video/99997",
    "http://www.tiktok.com/@shop/video/99996",
    "javascript:alert(1)"
  ]) {
    const a = document.createElement("a");
    a.href = href;
    document.body.append(a);
  }
  installTikTokCollector();
  installTikTokCollector();
  expect(document.querySelectorAll("section")).toHaveLength(1);
  click("开始采集");
  expect(browser.scrollBy).toHaveBeenCalledOnce();
  expect(exports()).toHaveLength(0);
  click("停止并准备 CSV");
  const links = exports();
  expect(links).toHaveLength(3);
  expect(links.map((link) => decodeURIComponent(link.href.split(",")[1]!).trim().split("\r\n").length - 1)).toEqual([
    100, 100, 1
  ]);
  const csv = decodeURIComponent(links[0]!.href.split(",")[1]!);
  expect(csv.startsWith('\uFEFF"作品链接","平台"')).toBe(true);
  expect(csv).toContain('"https://www.tiktok.com/@shop/video/12345","tiktok"');
  expect(csv).not.toContain("?_t=");
  expect(links[0]!.download).toBe("tiktok-shop-001.csv");
  expect(vi.getTimerCount()).toBe(0);
  click("关闭助手");
  expect(document.querySelector("section")).toBeNull();
  expect(browser.removeEventListener).toHaveBeenCalledWith("pagehide", expect.any(Function));
});
it("keeps virtualized discoveries, stops on a stall and resumes only on explicit action", async () => {
  const initial = work(12345);
  installTikTokCollector();
  click("开始采集");
  initial.remove();
  work(12346);
  await vi.advanceTimersByTimeAsync(2500);
  await vi.advanceTimersByTimeAsync(30_000);
  expect(exports()).toHaveLength(1);
  expect(decodeURIComponent(exports()[0]!.href)).toContain("12345");
  expect(document.body.textContent).toContain("列表未确认完整");
  expect(vi.getTimerCount()).toBe(0);
  click("继续采集");
  expect(exports()).toHaveLength(0);
  expect(vi.getTimerCount()).toBe(1);
  browser.location.href = "https://www.tiktok.com/@other";
  await vi.advanceTimersByTimeAsync(2500);
  expect(document.body.textContent).toContain("主页已切换");
  expect(vi.getTimerCount()).toBe(0);
  expect(exports()).toHaveLength(1);
});
it("pauses in background, enforces the total deadline and stops at dialogs without clicking them", async () => {
  work(12345);
  installTikTokCollector();
  click("开始采集");
  vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  const scrolls = browser.scrollBy.mock.calls.length;
  await vi.advanceTimersByTimeAsync(10 * 60_000);
  expect(browser.scrollBy).toHaveBeenCalledTimes(scrolls);
  expect(document.body.textContent).toContain("10 分钟采集上限");
  expect(vi.getTimerCount()).toBe(0);
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  const dialog = document.createElement("div");
  dialog.setAttribute("role", "dialog");
  document.body.append(dialog);
  vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({ width: 100, height: 100 } as DOMRect);
  click("继续采集");
  expect(document.body.textContent).toContain("页面有弹窗或验证");
  expect(vi.getTimerCount()).toBe(0);
});
it("does not scroll an empty profile or emit empty CSV files", async () => {
  installTikTokCollector();
  click("开始采集");
  expect(browser.scrollBy).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(30_000);
  expect(exports()).toHaveLength(0);
  expect(document.body.textContent).toContain("尚未发现作品");
});
it("stops its timer if the host page removes the collector panel", async () => {
  work(12345);
  installTikTokCollector();
  click("开始采集");
  document.getElementById("toolbox-tiktok-public-collector")!.remove();
  await vi.advanceTimersByTimeAsync(2500);
  expect(vi.getTimerCount()).toBe(0);
  expect(browser.removeEventListener).toHaveBeenCalledWith("pagehide", expect.any(Function));
});
it("caps discovered links at 10000 and prepares bounded files instead of continuing to scroll", () => {
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < 10001; index++) {
    const anchor = document.createElement("a");
    anchor.href = `https://www.tiktok.com/@shop/video/${123450000 + index}`;
    fragment.append(anchor);
  }
  document.body.append(fragment);
  installTikTokCollector();
  click("开始采集");
  expect(document.body.textContent).toContain("达到 10000 条上限。已发现 10000 条");
  expect(exports()).toHaveLength(100);
  expect(vi.getTimerCount()).toBe(0);
  expect(browser.scrollBy).not.toHaveBeenCalled();
});
it("runs the exact serialized bookmark with no captured module state and ships a standalone offline helper", () => {
  work(12345);
  const bookmark = createTikTokCollectorBookmarklet();
  expect(bookmark).toMatch(/^javascript:/);
  const code = decodeURIComponent(bookmark.slice("javascript:".length));
  expect(code).not.toMatch(/fetch\(|XMLHttpRequest|\.cookie|localStorage|eval\(/);
  new Function("window", "document", code)(browser, document);
  click("开始采集");
  click("停止并准备 CSV");
  expect(exports()).toHaveLength(1);
  const html = createTikTokCollectorHelpHtml();
  expect(html).toContain(`href="${bookmark}"`);
  expect(html).not.toContain("<script src=");
  expect(html).toContain("每份最多 100 条");
});
it("keeps the downloaded bookmark self-contained after the production minifier transforms its function", async () => {
  vi.useRealTimers();
  const result = await build({
    configFile: false,
    logLevel: "silent",
    build: {
      write: false,
      minify: "esbuild",
      lib: {
        entry: resolve("src/features/content-archive/tiktok-browser-collector.ts"),
        formats: ["iife"],
        name: "TikTokCollectorArtifact"
      }
    }
  }).finally(() => vi.useFakeTimers());
  const output = Array.isArray(result) ? result[0] : result;
  if (!output || !("output" in output)) throw new Error("Missing collector output");
  const chunk = output.output.find((value) => value.type === "chunk");
  if (!chunk || chunk.type !== "chunk") throw new Error("Missing collector artifact");
  const compiled = new Function(`${chunk.code};return TikTokCollectorArtifact;`)() as {
    createTikTokCollectorBookmarklet: () => string;
    createTikTokCollectorHelpHtml: () => string;
  };
  work(12345);
  const code = decodeURIComponent(compiled.createTikTokCollectorBookmarklet().slice("javascript:".length));
  new Function("window", "document", code)(browser, document);
  click("开始采集");
  click("停止并准备 CSV");
  expect(exports()).toHaveLength(1);
  expect(compiled.createTikTokCollectorHelpHtml()).toContain("采集 TikTok 作品");
});
