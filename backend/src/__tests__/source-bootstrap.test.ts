/** 一键初始化的纯编排测试：不下载、不执行 Python、不启动模型。 */
import path from "node:path";
import fs from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import type { ComponentJob, ComponentPackageStatus } from "@toolbox/shared";
import { assertSourceStartupAvailable, getSourceConfig } from "../runtime/source-config";
import { createDevelopmentRuntimeLayout } from "../runtime/runtime-layout";
import { prepareSourceComponents, sourceComponentIds } from "../runtime/source-bootstrap";

function fixture(installed: string[] = []) {
  const statuses = sourceComponentIds.map((id) => ({
    id,
    displayName: id,
    version: "1",
    installedVersion: installed.includes(id) ? "1" : undefined,
    installed: installed.includes(id),
    health: "healthy"
  })) as ComponentPackageStatus[];
  const manager = {
    list: vi.fn(async () => statuses),
    startInstall: vi.fn(async (id: string) => ({ id }) as ComponentJob),
    getJob: vi.fn(
      async (id: string) =>
        ({
          id,
          componentId: id,
          state: "completed",
          phase: "complete",
          progress: { downloadedBytes: 10, totalDownloadBytes: 10, processedFiles: 1, totalFiles: 1, percentage: 100 }
        }) as ComponentJob
    ),
    resolveInstalledAsset: vi.fn(async () => ({ path: "verified", generationRoot: "verified", manifest: {} })),
    resolveInstalledPython: vi.fn(async () => ({ path: "verified", generationRoot: "verified", manifest: {} }))
  };
  // Only the real manager's five public methods are exercised, with deterministic no-I/O doubles.
  return { manager: manager as unknown as Parameters<typeof prepareSourceComponents>[0], spies: manager, statuses };
}

