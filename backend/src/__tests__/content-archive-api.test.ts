/** 真实 Fastify 契约与隔离 SQLite：新旧入口共用任务/存储，验证权限、Range、SSE 和重启。 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import type { FastifyInstance } from "fastify";
import { isContentArchiveItem, isContentArchiveTask } from "@toolbox/shared";
import { createApp } from "../app";
import { getConfig } from "../config";
import { createDevelopmentRuntimeLayout } from "../runtime/runtime-layout";
import { DouyinRuntimeManager } from "../modules/media-archive/douyin-runtime";
import { ContentArchiveTaskService } from "../modules/media-archive/task-service";
import { ArchiveTaskError } from "../modules/media-archive/provider";
import type { DouyinSource } from "../modules/media-archive/douyin-source";

const nativeFetch = globalThis.fetch;
let root: string;
let config: ReturnType<typeof getConfig>;
let png: Buffer;
let apps: FastifyInstance[];
let extract: MockInstance<DouyinRuntimeManager["extract"]>;
const prefix = "/api/v1/tools/media-archive";
const url = "https://www.douyin.com/video/123456789";
function work(): { source: DouyinSource; via: "normal-browser-ssr" } {
  return {
    via: "normal-browser-ssr",
    source: {
      platform: "douyin",
      contentId: "123456789",
      canonicalUrl: url,
      type: "image",
      title: "归档测试",
      description: "完整原文 #时间",
      tags: ["时间"],
      author: { name: "作者" },
      media: [{ kind: "image", index: 0, urls: ["https://cdn.test/image.png"] }]
    }
  };
}
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-content-api-"));
  config = getConfig({
    layout: createDevelopmentRuntimeLayout({ storageRoot: root, runtimeRoot: path.join(root, "runtime") }),
    dotenvPath: false,
    environment: {
      NODE_ENV: "test",
      DEPLOYMENT_MODE: "local",
      STORAGE_ROOT: root,
      DATABASE_PATH: path.join(root, "toolbox.db"),
      XHS_PROVIDER_URL: "https://provider.test",
      XHS_TRANSLATION_PROVIDER_URL: "https://translate.test"
    }
  });
  apps = [];
  png = await sharp({ create: { width: 120, height: 64, channels: 3, background: "blue" } })
    .png()
    .toBuffer();
  extract = vi.spyOn(DouyinRuntimeManager.prototype, "extract").mockResolvedValue(work());
  globalThis.fetch = vi.fn(async (input, init) => {
    const target = String(input);
    if (target === "https://provider.test/extract")
      return new Response(
        JSON.stringify({
          success: true,
          items: [
            {
              id: "123456789",
              type: "image",
              title: "小红书原文",
              description: "正文",
              downloads: ["https://cdn.test/image.png"]
            }
          ]
        }),
        { headers: { "content-type": "application/json" } }
      );
    if (target === "https://translate.test/translate") {
      const body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ translations: body.texts.map((text: string) => "EN:" + text) }), {
        headers: { "content-type": "application/json" }
      });
    }
    if (target === "https://cdn.test/image.png")
      return new Response(new Uint8Array(png), { headers: { "content-type": "image/png" } });
    throw new Error("未预期的请求，不能访问真实网络");
  }) as typeof fetch;
});
afterEach(async () => {
  for (const app of apps) await app.close().catch(() => undefined);
  globalThis.fetch = nativeFetch;
  vi.restoreAllMocks();
  if (
    !path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep) ||
    !path.basename(root).startsWith("toolbox-content-api-")
  )
    throw new Error("清理目录越界");
  await fs.rm(root, { recursive: true, force: true });
});
async function appWith(resolver = async () => [{ address: "93.184.216.34", family: 4 }], appConfig = config) {
  const app = await createApp({ config: appConfig, remoteAddressResolver: resolver });
  apps.push(app);
  return app;
}
async function terminal(app: FastifyInstance, id: string) {
  let task;
  await vi.waitFor(async () => {
    const response = await app.inject({ method: "GET", url: `${prefix}/tasks/${id}` });
    expect(response.statusCode).toBe(200);
    task = response.json().data;
    expect(["completed", "failed"]).toContain(task.status);
  });
  return task! as ReturnType<ContentArchiveTaskService["get"]> & {};
}
async function create(app: FastifyInstance) {
  const response = await app.inject({ method: "POST", url: `${prefix}/items`, payload: { url } });
  expect(response.statusCode).toBe(202);
  expect(isContentArchiveTask(response.json().data)).toBe(true);
  return terminal(app, response.json().data.id);
}

describe("多媒体归档 API 与兼容性", () => {
  it("新旧入口同作品 ID 共存，旧任务/列表/详情不能读抖音", async () => {
    const app = await appWith();
    const douyin = await create(app);
    const xhsResponse = await app.inject({
      method: "POST",
      url: "/api/v1/tools/xhs-archive/items",
      payload: { url: "https://www.xiaohongshu.com/explore/123456789" }
    });
    const xhs = await terminal(app, xhsResponse.json().data.id);
    expect(xhs.status).toBe("completed");
    expect((await app.inject(`${prefix}/items`)).json().data.total).toBe(2);
    expect(
      (await app.inject(`${prefix}/items?platform=douyin&keyword=完整原文&type=image&pageSize=1`)).json().data.total
    ).toBe(1);
    const old = await app.inject("/api/v1/tools/xhs-archive/items");
    expect(old.json().data.total).toBe(1);
    expect(old.json().data.items[0]).not.toHaveProperty("platform");
    expect(old.json().data.items[0].noteId).toBe("123456789");
    for (const endpoint of [`items/${douyin.archiveId}`, `tasks/${douyin.id}`])
      expect((await app.inject(`/api/v1/tools/xhs-archive/${endpoint}`)).statusCode).toBe(404);
    expect(
      (await app.inject({ method: "POST", url: `/api/v1/tools/xhs-archive/items/${douyin.archiveId}/refresh` }))
        .statusCode
    ).toBe(404);
    expect((await app.inject(`/api/v1/tasks/${douyin.id}`)).json().data.toolId).toBe("media-archive");
    const detail = (await app.inject(`${prefix}/items/${douyin.archiveId}`)).json().data;
    expect(isContentArchiveItem(detail)).toBe(true);
    expect(detail).toMatchObject({ rawText: "完整原文 #时间", platform: "douyin", topics: [{ source: "时间" }] });
  });
  it("刷新稳定身份、媒体 Range/下载和重启后任务/归档读取通过", async () => {
    const app = await appWith();
    const task = await create(app);
    const detail = (await app.inject(`${prefix}/items/${task.archiveId}`)).json().data;
    const preview = detail.media[0].previewUrl;
    for (const [range, expected] of [
      [undefined, 200],
      ["bytes=2-6", 206],
      ["bytes=-8", 206],
      ["bytes=8-", 206],
      ["bytes=0-999999", 206],
      ["bytes=2-1", 416],
      ["bytes=999999-", 416],
      ["bytes=-0", 416],
      ["bytes=-", 416],
      ["bytes=1-2,4-5", 416],
      ["bytes=999999999999999999-", 416]
    ] as const) {
      const result = await app.inject({ url: preview, headers: range ? { range } : {} });
      expect(result.statusCode).toBe(expected);
      if (range === "bytes=-8") expect(result.rawPayload).toEqual(png.subarray(png.length - 8));
    }
    const download = await app.inject(preview + "?download=1");
    expect(download.headers["content-disposition"]).toContain("filename*=UTF-8''");
    expect(download.rawPayload).toEqual(png);
    const refresh = await app.inject({ method: "POST", url: `${prefix}/items/${task.archiveId}/refresh` });
    expect((await terminal(app, refresh.json().data.id)).archiveId).toBe(task.archiveId);
    expect((await app.inject(`${prefix}/items/${task.archiveId}`)).json().data.media[0].id).toBe(detail.media[0].id);
    await app.close();
    const restarted = await appWith();
    expect((await restarted.inject(`${prefix}/tasks/${task.id}`)).json().data.status).toBe("completed");
    expect((await restarted.inject(`${prefix}/items/${task.archiveId}`)).json().data.media[0].id).toBe(
      detail.media[0].id
    );
    for (const health of ["/health/live", "/health/ready"])
      expect((await restarted.inject(health)).statusCode).toBe(200);
  });
  it("桌面托管模式下未安装的运行时不会启动浏览器，任务返回稳定失败码", async () => {
    extract.mockRestore();
    // 组件进入正式目录后，Web 模式会按设计首次自动安装；此场景专门验证桌面托管模式的未安装边界。
    const app = await appWith(undefined, { ...config, desktopManagedCapabilities: true });
    expect(await create(app)).toMatchObject({ status: "failed", errorCode: "ARCHIVE_COMPONENT_NOT_INSTALLED" });
    expect((await app.inject(`${prefix}/items`)).json().data.total).toBe(0);
  });
  it("非法契约/平台选择与缺失资源返回统一失败信封", async () => {
    const app = await appWith();
    for (const payload of [
      { url, platform: "xiaohongshu" },
      { url: "invalid" },
      { url, cookie: "secret" },
      { url, platform: "other" }
    ]) {
      const response = await app.inject({ method: "POST", url: `${prefix}/items`, payload });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ success: false, requestId: expect.any(String) });
    }
    for (const [method, endpoint] of [
      ["GET", "items/missing_123456"],
      ["GET", "tasks/missing_123456"],
      ["DELETE", "tasks/missing_123456"],
      ["POST", "items/missing_123456/refresh"],
      ["DELETE", "items/missing_123456"],
      ["GET", "items/missing_123456/media/media_123456"]
    ] as const)
      expect((await app.inject({ method, url: `${prefix}/${endpoint}` })).statusCode).toBe(404);
    expect((await app.inject(`${prefix}/items?platform=auto`)).statusCode).toBe(400);
    expect(extract).not.toHaveBeenCalled();
  });
  it("归档获取入口执行独立的远程请求速率额度并返回稳定 429", async () => {
    const app = await appWith();
    for (let index = 0; index < 10; index += 1) {
      const response = await app.inject({ method: "POST", url: `${prefix}/items`, payload: { url } });
      expect(response.statusCode).toBe(202);
    }

    const limited = await app.inject({ method: "POST", url: `${prefix}/items`, payload: { url } });
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toMatchObject({
      success: false,
      error: { code: "RATE_LIMIT_EXCEEDED" },
      requestId: expect.any(String)
    });
    // 远程获取限额不应连带阻断低成本健康检查。
    expect((await app.inject("/health/live")).statusCode).toBe(200);
  });
  it("取消运行任务返回终态并允许显式新建重试，不保留空归档", async () => {
    extract.mockImplementation(() => new Promise(() => undefined));
    const app = await appWith();
    const first = await app.inject({ method: "POST", url: `${prefix}/items`, payload: { url } });
    await vi.waitFor(() => expect(extract).toHaveBeenCalledOnce());
    const cancelled = await app.inject({ method: "DELETE", url: `${prefix}/tasks/${first.json().data.id}` });
    expect(cancelled.json().data).toMatchObject({ status: "failed", errorCode: "ARCHIVE_CANCELLED" });
    extract.mockResolvedValue(work());
    expect((await create(app)).status).toBe("completed");
  });
  it("关闭服务取消自动翻译并先落库，迟到的网络结果不能再写数据库", async () => {
    const original = globalThis.fetch;
    let signal: AbortSignal | undefined;
    let release!: (response: Response) => void;
    globalThis.fetch = vi.fn(async (input, init) => {
      if (String(input) !== "https://translate.test/translate") return original(input, init);
      signal = init?.signal ?? undefined;
      // 故意模拟不响应取消的依赖，服务必须自行终止等待并落盘 interrupted。
      return new Promise<Response>((resolve) => {
        release = resolve;
      });
    }) as typeof fetch;
    const app = await appWith();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/tools/xhs-archive/items",
      payload: { url: "https://www.xiaohongshu.com/explore/123456789" }
    });
    const archived = await terminal(app, response.json().data.id);
    await vi.waitFor(() => expect(signal).toBeDefined());
    await app.close();
    expect(signal?.aborted).toBe(true);
    release(new Response(JSON.stringify({ translations: ["迟到结果"] })));
    await new Promise((resolve) => setTimeout(resolve, 10));
    const restarted = await appWith();
    const item = (await restarted.inject(`${prefix}/items/${archived.archiveId}`)).json().data;
    expect(item.translation).toMatchObject({
      status: "failed",
      error: { code: "XHS_TRANSLATION_INTERRUPTED" }
    });
    const tasks = (await restarted.inject("/api/v1/tasks")).json().data;
    expect(tasks.find((task: { toolId: string }) => task.toolId === "xhs-translation")).toMatchObject({
      status: "failed",
      error: "XHS_TRANSLATION_INTERRUPTED"
    });
    expect((await restarted.inject("/health/ready")).statusCode).toBe(200);
  });
  it("LAN 写操作要求管理员会话及精确 Origin/CSRF，不为新路由放开访客权限", async () => {
    config.deploymentMode = "lan";
    config.adminPin = "2468";
    config.corsOrigins = ["http://localhost:5173"];
    const app = await appWith();
    const boundary = "----archive-guest-frame";
    const frameUpload = {
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: Buffer.concat([
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="sourceMediaId"\r\n\r\nmedia_123456\r\n` +
            `--${boundary}\r\nContent-Disposition: form-data; name="timestampMs"\r\n\r\n1000\r\n` +
            `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="frame.png"\r\nContent-Type: image/png\r\n\r\n`
        ),
        png,
        Buffer.from(`\r\n--${boundary}--\r\n`)
      ])
    };
    // 覆盖中性接口全部 JSON/multipart 写入口；LAN 访客只能使用被显式放行的文件传输接口。
    const mutations = [
      { method: "POST" as const, url: `${prefix}/items`, payload: { url } },
      { method: "POST" as const, url: `${prefix}/items/missing_123456/refresh` },
      { method: "DELETE" as const, url: `${prefix}/items/missing_123456` },
      { method: "DELETE" as const, url: `${prefix}/tasks/missing_task123` },
      { method: "POST" as const, url: `${prefix}/items/missing_123456/frames`, ...frameUpload },
      { method: "POST" as const, url: `${prefix}/items/missing_123456/translation`, payload: { force: false } },
      {
        method: "POST" as const,
        url: `${prefix}/translation/batches`,
        payload: { mode: "selected", itemIds: ["missing_123456"] }
      },
      {
        method: "PATCH" as const,
        url: `${prefix}/items/missing_123456/translation`,
        payload: { sourceHash: "a".repeat(64), title: { edited: "标题" }, topics: [] }
      },
      { method: "POST" as const, url: `${prefix}/items/missing_123456/translation/reset` }
    ];
    const guestResults = await Promise.all(mutations.map((request) => app.inject(request)));
    expect(guestResults.map((response) => response.statusCode)).toEqual(mutations.map(() => 401));
    const login = await app.inject({ method: "POST", url: "/api/v1/session", payload: { pin: "2468" } });
    const cookie = String(login.headers["set-cookie"]).split(";")[0];
    const csrfToken = login.json().data.csrfToken as string;
    const wrongOriginResults = await Promise.all(
      mutations.map((request) =>
        app.inject({
          ...request,
          headers: {
            ...("headers" in request ? request.headers : {}),
            cookie,
            origin: "http://evil.test",
            "x-csrf-token": csrfToken
          }
        })
      )
    );
    expect(wrongOriginResults.map((response) => response.statusCode)).toEqual(mutations.map(() => 403));
    expect(
      (
        await app.inject({
          method: "POST",
          url: `${prefix}/items`,
          payload: { url },
          headers: { cookie, origin: "http://localhost:5173" }
        })
      ).statusCode
    ).toBe(403);
    const created = await app.inject({
      method: "POST",
      url: `${prefix}/items`,
      payload: { url },
      headers: { cookie, origin: "http://localhost:5173", "x-csrf-token": csrfToken }
    });
    expect(created.statusCode).toBe(202);
    expect((await terminal(app, created.json().data.id)).status).toBe("completed");
  });
  it("媒体私网解析在 HTTP 请求前拒绝，不能因来自受管读取结果就绕过 SSRF", async () => {
    const app = await appWith(async () => [{ address: "127.0.0.1", family: 4 }]);
    expect(await create(app)).toMatchObject({ status: "failed", errorCode: "ARCHIVE_MEDIA_DOWNLOAD_FAILED" });
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect((await app.inject(`${prefix}/items`)).json().data.total).toBe(0);
  });
  it("SSE 使用通用任务事件并在完成时关闭，随后 HTTP 查询可降级轮询", async () => {
    let release!: (value: ReturnType<typeof work>) => void;
    extract.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        })
    );
    const app = await appWith();
    const origin = await app.listen({ host: "127.0.0.1", port: 0 });
    const created = await app.inject({ method: "POST", url: `${prefix}/items`, payload: { url } });
    const id = created.json().data.id;
    const response = await nativeFetch(`${origin}/api/v1/tasks/${id}/events`, { signal: AbortSignal.timeout(5000) });
    const reader = response.body!.getReader();
    let text = new TextDecoder().decode((await reader.read()).value);
    await vi.waitFor(() => expect(extract).toHaveBeenCalledOnce());
    release(work());
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      text += new TextDecoder().decode(next.value);
    }
    expect(text).toContain('"status":"completed"');
    expect(text).toContain('"progress":100');
    expect(text).not.toContain("rawText");
    expect((await terminal(app, id)).status).toBe("completed");
    const reconnected = await nativeFetch(`${origin}/api/v1/tasks/${id}/events`, { signal: AbortSignal.timeout(5000) });
    expect(await reconnected.text()).toContain('"status":"completed"');
  });
  it("HTTP 限流独立于媒体预览，稳定的队列/提交错误保留契约", async () => {
    const app = await appWith();
    const createSpy = vi.spyOn(ContentArchiveTaskService.prototype, "create").mockImplementation(() => {
      throw new ArchiveTaskError("ARCHIVE_QUEUE_FULL", "队列已满", 429);
    });
    const full = await app.inject({ method: "POST", url: `${prefix}/items`, payload: { url } });
    expect(full.statusCode).toBe(429);
    expect(full.json().error.code).toBe("ARCHIVE_QUEUE_FULL");
    createSpy.mockRestore();
    const first = await create(app);
    vi.spyOn(ContentArchiveTaskService.prototype, "cancel").mockRejectedValue(
      new ArchiveTaskError("ARCHIVE_COMMIT_IN_PROGRESS", "正在提交", 409)
    );
    expect((await app.inject({ method: "DELETE", url: `${prefix}/tasks/${first.id}` })).statusCode).toBe(409);
    expect(
      (await app.inject({ method: "DELETE", url: `${prefix}/items/${first.archiveId}` })).json().data.removed
    ).toBe(true);
  });
});
