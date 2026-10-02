/** 受管运行时回归：只使用临时描述与 mock 浏览器，覆盖安装缺失、并发占用、取消和资产映射。 */
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { Page } from "playwright-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DouyinRuntimeManager } from "../modules/media-archive/douyin-runtime";
import {
  ComponentManagerError,
  type ComponentManager,
  type ComponentPackageManifest
} from "../modules/components/component-manager";
import { DouyinSourceError } from "../modules/media-archive/douyin-source";
import { DouyinBrowserError } from "../modules/media-archive/douyin-browser";

let root: string;
let descriptor: Record<string, unknown>;
const url = "https://v.douyin.com/D_DcsZsE5O8/";
const source = {
  platform: "douyin" as const,
  contentId: "7464977705159691570",
  canonicalUrl: "https://www.douyin.com/video/7464977705159691570",
  type: "video" as const,
  title: "测试",
  description: "原文",
  tags: [],
  author: {},
  media: []
};
const runtimes: DouyinRuntimeManager[] = [];
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-douyin-runtime-"));
  descriptor = JSON.parse(
    await fs.readFile(
      new URL("../../../packaging/components/douyin-archive/adapter/manifest.json", import.meta.url),
      "utf8"
    )
  );
  await fs.writeFile(path.join(root, "adapter.json"), JSON.stringify(descriptor));
  await fs.writeFile(
    path.join(root, "launcher.json"),
    JSON.stringify({ executableAssetPath: "browser/Chromium.app/Contents/MacOS/Chromium" })
  );
});
afterEach(async () => {
  await Promise.allSettled(runtimes.splice(0).map((runtime) => runtime.close()));
  vi.useRealTimers();
  if (
    !path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep) ||
    !path.basename(root).startsWith("toolbox-douyin-runtime-")
  )
    throw new Error("测试清理路径越界");
  await fs.rm(root, { recursive: true, force: true });
});
function fixture(platform: NodeJS.Platform = "win32", arch = "x64") {
  const resolve = vi.fn(async (id: string, relative: string) => ({
    path: path.join(
      root,
      relative === "adapter/manifest.json"
        ? "adapter.json"
        : relative === "browser/browser-launcher.json"
          ? "launcher.json"
          : "browser.exe"
    ),
    generationRoot: root,
    manifest: {
      id,
      dependencyIds: ["xhs-browser"],
      version: id === "xhs-browser" ? "1.63.0-chromium-1243" : "1.0.0-anonymous-27468de"
    } as ComponentPackageManifest
  }));
  const list = vi.fn(async () => [] as Awaited<ReturnType<ComponentManager["list"]>>);
  const newPage = vi.fn(async () => ({}) as Page);
  const close = vi.fn(async () => undefined);
  const openBrowser = vi.fn(async () => ({
    context: { newPage },
    browserVersion: "153.0.8010.12",
    close,
    networkStatus: vi.fn()
  })) as unknown as NonNullable<ConstructorParameters<typeof DouyinRuntimeManager>[1]>["openBrowser"] &
    ReturnType<typeof vi.fn>;
  const readWork = vi.fn(async (_page: Page, _input: string, _options: { signal?: AbortSignal } = {}) => ({
    source,
    via: "normal-browser-ssr" as const
  }));
  const runtime = new DouyinRuntimeManager(
    { resolveInstalledAsset: resolve, list },
    { platform, arch, openBrowser, readWork }
  );
  runtimes.push(runtime);
  return { runtime, resolve, list, newPage, close, openBrowser, readWork };
}

