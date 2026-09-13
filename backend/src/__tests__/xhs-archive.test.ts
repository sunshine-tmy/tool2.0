import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";

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
    const translated = await waitForTranslation(app, detail.id);
    expect(translated.translation).toMatchObject({ status: "ready", title: { machine: "EN:测试笔记" } });
    const translationTask = await waitForUnifiedTask(app, translated.translation.taskId);
    expect(translationTask).toMatchObject({ toolId: "xhs-translation", status: "completed" });

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
