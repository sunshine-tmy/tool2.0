/** Provider relocation guardrails: isolated paths and synthetic records, never a live login or Python process. */
import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getConfig, type AppConfig } from "../config";
import { createIsolatedAppFixture } from "./helpers/isolated-app";
import { XhsAuthManager } from "../domains/content-archive/providers/xiaohongshu/auth";
import { XhsRuntimeManager } from "../domains/content-archive/providers/xiaohongshu/runtime";
import {
  XHS_COMMIT,
  XhsRuntimeInstallGateway
} from "../domains/content-archive/providers/xiaohongshu/runtime-install-gateway";
import { XhsProviderProcess } from "../domains/content-archive/providers/xiaohongshu/runtime-process";
import { normalizeXhsProviderItem } from "../domains/content-archive/providers/xiaohongshu/provider-item";
import { ArchiveTaskError } from "../domains/content-archive/core/provider";

let fixture: Awaited<ReturnType<typeof createIsolatedAppFixture>>;
let config: AppConfig;
const cookie = (name: string, expires = 0, domain = ".xiaohongshu.com") => ({ name, value: name, expires, domain });
function cookiePaths() {
  return {
    current: path.join(path.dirname(config.runtime.storageRoot), "profile", "xhs-archive", "auth.json"),
    legacy: path.resolve(config.xhsRuntimeDir, "..", "xhs-browser-profile", "auth.json")
  };
}
async function write(file: string, contents: string) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, contents);
}
beforeEach(async () => {
  fixture = await createIsolatedAppFixture();
  config = getConfig({
    layout: fixture.layout,
    dotenvPath: false,
    environment: {
      NODE_ENV: "test",
      XHS_RUNTIME_DIR: path.join(fixture.root, "中文 运行时", "xhs-downloader"),
      XHS_PROVIDER_PORT: "5559",
      XHS_PROVIDER_TOKEN: "synthetic-worker-token"
    }
  });
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Unexpected network request in isolated test")));
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await fixture?.dispose();
});

