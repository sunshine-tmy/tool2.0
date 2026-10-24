/** Fixed synthetic responses. No API, model, installed capability, desktop IPC or user data is used. */
import { createRequire } from "node:module";
import type { Page } from "@playwright/test";

const requireApi = createRequire(new URL("../../../apps/api/package.json", import.meta.url));
export const image: Buffer = await requireApi("sharp")({
  create: { width: 320, height: 240, channels: 4, background: { r: 55, g: 120, b: 220, alpha: 1 } }
})
  .png()
  .toBuffer();
export const longName =
  "商品展示图片_中文与空格_用于验证超长文件名不会改变原有布局_0123456789_ABCDEFGHIJKLMNOPQRSTUVWXYZ.png";
const stamp = "2026-10-24T00:00:00.000Z";
const task = {
  id: "r11-source-123",
  operation: "background_remove",
  status: "completed",
  progress: 100,
  queuePosition: null,
  createdAt: stamp,
  updatedAt: stamp,
  expiresAt: null,
  warnings: [],
  inputs: [{ originalName: longName, mimetype: "image/png", size: image.length, width: 320, height: 240 }],
  results: [
    {
      id: "r11-source-123-1",
      originalName: longName,
      outputName: longName,
      downloadUrl: "/api/v1/r11-image",
      width: 320,
      height: 240,
      provider: "birefnet-general",
      model: "BiRefNet",
      warnings: []
    }
  ]
};
const recipe = {
  schemaVersion: 1,
  canvas: { width: 1600, height: 1600 },
  background: { kind: "color", color: "#FFFFFF" },
  layout: { fill: 0.8, align: "center", offsetX: 0, offsetY: 0, scale: 1 }
};
const component = {
  id: "image-ai",
  moduleId: "image-ai",
  displayName: "AI 图片处理（CPU）",
  groupId: "image",
  purpose: "固定能力包与离线模型，验证长文本、卡片间距及路径展示。",
  taskToolIds: ["image-ai"],
  dependencyIds: ["python-312"],
  dependentIds: [],
  installConditions: ["依赖现有共享 Python 3.12；本测试不执行安装。"],
  version: "1.0.0-py312-cpu2",
  platform: "win32-x64",
  downloadBytes: 1806180251,
  installedBytes: 5200000000,
  installed: true,
  state: "ready",
  health: "healthy",
  licenseName: "内部使用",
  archiveFileNames: ["image-ai-1.0.0-py312-cpu1.tar.gz"],
  releasePageUrl: "https://github.com/sunshine-tmy/tool2.0/releases/tag/components-v1"
};

export async function installStyleFixtures(page: Page) {
  const writes: string[] = [];
  await page.clock.setFixedTime(new Date(stamp));
  await page.addInitScript(() => {
    window.localStorage.clear();
    Object.defineProperty(window, "toolboxDesktop", {
      configurable: true,
      value: {
        getSettings: async () => ({
          platform: "win32",
          startAtLogin: false,
          automaticUpdateChecks: true,
          updateChecksSupported: true,
          installDirectory: "F:\\R11 合成安装目录\\非常长的应用路径\\Ecommerce Toolbox",
          dataDirectory: "F:\\R11 合成安装目录\\非常长的应用路径\\Ecommerce Toolbox\\data",
          dataDirectoryDescription: "应用数据"
        })
      }
    });
  });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    // The existing playback guard posts an idle heartbeat on page entry; contain it entirely in this fixture.
    if (
      request.method() === "POST" &&
      url.pathname === "/api/v1/diagnostics/playback" &&
      request.postDataJSON()?.active === false
    ) {
      await route.fulfill({ status: 200, json: { success: true, data: null, requestId: "r11-fixed-request" } });
      return;
    }
    if (request.method() !== "GET") {
      writes.push(request.method() + " " + url.pathname);
      await route.fulfill({
        status: 409,
        json: { success: false, message: "R11 visual fixture forbids mutations", error: { code: "R11_READ_ONLY" } }
      });
      return;
    }
    if (/r11-image|\/thumbnail$|\/inputs\/\d+$/.test(url.pathname)) {
      await route.fulfill({ status: 200, contentType: "image/png", body: image });
      return;
    }
    let data: unknown;
    if (url.pathname === "/api/v1/diagnostics")
      data = {
        id: "r11-diagnostics",
        schemaVersion: 1,
        mode: "desktop",
        depth: "light",
        startedAt: stamp,
        finishedAt: stamp,
        phase: "完成",
        state: "completed",
        elapsedMs: 0,
        events: [],
        checks: [
          {
            id: "service",
            category: "service",
            title: "基础服务",
            status: "ok",
            code: "SERVICE_READY",
            message: "R11 固定合成状态",
            impact: "基础接口可用",
            suggestion: "无需处理",
            modules: []
          }
        ]
      };
    else if (url.pathname === "/api/v1/tools/image-ai/health")
      data = {
        protocolVersion: 1,
        available: true,
        deploymentUsage: "commercial",
        workerUrl: "http://127.0.0.1:1",
        models: ["lama", "real-esrgan", "birefnet-general"].map((provider) => ({
          provider,
          model: provider,
          version: "fixture",
          license: "fixture",
          device: "cpu",
          available: true
        }))
      };
    else if (url.pathname === "/api/v1/tools/image-ai/history")
      data = { items: [task], total: 1, page: 1, pageSize: 20 };
    else if (url.pathname.endsWith("/edit-source"))
      data = {
        taskId: task.id,
        resultId: task.results[0].id,
        width: 320,
        height: 240,
        foregroundUrl: "/api/v1/r11-image",
        originalUrl: "/api/v1/r11-image",
        canRestore: true,
        recipe
      };
    else if (url.pathname === "/api/v1/tools/image-ai/tasks/" + task.id) data = task;
    else if (url.pathname === "/api/v1/components") data = [component];
    else if (url.pathname === "/api/v1/maintenance/cleanup") data = [];
    else if (url.pathname === "/api/v1/lan-access")
      data = {
        status: "ready",
        urls: ["http://192.168.1.123:3100"],
        port: 3100,
        toolCount: 6,
        message: "局域网使用地址（合成）"
      };
    else if (url.pathname === "/api/v1/health")
      data = { name: "toolbox-api", version: "0.1.0", deploymentMode: "local" };
    else {
      await route.fulfill({
        status: 503,
        json: { success: false, message: "R11 固定离线状态", error: { code: "R11_FIXTURE_UNAVAILABLE" } }
      });
      return;
    }
    await route.fulfill({ status: 200, json: { success: true, data, requestId: "r11-fixed-request" } });
  });
  return writes;
}