describe("source bootstrap", () => {
  it("only adds CUDA when explicitly selected, after its CPU dependency", async () => {
    const { manager, spies, statuses } = fixture();
    statuses.push({
      id: "chatterbox-cuda",
      displayName: "CUDA",
      installed: false,
      version: "1"
    } as ComponentPackageStatus);
    await prepareSourceComponents(manager, () => undefined, undefined, undefined, true);
    expect(spies.startInstall.mock.calls.map(([id]) => id)).toEqual([...sourceComponentIds, "chatterbox-cuda"]);
  });
  it("installs all CPU capabilities sequentially in dependency order, excluding CUDA", async () => {
    const { manager, spies } = fixture();
    const messages: string[] = [];
    await prepareSourceComponents(manager, (value) => messages.push(value));
    expect(spies.startInstall.mock.calls.map(([id]) => id)).toEqual(sourceComponentIds);
    expect(messages.some((message) => message.includes("归档 10/10 字节"))).toBe(true);
    expect(messages[0]).toContain("不安装 GPU 扩展");
    expect(messages[0]).toContain("start-gpu.bat");
  });

  it("adds only the GPU extension when CPU packages are already healthy", async () => {
    const { manager, spies, statuses } = fixture([...sourceComponentIds]);
    statuses.push({
      id: "chatterbox-cuda",
      displayName: "CUDA",
      installed: false,
      version: "1"
    } as ComponentPackageStatus);
    const messages: string[] = [];
    await prepareSourceComponents(manager, (value) => messages.push(value), undefined, undefined, true);
    expect(spies.startInstall.mock.calls.map(([id]) => id)).toEqual(["chatterbox-cuda"]);
    expect(messages[0]).toContain("安装能力包不代表显卡与驱动已通过实际生成验证");
    expect(spies.resolveInstalledPython).toHaveBeenCalledWith("chatterbox");
  });

  it("uses the supplied offline installer exclusively instead of silently downloading packages", async () => {
    const { manager, spies } = fixture();
    const offline = vi.fn(async (id: string) => ({ id }) as ComponentJob);
    await prepareSourceComponents(manager, () => undefined, undefined, undefined, false, offline);
    expect(offline.mock.calls.map(([id]) => id)).toEqual(sourceComponentIds);
    expect(spies.startInstall).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    "shows Python substeps instead of misleading archive file counts (details=%s)",
    async (details) => {
      const { manager, spies } = fixture();
      const completed = await spies.getJob("python-312");
      spies.getJob.mockResolvedValueOnce({
        ...completed,
        state: "running",
        phase: "building-python",
        progress: {
          downloadedBytes: 100,
          totalDownloadBytes: 100,
          processedFiles: 0,
          totalFiles: 141,
          percentage: 100,
          ...(details
            ? {
                python: {
                  step: "install-dependencies",
                  completedSteps: 3,
                  totalSteps: 5,
                  preparedDependencies: 2,
                  totalDependencies: 10,
                  currentDependency: "sample",
                  activity: "installing"
                }
              }
            : {})
        }
      } as ComponentJob);
      const messages: string[] = [];
      await prepareSourceComponents(
        manager,
        (value) => messages.push(value),
        undefined,
        async () => undefined
      );
      const installing = messages.find((value) => value.includes("创建隔离 Python 环境"))!;
      expect(installing).not.toContain("0/141");
      expect(installing).not.toContain("100%");
      expect(installing).toContain(details ? "已解析依赖 2/10" : "此阶段不使用归档文件计数");
      if (details) expect(installing).toContain("已完成 3/5 步");
    }
  );

  it("resumes by resolving installed packages without downloading them again", async () => {
    const { manager, spies } = fixture(["python-312", "ffmpeg", "edge-tts"]);
    await prepareSourceComponents(manager, () => undefined);
    expect(spies.startInstall.mock.calls.map(([id]) => id)).toEqual(sourceComponentIds.slice(3));
    expect(spies.resolveInstalledAsset).toHaveBeenCalledWith("ffmpeg", "bin/ffmpeg.exe");
    expect(spies.resolveInstalledPython).toHaveBeenCalledWith("edge-tts");
  });

  it("stops on failure instead of claiming completion or installing later components", async () => {
    const { manager, spies } = fixture();
    spies.getJob.mockResolvedValue({
      state: "failed",
      errorCode: "COMPONENT_DISK_SPACE_LOW",
      progress: {}
    } as ComponentJob);
    await expect(prepareSourceComponents(manager, () => undefined)).rejects.toThrow("COMPONENT_DISK_SPACE_LOW");
    expect(spies.startInstall).toHaveBeenCalledTimes(1);
  });

  it("labels a failed complete-phase job as failure and reports only confirmed reasons", async () => {
    const { manager, spies } = fixture();
    const messages: string[] = [];
    spies.getJob.mockResolvedValue({
      state: "failed",
      phase: "complete",
      errorCode: "COMPONENT_INSTALL_FAILED",
      errorMessage: "ETIMEDOUT: secret URL https://example.com/?token=secret 中文文案",
      progress: { downloadedBytes: 13, totalDownloadBytes: 21, processedFiles: 0, totalFiles: 3 }
    } as ComponentJob);
    await expect(prepareSourceComponents(manager, (message) => messages.push(message))).rejects.toThrow(
      "ETIMEDOUT: 下载连接或分段读取超时"
    );
    expect(messages.at(-1)).toContain("：失败；");
    expect(messages.at(-1)).not.toContain("：完成；");
    expect(messages.at(-1)).toContain("归档 13/21 字节");
    expect(spies.startInstall).toHaveBeenCalledTimes(1);
    await expect(prepareSourceComponents(manager, () => undefined)).rejects.not.toThrow("secret");
    spies.getJob.mockResolvedValue({
      state: "failed",
      phase: "complete",
      errorCode: "COMPONENT_INSTALL_FAILED",
      errorMessage: "private unknown Worker output",
      progress: {}
    } as ComponentJob);
    await expect(prepareSourceComponents(manager, () => undefined)).rejects.toThrow("证据不足");
  });

  it("rejects incomplete catalogs, active operations and cancelled initialization before writes", async () => {
    const { manager, spies, statuses } = fixture();
    statuses.pop();
    await expect(prepareSourceComponents(manager, () => undefined)).rejects.toThrow("缺少签名能力");
    expect(spies.startInstall).not.toHaveBeenCalled();
    const busy = fixture();
    busy.statuses[0].activeJobId = "busy";
    await expect(prepareSourceComponents(busy.manager, () => undefined)).rejects.toThrow("拒绝并发");
    const abort = new AbortController();
    abort.abort();
    await expect(prepareSourceComponents(fixture().manager, () => undefined, abort.signal)).rejects.toThrow();
  });

  it("does not silently repair a broken installed generation", async () => {
    const { manager, spies } = fixture([...sourceComponentIds]);
    spies.resolveInstalledAsset.mockRejectedValue(new Error("signature mismatch"));
    await expect(prepareSourceComponents(manager, () => undefined)).rejects.toThrow("signature mismatch");
    expect(spies.startInstall).not.toHaveBeenCalled();
  });
});

describe("managed source configuration", () => {
  const layout = createDevelopmentRuntimeLayout({ appRoot: path.resolve("中文 project") });
  it("is opt-in and leaves the legacy source workflow unchanged", () => {
    const config = getSourceConfig({ layout, dotenvPath: false, environment: { EDGE_TTS_PYTHON: "custom.exe" } });
    expect(config.desktopManagedCapabilities).toBe(false);
    expect(config.edgeTtsPythonPath).toBe(path.join(layout.appRoot, "custom.exe"));
  });

  it.skipIf(process.platform !== "win32")(
    "blocks a parallel legacy API when the Windows bootstrap lock is held",
    async () => {
      const config = getSourceConfig({ layout, dotenvPath: false, environment: {} });
      const open = vi.spyOn(fs, "open").mockRejectedValue(Object.assign(new Error("locked"), { code: "EBUSY" }));
      try {
        await expect(assertSourceStartupAvailable(config)).rejects.toThrow("不要并行启动源码 API");
        open.mockRejectedValue(Object.assign(new Error("absent"), { code: "ENOENT" }));
        await expect(assertSourceStartupAvailable(config)).resolves.toBeUndefined();
      } finally {
        open.mockRestore();
      }
    }
  );

  it("preserves storage/database/network settings but isolates executable and model overrides", () => {
    const config = getSourceConfig({
      layout,
      dotenvPath: false,
      environment: {
        TOOLBOX_SOURCE_MANAGED: "1",
        STORAGE_ROOT: "custom-data",
        DATABASE_PATH: "custom-db/toolbox.db",
        API_PORT: "4311",
        DEPLOYMENT_MODE: "lan",
        ADMIN_PIN: "test-only",
        EDGE_TTS_PYTHON: "untrusted.exe",
        CHATTERBOX_WORKER_URL: "http://127.0.0.1:9999"
      }
    });
    expect(config.desktopManagedCapabilities).toBe(true);
    expect(config.storageRoot).toBe(path.join(layout.appRoot, "custom-data"));
    expect(config.databasePath).toBe(path.join(layout.appRoot, "custom-db/toolbox.db"));
    expect(config.port).toBe(4311);
    expect(config.deploymentMode).toBe("lan");
    expect(config.edgeTtsPythonPath).toBe("");
    expect(config.chatterboxWorkerUrl).toBe("http://127.0.0.1:1");
    expect(config.runtime.runtimeRoot).toBe(layout.runtimeRoot);
  });
});
