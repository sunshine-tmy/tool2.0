/**
 * 中文模块说明：测试 backend/src/__tests__/xhs-archive.test.ts 中的稳定行为、边界条件和回归场景
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { XhsAuthSession } from "@toolbox/shared";
import { createApp } from "../app";
import { XhsAuthManager } from "../modules/xhs-archive/auth";

const originalFetch = globalThis.fetch;
const publicResolver = async () => [{ address: "93.184.216.34", family: 4 }];
let storageRoot: string;

beforeEach(async () => {
  storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-xhs-archive-"));
  process.env.STORAGE_ROOT = storageRoot;
  process.env.XHS_PROVIDER_URL = "https://provider.test";
  process.env.XHS_TRANSLATION_PROVIDER_URL = "https://translation.test";
});

afterEach(async () => {
  globalThis.fetch = originalFetch;
  delete process.env.STORAGE_ROOT;
  delete process.env.XHS_PROVIDER_URL;
  delete process.env.XHS_TRANSLATION_PROVIDER_URL;
  vi.restoreAllMocks();
  await fs.rm(storageRoot, { recursive: true, force: true });
});

describe("xhs archive api", () => {
  it("downloads, persists, previews, refreshes and deletes an archive", async () => {
    const image = Buffer.from("a-local-image");
    globalThis.fetch = vi.fn(async (input, init) => {
      const url = String(input);
      if (url === "https://provider.test/extract") {
        return new Response(
          JSON.stringify({
            success: true,
            items: [
              {
                作品ID: "note-100",
                作品标题: "测试笔记",
                作品描述: "完整正文",
                作品类型: "图文",
                作品链接: "https://www.xiaohongshu.com/explore/note-100",
                作者ID: "author-1",
                作者昵称: "测试作者",
                下载地址: ["https://cdn.test/image.jpg"],
                动图地址: []
              }
            ]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      if (url === "https://cdn.test/image.jpg") {
        return new Response(image, {
          status: 200,
          headers: { "content-type": "image/jpeg", "content-length": String(image.length) }
        });
      }
      if (url === "https://translation.test/translate") {
        await new Promise((resolve) => setTimeout(resolve, 20));
        const body = JSON.parse(String(init?.body || "{}")) as { texts?: string[] };
        return new Response(JSON.stringify({ translations: (body.texts ?? []).map((text) => `EN:${text}`) }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    const app = await createApp({ remoteAddressResolver: publicResolver });
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/tools/xhs-archive/items",
      payload: { url: "分享 https://www.xiaohongshu.com/explore/note-100?xsec_token=test" }
    });
    expect(created.statusCode).toBe(202);
    const unifiedCreated = await app.inject({
      method: "GET",
      url: `/api/v1/tasks/${created.json().data.id}`
    });
    expect(unifiedCreated.statusCode).toBe(200);
    expect(unifiedCreated.json().data).toMatchObject({ toolId: "xhs-archive" });
    const firstTask = await waitForTask(app, created.json().data.id);
    expect(firstTask).toMatchObject({ status: "completed", progress: 100 });

    const detailResponse = await app.inject({
      method: "GET",
      url: `/api/v1/tools/xhs-archive/items/${firstTask.archiveId}`
    });
    const detail = detailResponse.json().data;
    expect(detail).toMatchObject({
      noteId: "note-100",
      title: "测试笔记",
      description: "完整正文",
      totalBytes: image.length
    });
    expect(detail.media).toHaveLength(1);
    const batchTranslation = await app.inject({
      method: "POST",
      url: "/api/v1/tools/xhs-archive/translation/batches",
      payload: { mode: "selected", itemIds: [detail.id] }
    });
    expect([200, 202]).toContain(batchTranslation.statusCode);
    const translated = await waitForTranslation(app, detail.id);
    expect(translated.translation).toMatchObject({ status: "ready", title: { machine: "EN:测试笔记" } });
    const translationTask = await waitForUnifiedTask(app, translated.translation.taskId);
    expect(translationTask).toMatchObject({ toolId: "xhs-translation", status: "completed" });

    const conflict = await app.inject({
      method: "PATCH",
      url: `/api/v1/tools/xhs-archive/items/${detail.id}/translation`,
      payload: { sourceHash: "0".repeat(64), title: { edited: "冲突编辑" }, topics: [] }
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json()).toMatchObject({
      success: false,
      error: { code: "XHS_TRANSLATION_SOURCE_CHANGED" },
      requestId: expect.any(String)
    });

    const preview = await app.inject({
      method: "GET",
      url: detail.media[0].previewUrl,
      headers: { range: "bytes=2-6" }
    });
    expect(preview.statusCode).toBe(206);
    expect(preview.headers["content-range"]).toBe(`bytes 2-6/${image.length}`);
    expect(preview.rawPayload).toEqual(image.subarray(2, 7));

    const zip = await app.inject({ method: "GET", url: `/api/v1/tools/xhs-archive/items/${detail.id}/download.zip` });
    expect(zip.statusCode).toBe(200);
    expect(zip.headers["content-type"]).toBe("application/zip");
    expect(zip.rawPayload.subarray(0, 2).toString()).toBe("PK");
    expect(zip.headers["content-disposition"]).toContain("filename*=UTF-8''");

    const refreshed = await app.inject({ method: "POST", url: `/api/v1/tools/xhs-archive/items/${detail.id}/refresh` });
    const refreshTask = await waitForTask(app, refreshed.json().data.id);
    expect(refreshTask.archiveId).toBe(detail.id);
    const refreshedDetail = await app.inject({ method: "GET", url: `/api/v1/tools/xhs-archive/items/${detail.id}` });
    expect(refreshedDetail.json().data.media[0].id).toBe(detail.media[0].id);
    const list = await app.inject({ method: "GET", url: "/api/v1/tools/xhs-archive/items?keyword=测试作者" });
    expect(list.json().data).toMatchObject({ total: 1 });

    const removed = await app.inject({ method: "DELETE", url: `/api/v1/tools/xhs-archive/items/${detail.id}` });
    expect(removed.json().data).toMatchObject({ removed: true, mediaCount: 1, releasedBytes: image.length });
    await app.close();
  });

  it("rejects non-Xiaohongshu links before starting a task", async () => {
    globalThis.fetch = vi.fn() as typeof fetch;
    const app = await createApp({ remoteAddressResolver: publicResolver });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/tools/xhs-archive/items",
      payload: { url: "https://example.com/post" }
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("XHS_URL_INVALID");
    expect(globalThis.fetch).not.toHaveBeenCalled();
    await app.close();
  });

  it("rejects malformed archive routes and payloads at the schema boundary", async () => {
    globalThis.fetch = vi.fn() as typeof fetch;
    const app = await createApp({ remoteAddressResolver: publicResolver });
    const responses = await Promise.all([
      app.inject({ method: "GET", url: "/api/v1/tools/xhs-archive/items/bad!" }),
      app.inject({ method: "GET", url: "/api/v1/tools/xhs-archive/tasks/bad!" }),
      app.inject({ method: "GET", url: "/api/v1/tools/xhs-archive/items?type=unsupported" }),
      app.inject({ method: "GET", url: "/api/v1/tools/xhs-archive/items/abcdef/media/ghijkl?download=2" }),
      app.inject({ method: "POST", url: "/api/v1/tools/xhs-archive/items", payload: {} }),
      app.inject({
        method: "PATCH",
        url: "/api/v1/tools/xhs-archive/items/abcdef/translation",
        payload: { sourceHash: "invalid", title: { edited: "Title" }, topics: [] }
      })
    ]);

    for (const response of responses) {
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        success: false,
        error: { code: "REQUEST_INVALID" },
        requestId: expect.any(String)
      });
    }
    expect(globalThis.fetch).not.toHaveBeenCalled();
    await app.close();
  });

  it("serves schema-validated runtime, list and missing-resource envelopes", async () => {
    globalThis.fetch = vi.fn() as typeof fetch;
    const app = await createApp({ remoteAddressResolver: publicResolver });
    const [runtime, translationRuntime, list, task, translationTask, detail, media] = await Promise.all([
      app.inject({ method: "GET", url: "/api/v1/tools/xhs-archive/runtime" }),
      app.inject({ method: "GET", url: "/api/v1/tools/xhs-archive/translation/runtime" }),
      app.inject({ method: "GET", url: "/api/v1/tools/xhs-archive/items" }),
      app.inject({ method: "GET", url: "/api/v1/tools/xhs-archive/tasks/missing_task" }),
      app.inject({ method: "GET", url: "/api/v1/tools/xhs-archive/translation/tasks/missing_task" }),
      app.inject({ method: "GET", url: "/api/v1/tools/xhs-archive/items/missing_item" }),
      app.inject({ method: "GET", url: "/api/v1/tools/xhs-archive/items/missing_item/media/missing_media" })
    ]);

    expect(runtime.statusCode).toBe(200);
    expect(runtime.json()).toMatchObject({
      success: true,
      data: { status: expect.any(String), authenticated: expect.any(Boolean) },
      requestId: expect.any(String)
    });
    expect(translationRuntime.statusCode).toBe(200);
    expect(translationRuntime.json()).toMatchObject({
      success: true,
      data: { status: expect.any(String), modelId: "Helsinki-NLP/opus-mt-zh-en" },
      requestId: expect.any(String)
    });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toMatchObject({
      success: true,
      data: { items: [], total: 0, page: 1 },
      requestId: expect.any(String)
    });
    for (const response of [task, translationTask, detail, media]) {
      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        success: false,
        error: { code: expect.any(String) },
        requestId: expect.any(String)
      });
    }
    expect(globalThis.fetch).not.toHaveBeenCalled();
    await app.close();
  });

  it("serves the login session lifecycle and missing-session error contract", async () => {
    const session: XhsAuthSession = {
      id: "auth-session-1",
      status: "pending",
      message: "正在准备登录窗口",
      createdAt: "2026-09-15T00:00:00.000Z",
      updatedAt: "2026-09-15T00:00:00.000Z"
    };
    vi.spyOn(XhsAuthManager.prototype, "start").mockReturnValue(session);
    vi.spyOn(XhsAuthManager.prototype, "get").mockImplementation((id) => (id === session.id ? session : undefined));

    const app = await createApp({ remoteAddressResolver: publicResolver });
    const started = await app.inject({ method: "POST", url: "/api/v1/tools/xhs-archive/auth/start" });
    expect(started.statusCode).toBe(200);
    expect(started.json()).toMatchObject({
      success: true,
      data: { id: session.id, status: "pending" },
      requestId: expect.any(String)
    });

    const current = await app.inject({ method: "GET", url: `/api/v1/tools/xhs-archive/auth/${session.id}` });
    expect(current.statusCode).toBe(200);
    expect(current.json().data).toMatchObject({ id: session.id, status: "pending" });

    const missing = await app.inject({ method: "GET", url: "/api/v1/tools/xhs-archive/auth/missing-session" });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({ success: false, error: { code: "XHS_AUTH_SESSION_NOT_FOUND" } });
    await app.close();
  });

  it("rejects a short-link redirect outside Xiaohongshu before provider access", async () => {
    globalThis.fetch = vi.fn(async (input) => {
      const url = String(input);
      if (url === "https://xhslink.com/short") {
        return new Response(null, { status: 302, headers: { location: "https://example.com/not-xhs" } });
      }
      if (url === "https://example.com/not-xhs") {
        const response = new Response(null, { status: 200 });
        Object.defineProperty(response, "url", { value: url });
        return response;
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    const app = await createApp({ remoteAddressResolver: publicResolver });
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/tools/xhs-archive/items",
      payload: { url: "https://xhslink.com/short" }
    });
    const task = await waitForTask(app, created.json().data.id);
    expect(task).toMatchObject({ status: "failed", errorCode: "XHS_URL_INVALID" });
    expect(globalThis.fetch).not.toHaveBeenCalledWith("https://provider.test/extract", expect.anything());
    await app.close();
  });

  it("rate limits repeated remote archive requests independently", async () => {
    globalThis.fetch = vi.fn() as typeof fetch;
    const app = await createApp({ remoteAddressResolver: publicResolver });
    let response;
    for (let requestNumber = 0; requestNumber < 11; requestNumber += 1) {
      response = await app.inject({
        method: "POST",
        url: "/api/v1/tools/xhs-archive/items",
        payload: { url: "https://example.com/post" }
      });
    }

    expect(response?.statusCode).toBe(429);
    expect(response?.json().error.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(globalThis.fetch).not.toHaveBeenCalled();
    await app.close();
  });
});

async function waitForTask(app: Awaited<ReturnType<typeof createApp>>, id: string) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const response = await app.inject({ method: "GET", url: `/api/v1/tools/xhs-archive/tasks/${id}` });
    const task = response.json().data;
    if (task.status === "completed" || task.status === "failed") return task;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("XHS archive task timed out");
}

async function waitForTranslation(app: Awaited<ReturnType<typeof createApp>>, id: string) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const response = await app.inject({ method: "GET", url: `/api/v1/tools/xhs-archive/items/${id}` });
    const item = response.json().data;
    if (item.translation?.status === "ready" || item.translation?.status === "failed") return item;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("XHS translation task timed out");
}

async function waitForUnifiedTask(app: Awaited<ReturnType<typeof createApp>>, id: string) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const response = await app.inject({ method: "GET", url: `/api/v1/tasks/${id}` });
    const task = response.json().data;
    if (task.status === "completed" || task.status === "failed") return task;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Unified task timed out");
}
