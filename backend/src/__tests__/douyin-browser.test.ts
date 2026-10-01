/** 独立 Profile、取消与资源释放回归；不使用用户登录数据或真实在线浏览器。 */
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openDouyinBrowser } from "../modules/media-archive/douyin-browser";

const mocks = vi.hoisted(() => ({
  launch: vi.fn(),
  persistent: vi.fn(),
  network: vi.fn(),
  networkClose: vi.fn(),
  browserClose: vi.fn(),
  contextClose: vi.fn(),
  newContext: vi.fn(),
  listeners: {} as Record<string, () => void>
}));
vi.mock("playwright-core", () => ({ chromium: { launch: mocks.launch, launchPersistentContext: mocks.persistent } }));
vi.mock("../modules/media-archive/browser-network", () => ({ createBrowserNetwork: mocks.network }));
let root: string;
const sessions: Awaited<ReturnType<typeof openDouyinBrowser>>[] = [];
beforeEach(async () => {
  vi.clearAllMocks();
  root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-douyin-browser-"));
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
  mocks.persistent.mockResolvedValue(context);
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
  if (!root.startsWith(path.join(os.tmpdir(), "toolbox-douyin-browser-"))) throw new Error("测试清理路径越界");
  await fs.rm(root, { recursive: true, force: true });
});
async function open(options: Partial<Parameters<typeof openDouyinBrowser>[0]> = {}) {
  const session = await openDouyinBrowser({ executablePath: "fixed-browser.exe", ...options });
  sessions.push(session);
  return session;
}