it("keeps pinned source and Python paths anchored to the explicit Chinese/space runtime root", () => {
  const gateway = new XhsRuntimeInstallGateway(config, vi.fn());
  expect(XHS_COMMIT).toBe("afaf2fb459980fccef9eec74e304a39af2c49cab");
  expect(gateway.runtimeSourceDir()).toBe(path.join(config.xhsRuntimeDir, `XHS-Downloader-${XHS_COMMIT}`));
  expect(gateway.venvDir()).toBe(path.join(config.xhsRuntimeDir, "venv"));
  expect(gateway.venvPython()).toBe(
    path.join(config.xhsRuntimeDir, "venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python")
  );
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

it("prefers current credentials and keeps original filtering/order without rewriting either credential file", async () => {
  const { current, legacy } = cookiePaths();
  const currentText = JSON.stringify([
    cookie("session"),
    cookie("expired", Date.now() / 1000 - 60),
    cookie("unrelated", 0, "example.test"),
    cookie("fresh", Date.now() / 1000 + 60)
  ]);
  const legacyText = JSON.stringify([cookie("legacy")]);
  await write(current, currentText);
  await write(legacy, legacyText);
  const auth = new XhsAuthManager(config);
  expect(await auth.cookieHeader()).toBe("session=session; fresh=fresh");
  expect(await auth.isAuthenticated()).toBe(true);
  expect(await fs.readFile(current, "utf8")).toBe(currentText);
  expect(await fs.readFile(legacy, "utf8")).toBe(legacyText);
});

it("uses the existing legacy credentials only when the current credential file cannot be read", async () => {
  const { current, legacy } = cookiePaths();
  await write(legacy, JSON.stringify([cookie("legacy")]));
  expect(await new XhsAuthManager(config).cookieHeader()).toBe("legacy=legacy");
  await expect(fs.stat(current)).rejects.toMatchObject({ code: "ENOENT" });
});

it("does not silently fall back to legacy credentials when a readable current file contains invalid JSON", async () => {
  const { current, legacy } = cookiePaths();
  await write(current, "{broken");
  await write(legacy, JSON.stringify([cookie("legacy")]));
  const auth = new XhsAuthManager(config);
  expect(await auth.cookieHeader()).toBe("");
  expect(await auth.isAuthenticated()).toBe(false);
  expect(await fs.readFile(current, "utf8")).toBe("{broken");
});

it("returns an external endpoint without health checks, installation or starting a local provider", async () => {
  const health = vi.spyOn(XhsProviderProcess.prototype, "isHealthy");
  const start = vi.spyOn(XhsProviderProcess.prototype, "start");
  const install = vi.spyOn(XhsRuntimeInstallGateway.prototype, "install");
  config.xhsProviderUrl = "https://provider.test/base/";
  const manager = new XhsRuntimeManager(config);
  expect(await manager.ensureReady()).toBe("https://provider.test/base");
  expect(manager.getStatus()).toMatchObject({ status: "ready", installProgress: 100 });
  expect(health).not.toHaveBeenCalled();
  expect(start).not.toHaveBeenCalled();
  expect(install).not.toHaveBeenCalled();
});

it("rejects an already aborted request before endpoint reuse or any provider/install operation", async () => {
  const health = vi.spyOn(XhsProviderProcess.prototype, "isHealthy");
  const install = vi.spyOn(XhsRuntimeInstallGateway.prototype, "install");
  config.xhsProviderUrl = "https://provider.test/base/";
  const controller = new AbortController();
  const reason = new Error("synthetic cancellation");
  controller.abort(reason);
  await expect(new XhsRuntimeManager(config).ensureReady(undefined, { signal: controller.signal })).rejects.toBe(
    reason
  );
  expect(health).not.toHaveBeenCalled();
  expect(install).not.toHaveBeenCalled();
});

it.each([200, 503])("keeps local health endpoint and worker authentication for HTTP %s", async (status) => {
  vi.mocked(globalThis.fetch).mockResolvedValue(new Response(null, { status }));
  const provider = new XhsProviderProcess(config, vi.fn());
  expect(provider.baseUrl).toBe("http://127.0.0.1:5559");
  expect(await provider.isHealthy()).toBe(status === 200);
  expect(globalThis.fetch).toHaveBeenCalledWith("http://127.0.0.1:5559/health", {
    headers: { "x-toolbox-worker-token": "synthetic-worker-token" },
    signal: expect.any(AbortSignal)
  });
  await provider.stop();
});

it("keeps a failed health probe nonfatal", async () => {
  expect(await new XhsProviderProcess(config, vi.fn()).isHealthy()).toBe(false);
});

it("looks for the worker in scriptsRoot and rejects a missing script before spawning Python", async () => {
  vi.spyOn(XhsProviderProcess.prototype, "isHealthy").mockResolvedValue(false);
  const status = vi.fn();
  const provider = new XhsProviderProcess(config, status);
  await expect(provider.start(path.join(fixture.root, "source"), "not-a-python-executable")).rejects.toThrow(
    "找不到小红书解析 Worker 脚本"
  );
  expect(status).toHaveBeenCalledExactlyOnceWith("installing", "正在启动本机解析服务");
  await provider.stop();
});

it("keeps status snapshots detached from manager state", () => {
  const manager = new XhsRuntimeManager(config);
  const status = manager.getStatus();
  status.status = "failed";
  status.message = "caller edit";
  expect(manager.getStatus()).toMatchObject({ status: "not-installed", message: "首次获取时自动安装解析环境" });
});

it("recognizes an existing complete local runtime without downloading or mutating its marker", async () => {
  const gateway = new XhsRuntimeInstallGateway(config, vi.fn());
  await write(gateway.venvPython(), "synthetic executable placeholder");
  await write(path.join(gateway.venvDir(), "pyvenv.cfg"), "version = 3.12.14\n");
  const marker = path.join(config.xhsRuntimeDir, ".installed-commit");
  await write(marker, `${XHS_COMMIT}\n`);
  expect(new XhsRuntimeManager(config).getStatus()).toMatchObject({ status: "ready", installProgress: 100 });
  expect(await fs.readFile(marker, "utf8")).toBe(`${XHS_COMMIT}\n`);
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

it("delegates stop to the same provider owner without starting a runtime", async () => {
  const stop = vi.spyOn(XhsProviderProcess.prototype, "stop").mockResolvedValue(undefined);
  await new XhsRuntimeManager(config).stop();
  expect(stop).toHaveBeenCalledOnce();
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

it("keeps provider mapping failures in the same shared ArchiveTaskError class", () => {
  let failure: unknown;
  try {
    normalizeXhsProviderItem({}, "https://www.xiaohongshu.com/explore/synthetic");
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(ArchiveTaskError);
  expect(failure).toMatchObject({ code: "XHS_PARSE_FAILED", message: "解析结果缺少笔记 ID" });
});
