import { EventEmitter } from "node:events";
import { beforeEach, expect, it, vi } from "vitest";
import type { Route } from "playwright-core";
import { openProfileBrowser } from "../domains/content-archive/providers/tiktok/profile-browser";
const mocks = vi.hoisted(() => ({ launch: vi.fn(), network: vi.fn(), proxy: vi.fn(), dns: vi.fn() }));
vi.mock("playwright-core", () => ({ chromium: { launch: mocks.launch } }));
vi.mock("../domains/content-archive/providers/douyin/browser-network", () => ({ createBrowserNetwork: mocks.network }));
vi.mock("../domains/content-archive/providers/tiktok/transport", () => ({ resolveTikTokProxy: mocks.proxy }));
vi.mock("../domains/content-archive/providers/tiktok/proxy-fetch", () => ({ resolveProxyPublicAddress: mocks.dns }));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.proxy.mockResolvedValue(undefined);
});
function fixture() {
  const page = new EventEmitter(),
    context = new EventEmitter();
  const browserClose = vi.fn(async () => undefined),
    networkClose = vi.fn(async () => undefined);
  const networkArgs = ["--disable-quic"];
  const route = vi.fn(async (_pattern: string, _handler: (route: Route) => Promise<unknown>) => undefined),
    newContext = vi.fn(async () => Object.assign(context, { route, newPage: async () => page }));
  mocks.network.mockResolvedValue({
    close: networkClose,
    proxy: { server: "http://127.0.0.1:12345" },
    args: networkArgs
  });
  mocks.launch.mockResolvedValue({ newContext, close: browserClose });
  return { page, context, browserClose, networkClose, route, newContext, networkArgs };
}
it("opens an ephemeral isolated context, blocks off-site navigation/downloads and closes only owned resources", async () => {
  const value = fixture(),
    controller = new AbortController();
  const browser = await openProfileBrowser({
    executablePath: "signed/chrome.exe",
    proxy: "direct",
    signal: controller.signal
  });
  expect(value.newContext).toHaveBeenCalledWith({ acceptDownloads: false, serviceWorkers: "block" });
  expect(mocks.launch).toHaveBeenCalledWith(
    expect.objectContaining({
      headless: false,
      proxy: { server: "http://127.0.0.1:12345" },
      args: ["--disable-quic", "--disable-blink-features=AutomationControlled"]
    })
  );
  expect(value.networkArgs).toEqual(["--disable-quic"]);
  const handler = value.route.mock.calls[0]![1] as (route: Route) => Promise<unknown>;
  const main = {},
    frame = Object.assign(main, { page: () => ({ mainFrame: () => main }) });
  for (const [url, navigation, type, blocked] of [
    ["http://www.tiktok.com/", true, "document", true],
    ["https://evil.test/", true, "document", true],
    ["https://www.tiktok.com/@shop", true, "document", false],
    ["https://p16.tiktokcdn.com/a.mp4", false, "media", true],
    ["https://p16.tiktokcdn.com/a.js", false, "script", false],
    ["https://user:pass@www.tiktok.com/a.js", false, "script", true]
  ] as const) {
    const abort = vi.fn(),
      next = vi.fn();
    await handler({
      request: () => ({
        url: () => url,
        isNavigationRequest: () => navigation,
        frame: () => frame,
        resourceType: () => type
      }),
      abort,
      continue: next
    } as unknown as Route);
    expect(blocked ? abort : next).toHaveBeenCalledOnce();
  }
  const popup = { close: vi.fn(async () => undefined) };
  value.context.emit("page", popup);
  value.context.emit("page", value.page);
  expect(popup.close).toHaveBeenCalledOnce();
  const download = { cancel: vi.fn() };
  value.page.emit("download", download);
  expect(download.cancel).toHaveBeenCalledOnce();
  controller.abort();
  await browser.close();
  expect(value.browserClose).toHaveBeenCalledOnce();
  expect(value.networkClose).toHaveBeenCalledOnce();
});
it("disposes failed launches and aborted startups without exposing local paths or proxy details", async () => {
  const value = fixture();
  mocks.launch.mockRejectedValueOnce(new Error("secret local path"));
  await expect(
    openProfileBrowser({ executablePath: "secret/chrome.exe", signal: new AbortController().signal })
  ).rejects.toMatchObject({ code: "TIKTOK_PROFILE_BROWSER_FAILED" });
  expect(value.networkClose).toHaveBeenCalledOnce();
  const controller = new AbortController();
  controller.abort();
  await expect(
    openProfileBrowser({ executablePath: "signed/chrome.exe", signal: controller.signal })
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(mocks.launch).toHaveBeenCalledOnce();
});
it("pins DNS through the selected proxy and handles cancellation after browser launch", async () => {
  const value = fixture(),
    controller = new AbortController();
  mocks.proxy.mockResolvedValue("http://127.0.0.1:12345");
  mocks.dns.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  value.newContext.mockImplementationOnce(async () => {
    controller.abort();
    return Object.assign(value.context, { route: value.route, newPage: async () => value.page });
  });
  await expect(
    openProfileBrowser({ executablePath: "signed/chrome.exe", signal: controller.signal })
  ).rejects.toMatchObject({ name: "AbortError" });
  const options = mocks.network.mock.calls[0]![0] as { resolver: (host: string) => Promise<unknown> };
  await options.resolver("www.tiktok.com");
  expect(mocks.dns).toHaveBeenCalledWith("www.tiktok.com", "http://127.0.0.1:12345", controller.signal);
  expect(value.browserClose).toHaveBeenCalledOnce();
  expect(value.networkClose).toHaveBeenCalledOnce();
});