describe("抖音独立受管浏览器", () => {
  it("Profile 根目录不可创建时返回稳定错误，不泄漏本地路径", async () => {
    const file = path.join(root, "file-not-directory");
    await fs.writeFile(file, "unchanged");
    await expect(open({ profileRoot: file })).rejects.toMatchObject({ code: "DOUYIN_PROFILE_INVALID" });
    expect(await fs.readFile(file, "utf8")).toBe("unchanged");
    expect(mocks.network).not.toHaveBeenCalled();
  });
  it("默认匿名模式不读写 Profile，关闭只影响本次浏览器与网关", async () => {
    const session = await open();
    expect(session.browserVersion).toBe("153.0.8010.12");
    expect(await fs.readdir(root)).toEqual([]);
    expect(mocks.persistent).not.toHaveBeenCalled();
    expect(mocks.launch).toHaveBeenCalledWith(expect.objectContaining({ headless: true, proxy: expect.any(Object) }));
    expect(mocks.newContext).toHaveBeenCalledWith({ acceptDownloads: false, serviceWorkers: "block" });
    await session.close();
    await session.close();
    expect(mocks.browserClose).toHaveBeenCalledOnce();
    expect(mocks.networkClose).toHaveBeenCalledOnce();
  });

  it("Profile 固定分平台，复用只接受自身标记，不读取小红书认证文件", async () => {
    const xhs = path.join(root, "xhs-archive");
    await fs.mkdir(xhs);
    await fs.writeFile(path.join(xhs, "auth.json"), "xhs-secret");
    const first = await open({ profileRoot: root, headless: false });
    const directory = path.join(root, "douyin-archive");
    expect(mocks.persistent).toHaveBeenLastCalledWith(
      directory,
      expect.objectContaining({ headless: false, serviceWorkers: "block" })
    );
    expect(JSON.parse(await fs.readFile(path.join(directory, ".toolbox-platform.json"), "utf8"))).toEqual({
      platform: "douyin",
      protocolVersion: 1
    });
    await first.close();
    await open({ profileRoot: root });
    expect(await fs.readFile(path.join(xhs, "auth.json"), "utf8")).toBe("xhs-secret");
  });

  it.each([
    undefined,
    "not-json",
    '{"platform":"xiaohongshu","protocolVersion":1}',
    '{"platform":"douyin","protocolVersion":2}',
    "x".repeat(513)
  ])("拒绝未登记或不同平台目录，不读取已有 Cookie：%s", async (marker) => {
    const directory = path.join(root, "douyin-archive");
    await fs.mkdir(directory);
    await fs.writeFile(path.join(directory, "Cookies"), "do-not-read");
    if (marker) await fs.writeFile(path.join(directory, ".toolbox-platform.json"), marker);
    await expect(open({ profileRoot: root })).rejects.toMatchObject({ code: "DOUYIN_PROFILE_INVALID" });
    expect(mocks.persistent).not.toHaveBeenCalled();
    expect(await fs.readFile(path.join(directory, "Cookies"), "utf8")).toBe("do-not-read");
  });

  it("同一 Profile 并发使用明确拒绝，关闭后可以再次打开", async () => {
    const first = await open({ profileRoot: root });
    await expect(open({ profileRoot: root })).rejects.toMatchObject({ code: "DOUYIN_PROFILE_BUSY" });
    expect(mocks.persistent).toHaveBeenCalledOnce();
    await first.close();
    await open({ profileRoot: root });
    expect(mocks.persistent).toHaveBeenCalledTimes(2);
  });

  it("启动失败释放 Profile 和网络，错误不回传路径或令牌", async () => {
    mocks.persistent.mockRejectedValueOnce(new Error("C:/secret/profile/password"));
    await expect(open({ profileRoot: root })).rejects.toMatchObject({ code: "DOUYIN_BROWSER_UNAVAILABLE" });
    expect(mocks.networkClose).toHaveBeenCalledOnce();
    const session = await open({ profileRoot: root });
    expect(session.browserVersion).toBe("153.0.8010.12");
  });

  it("用户关闭登录窗口会释放网络与 Profile", async () => {
    await open({ profileRoot: root });
    mocks.listeners.close();
    await vi.waitFor(() => expect(mocks.networkClose).toHaveBeenCalledOnce());
    await open({ profileRoot: root });
    expect(mocks.persistent).toHaveBeenCalledTimes(2);
  });

  it("已取消不创建 Profile，运行中取消会关闭浏览器和网关", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(open({ signal: controller.signal, profileRoot: root })).rejects.toMatchObject({ name: "AbortError" });
    expect(await fs.readdir(root)).toEqual([]);
    const running = new AbortController();
    await open({ signal: running.signal, profileRoot: root });
    running.abort();
    await vi.waitFor(() => expect(mocks.networkClose).toHaveBeenCalledOnce());
    expect(mocks.contextClose).toHaveBeenCalledOnce();
  });

  it("启动过程中取消也会在返回浏览器后关闭，不遗留网络", async () => {
    const controller = new AbortController();
    mocks.launch.mockImplementationOnce(async () => {
      controller.abort();
      return { version: () => "153", close: mocks.browserClose, newContext: mocks.newContext };
    });
    await expect(open({ signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(mocks.browserClose).toHaveBeenCalledOnce();
    expect(mocks.networkClose).toHaveBeenCalledOnce();
  });

  it("链接根目录和链接平台目录不能导向其他 Profile", async () => {
    const real = path.join(root, "real");
    await fs.mkdir(real);
    const linked = path.join(root, "linked");
    await fs.symlink(real, linked, process.platform === "win32" ? "junction" : "dir");
    await expect(open({ profileRoot: linked })).rejects.toMatchObject({ code: "DOUYIN_PROFILE_INVALID" });
    await fs.symlink(real, path.join(root, "douyin-archive"), process.platform === "win32" ? "junction" : "dir");
    await expect(open({ profileRoot: root })).rejects.toMatchObject({ code: "DOUYIN_PROFILE_INVALID" });
    expect(mocks.persistent).not.toHaveBeenCalled();
  });

  it("浏览器关闭失败仍释放网关和独占锁", async () => {
    const first = await open({ profileRoot: root });
    mocks.contextClose.mockRejectedValueOnce(new Error("close failed"));
    await expect(first.close()).rejects.toThrow("close failed");
    expect(mocks.networkClose).toHaveBeenCalledOnce();
    await open({ profileRoot: root });
  });
});
