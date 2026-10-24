/** 匿名浏览器的临时上下文、取消与资源释放回归。 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openDouyinBrowser } from "../domains/content-archive/providers/douyin/douyin-browser";

const mocks = vi.hoisted(() => ({
  launch: vi.fn(),
  network: vi.fn(),
  networkClose: vi.fn(),
  browserClose: vi.fn(),
  contextClose: vi.fn(),
  newContext: vi.fn(),
  listeners: {} as Record<string, () => void>
}));
vi.mock("playwright-core", () => ({ chromium: { launch: mocks.launch } }));
vi.mock("../domains/content-archive/providers/douyin/browser-network", () => ({ createBrowserNetwork: mocks.network }));

const sessions: Awaited<ReturnType<typeof openDouyinBrowser>>[] = [];
beforeEach(() => {
  vi.clearAllMocks();
  mocks.listeners = {};
  const browser = { version: () => "153.0.8010.12", close: mocks.browserClose, newContext: mocks.newContext };
  const context = {
    browser: () => browser,
    close: mocks.contextClose,
    on: (name: string, callback: () => void) => {
      mocks.listeners[name] = callback;
    }
  };
  mocks.launch.mockResolvedValue(browser);
  mocks.newContext.mockResolvedValue(context);
  mocks.browserClose.mockResolvedValue(undefined);
  mocks.contextClose.mockResolvedValue(undefined);
  mocks.networkClose.mockResolvedValue(undefined);
  mocks.network.mockResolvedValue({
    proxy: { server: "http://127.0.0.1:1", username: "token", password: "secret" },
    args: ["--disable-quic"],
    status: () => ({ established: 0, challenged: 0, rejected: 0, failed: 0, active: 0 }),
    close: mocks.networkClose
  });
});
afterEach(async () => {
  await Promise.allSettled(sessions.splice(0).map((session) => session.close()));
});
async function open(options: Partial<Parameters<typeof openDouyinBrowser>[0]> = {}) {
  const session = await openDouyinBrowser({ executablePath: "fixed-browser.exe", ...options });
  sessions.push(session);
  return session;
}

describe("抖音匿名受管浏览器", () => {
  it("每次启动都创建临时上下文，关闭幂等", async () => {
    const session = await open({ headless: false });
    expect(session.browserVersion).toBe("153.0.8010.12");
    expect(mocks.launch).toHaveBeenCalledWith(
      expect.objectContaining({ executablePath: "fixed-browser.exe", headless: false, proxy: expect.any(Object) })
    );
    expect(mocks.newContext).toHaveBeenCalledWith({ acceptDownloads: false, serviceWorkers: "block" });
    await session.close();
    await session.close();
    expect(mocks.browserClose).toHaveBeenCalledOnce();
    expect(mocks.networkClose).toHaveBeenCalledOnce();
  });

  it("启动失败释放网络并返回固定错误", async () => {
    mocks.launch.mockRejectedValueOnce(new Error("C:/private --proxy-password=secret"));
    await expect(open()).rejects.toMatchObject({ code: "DOUYIN_BROWSER_UNAVAILABLE" });
    expect(mocks.networkClose).toHaveBeenCalledOnce();
  });

  it("已取消不启动浏览器，运行中取消会关闭浏览器和网关", async () => {
    const cancelled = new AbortController();
    cancelled.abort();
    await expect(open({ signal: cancelled.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(mocks.network).not.toHaveBeenCalled();

    const running = new AbortController();
    await open({ signal: running.signal });
    running.abort();
    await vi.waitFor(() => expect(mocks.networkClose).toHaveBeenCalledOnce());
    expect(mocks.browserClose).toHaveBeenCalledOnce();
  });

  it("启动过程中取消会关闭已启动浏览器", async () => {
    const controller = new AbortController();
    mocks.launch.mockImplementationOnce(async () => {
      controller.abort();
      return { version: () => "153", close: mocks.browserClose, newContext: mocks.newContext };
    });
    await expect(open({ signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(mocks.browserClose).toHaveBeenCalledOnce();
    expect(mocks.networkClose).toHaveBeenCalledOnce();
  });

  it("浏览器关闭事件释放网关", async () => {
    await open();
    mocks.listeners.close();
    await vi.waitFor(() => expect(mocks.networkClose).toHaveBeenCalledOnce());
  });
});