describe("抖音受管匿名运行时", () => {
  it("网页没有内嵌完整签名目录时不伪装可自动安装，也不发起下载", async () => {
    const f = fixture();
    f.resolve.mockRejectedValue(new ComponentManagerError("COMPONENT_NOT_FOUND", "private package path"));
    const runtime = new DouyinRuntimeManager(
      { resolveInstalledAsset: f.resolve, list: vi.fn(async () => []) },
      {
        platform: "win32",
        arch: "x64",
        installationMode: "automatic",
        openBrowser: f.openBrowser,
        readWork: f.readWork
      }
    );
    runtimes.push(runtime);

    expect(await runtime.status()).toMatchObject({
      available: false,
      state: "not-installed",
      installMode: "unavailable",
      message: expect.stringContaining("尚未内置")
    });
    await expect(runtime.extract(url)).rejects.toMatchObject({ code: "DOUYIN_COMPONENT_NOT_INSTALLED" });
    expect(f.openBrowser).not.toHaveBeenCalled();
  });

  it("离线状态只验证本地签名资产，返回无路径的匿名状态", async () => {
    const f = fixture();
    expect(await f.runtime.status()).toEqual({
      platform: "douyin",
      mode: "anonymous",
      available: true,
      state: "ready",
      message: expect.any(String)
    });
    expect(f.resolve.mock.calls).toEqual([
      ["douyin-archive", "adapter/manifest.json"],
      ["xhs-browser", "browser/chrome.exe"]
    ]);
    expect(f.openBrowser).not.toHaveBeenCalled();
  });

  it.each(["COMPONENT_NOT_FOUND", "COMPONENT_NOT_INSTALLED", "COMPONENT_DEPENDENCY_MISSING"] as const)(
    "缺少组件 %s 只返回未安装状态，不下载或发现系统浏览器",
    async (code) => {
      const f = fixture();
      f.resolve.mockRejectedValue(new ComponentManagerError(code, "private C:/path"));
      expect(await f.runtime.status()).toMatchObject({
        available: false,
        state: "not-installed",
        errorCode: "DOUYIN_COMPONENT_NOT_INSTALLED"
      });
      await expect(f.runtime.extract(url)).rejects.toMatchObject({ code: "DOUYIN_COMPONENT_NOT_INSTALLED" });
      expect(f.openBrowser).not.toHaveBeenCalled();
    }
  );

  it("损坏资产只返回稳定错误，不泄漏路径", async () => {
    const f = fixture();
    f.resolve.mockRejectedValue(new ComponentManagerError("COMPONENT_INSTALL_FAILED", "C:/private credential"));
    expect(await f.runtime.status()).toMatchObject({ state: "unavailable", errorCode: "DOUYIN_COMPONENT_UNAVAILABLE" });
    await expect(f.runtime.extract(url)).rejects.toMatchObject({
      code: "DOUYIN_COMPONENT_UNAVAILABLE",
      message: expect.not.stringContaining("private")
    });
  });

  it.each(["not-json", JSON.stringify({ ...source, protocolVersion: 2 }), "x".repeat(4097)])(
    "拒绝损坏、不兼容或超大的适配器描述",
    async (text) => {
      const f = fixture();
      await fs.writeFile(path.join(root, "adapter.json"), text);
      expect(await f.runtime.status()).toMatchObject({ available: false, errorCode: "DOUYIN_RUNTIME_INCOMPATIBLE" });
      expect(f.openBrowser).not.toHaveBeenCalled();
    }
  );

  it("安装或修复进行中不能启动浏览器", async () => {
    const f = fixture();
    f.list.mockResolvedValue([{ id: "xhs-browser", activeJobId: "repair" }] as Awaited<
      ReturnType<ComponentManager["list"]>
    >);
    await expect(f.runtime.extract(url)).rejects.toMatchObject({ code: "DOUYIN_RUNTIME_BUSY" });
    expect(f.resolve).not.toHaveBeenCalled();
  });

  it("缺少签名浏览器依赖或版本不符时拒绝启动", async () => {
    const f = fixture();
    f.resolve.mockImplementationOnce(async () => ({
      path: path.join(root, "adapter.json"),
      generationRoot: root,
      manifest: { dependencyIds: [] } as unknown as ComponentPackageManifest
    }));
    expect(await f.runtime.status()).toMatchObject({ errorCode: "DOUYIN_RUNTIME_INCOMPATIBLE" });
    f.resolve.mockImplementationOnce(async () => ({
      path: path.join(root, "adapter.json"),
      generationRoot: root,
      manifest: { dependencyIds: ["xhs-browser"] } as unknown as ComponentPackageManifest
    }));
    f.resolve.mockImplementationOnce(async () => ({
      path: path.join(root, "browser.exe"),
      generationRoot: root,
      manifest: { version: "future" } as unknown as ComponentPackageManifest
    }));
    expect(await f.runtime.status()).toMatchObject({ errorCode: "DOUYIN_RUNTIME_INCOMPATIBLE" });
  });

  it("匿名获取不传 Profile 或凭据，退出时关闭本次浏览器", async () => {
    const f = fixture();
    expect(await f.runtime.extract(url)).toEqual({ source, via: "normal-browser-ssr" });
    expect(f.openBrowser).toHaveBeenCalledWith({
      executablePath: path.join(root, "browser.exe"),
      headless: true,
      signal: expect.any(AbortSignal)
    });
    expect(f.close).toHaveBeenCalledOnce();
    expect(f.runtime.isActive()).toBe(false);
  });

  it("并发获取不重复启动；停止当前任务后允许重新获取", async () => {
    const f = fixture();
    f.readWork.mockImplementationOnce(
      async (_page, _input, { signal } = {}) =>
        new Promise((_resolve, reject) =>
          signal!.addEventListener("abort", () => reject(signal!.reason), { once: true })
        )
    );
    const pending = f.runtime.extract(url);
    const assertion = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(f.readWork).toHaveBeenCalledOnce());
    expect(f.runtime.isActive()).toBe(true);
    expect(await f.runtime.status()).toMatchObject({ state: "busy", available: true });
    await expect(f.runtime.extract(url)).rejects.toMatchObject({ code: "DOUYIN_RUNTIME_BUSY" });
    await f.runtime.stop();
    await assertion;
    expect(f.runtime.isActive()).toBe(false);
    expect(await f.runtime.extract(url)).toMatchObject({ source });
    expect(f.openBrowser).toHaveBeenCalledTimes(2);
  });

  it("关闭永久拒绝新任务，且幂等", async () => {
    const f = fixture();
    await Promise.all([f.runtime.close(), f.runtime.close()]);
    await expect(f.runtime.extract(url)).rejects.toMatchObject({ code: "DOUYIN_RUNTIME_STOPPED" });
    expect(await f.runtime.status()).toMatchObject({ state: "stopped", available: false });
    expect(f.resolve).not.toHaveBeenCalled();
  });

  it("启动途中取消不执行解析，仍释放迟到浏览器", async () => {
    const f = fixture();
    const controller = new AbortController();
    const open = f.openBrowser.getMockImplementation()!;
    f.openBrowser.mockImplementationOnce(async () => {
      controller.abort(new DOMException("取消", "AbortError"));
      return open();
    });
    await expect(f.runtime.extract(url, { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(f.readWork).not.toHaveBeenCalled();
    expect(f.close).toHaveBeenCalledOnce();
  });

  it("平台解析失败和浏览器启动错误保持稳定分类并关闭资源", async () => {
    const f = fixture();
    f.readWork.mockRejectedValueOnce(new DouyinSourceError("DOUYIN_AUTH_REQUIRED", "作品要求登录"));
    await expect(f.runtime.extract(url)).rejects.toMatchObject({ code: "DOUYIN_AUTH_REQUIRED" });
    f.openBrowser.mockRejectedValueOnce(new DouyinBrowserError("DOUYIN_BROWSER_UNAVAILABLE", "浏览器不可用"));
    await expect(f.runtime.extract(url)).rejects.toMatchObject({ code: "DOUYIN_BROWSER_UNAVAILABLE" });
    expect(f.runtime.isActive()).toBe(false);
  });

  it("启动后的实际浏览器版本再次确认，不能只信描述文件", async () => {
    const f = fixture();
    const original = f.openBrowser.getMockImplementation()!;
    f.openBrowser.mockImplementationOnce(async () => ({ ...(await original()), browserVersion: "old" }));
    await expect(f.runtime.extract(url)).rejects.toMatchObject({ code: "DOUYIN_RUNTIME_INCOMPATIBLE" });
    expect(f.readWork).not.toHaveBeenCalled();
    expect(f.close).toHaveBeenCalledOnce();
  });

  it("浏览器释放失败脱敏并关闭运行时，避免重新获取留下多个进程", async () => {
    const f = fixture();
    f.close.mockRejectedValueOnce(new Error("C:/private --cookie=secret"));
    await expect(f.runtime.extract(url)).rejects.toMatchObject({
      code: "DOUYIN_BROWSER_UNAVAILABLE",
      message: expect.not.stringContaining("private")
    });
    expect(await f.runtime.status()).toMatchObject({ state: "stopped" });
    await expect(f.runtime.extract(url)).rejects.toMatchObject({ code: "DOUYIN_RUNTIME_STOPPED" });
  });

  it("非预期底层异常不向接口泄漏路径或凭据", async () => {
    const f = fixture();
    f.readWork.mockRejectedValueOnce(new Error("private Cookie: secret"));
    await expect(f.runtime.extract(url)).rejects.toMatchObject({
      code: "DOUYIN_COMPONENT_UNAVAILABLE",
      message: expect.not.stringContaining("secret")
    });
    expect(f.close).toHaveBeenCalledOnce();
  });

  it("状态查询途中关闭后不能报告可用", async () => {
    const f = fixture();
    const original = f.resolve.getMockImplementation()!;
    f.resolve.mockImplementationOnce(async (...args) => {
      await f.runtime.close();
      return original(...args);
    });
    expect(await f.runtime.status()).toMatchObject({ state: "stopped", available: false });
  });

  it("总时限到达后取消读取并释放浏览器", async () => {
    const f = fixture();
    vi.useFakeTimers();
    f.readWork.mockImplementationOnce(
      async (_page, _input, { signal } = {}) =>
        new Promise((_resolve, reject) =>
          signal!.addEventListener("abort", () => reject(signal!.reason), { once: true })
        )
    );
    const assertion = expect(f.runtime.extract(url)).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.waitFor(() => expect(f.readWork).toHaveBeenCalledOnce());
    await vi.advanceTimersByTimeAsync(120_000);
    await assertion;
    expect(f.close).toHaveBeenCalledOnce();
    expect(f.runtime.isActive()).toBe(false);
  });

  it("状态检查遇到错误前已关闭时仍报告停止，不回退成未安装", async () => {
    const f = fixture();
    f.resolve.mockImplementationOnce(async () => {
      await f.runtime.close();
      throw new ComponentManagerError("COMPONENT_NOT_INSTALLED", "not installed");
    });
    expect(await f.runtime.status()).toMatchObject({ state: "stopped", available: false });
  });

  it("不响应取消的读取只等待五秒，未释放时继续阻止新任务", async () => {
    const f = fixture();
    vi.useFakeTimers();
    let release!: (value: Awaited<ReturnType<typeof f.readWork>>) => void;
    f.readWork.mockImplementationOnce(
      async () =>
        new Promise((resolve) => {
          release = resolve;
        })
    );
    const pending = f.runtime.extract(url);
    const assertion = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(f.readWork).toHaveBeenCalledOnce());
    try {
      const stopped = expect(f.runtime.stop()).rejects.toMatchObject({ code: "DOUYIN_STOP_TIMEOUT" });
      await vi.advanceTimersByTimeAsync(5000);
      await stopped;
      await expect(f.runtime.extract(url)).rejects.toMatchObject({ code: "DOUYIN_RUNTIME_BUSY" });
    } finally {
      release({ source, via: "normal-browser-ssr" });
      await assertion;
    }
    expect(f.close).toHaveBeenCalledOnce();
  });

  it("其他平台不尝试启动或寻找本机环境", async () => {
    const f = fixture("linux", "x64");
    expect(await f.runtime.status()).toMatchObject({ state: "unavailable", errorCode: "DOUYIN_PLATFORM_UNSUPPORTED" });
    expect(f.resolve).not.toHaveBeenCalled();
  });

  it("macOS 从签名启动映射解析嵌套 .app 可执行资产", async () => {
    const f = fixture("darwin", "arm64");
    expect(await f.runtime.status()).toMatchObject({ available: true });
    expect(f.resolve.mock.calls.at(-1)).toEqual(["xhs-browser", "browser/Chromium.app/Contents/MacOS/Chromium"]);
  });

  it.each(["../private", "browser/../private", "browser\\chrome", "browser//chrome", "browser/C:/chrome"])(
    "macOS 不接受越界启动映射：%s",
    async (executableAssetPath) => {
      const f = fixture("darwin", "arm64");
      await fs.writeFile(path.join(root, "launcher.json"), JSON.stringify({ executableAssetPath }));
      expect(await f.runtime.status()).toMatchObject({ errorCode: "DOUYIN_RUNTIME_INCOMPATIBLE" });
      expect(f.resolve).toHaveBeenCalledTimes(2);
    }
  );

  it.each([
    "not-json",
    "null",
    "{}",
    JSON.stringify({ executableAssetPath: "browser/chrome", extra: true }),
    "x".repeat(4097)
  ])("macOS 拒绝损坏或额外字段启动映射", async (text) => {
    const f = fixture("darwin", "arm64");
    await fs.writeFile(path.join(root, "launcher.json"), text);
    expect(await f.runtime.status()).toMatchObject({ errorCode: "DOUYIN_RUNTIME_INCOMPATIBLE" });
  });

  it("错误输入或已取消任务不检查资产、不启动浏览器", async () => {
    const f = fixture();
    const signal = AbortSignal.abort(new DOMException("已取消", "AbortError"));
    await expect(f.runtime.extract(url, { signal })).rejects.toMatchObject({ name: "AbortError" });
    await expect(f.runtime.extract("https://evil.example/work")).rejects.toMatchObject({ code: "DOUYIN_PARSE_FAILED" });
    expect(f.resolve).not.toHaveBeenCalled();
    expect(f.openBrowser).not.toHaveBeenCalled();
  });
});
