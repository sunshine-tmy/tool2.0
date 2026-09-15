/**
 * 中文模块说明：端到端验收场景，验证真实浏览器中的关键用户流程
 */
import { expect, test } from "@playwright/test";

const apiPort = process.env.PLAYWRIGHT_API_PORT || "33100";
const apiBase = `http://127.0.0.1:${apiPort}/api/v1`;

test.describe("toolbox critical workflows", () => {
  test("starts the web app and reports live/ready health", async ({ page, request }) => {
    await expect((await request.get(`http://127.0.0.1:${apiPort}/health/live`)).status()).toBe(200);
    await expect((await request.get(`http://127.0.0.1:${apiPort}/health/ready`)).status()).toBe(200);

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "今天要处理什么？" })).toBeVisible();
    await expect(page.getByRole("button", { name: "查看本地服务状态" })).toContainText("本地服务可用");
  });

  test("uploads a file, resumes a missing chunk, and batch deletes it", async ({ page, request }) => {
    const fileName = `playwright-${Date.now()}.txt`;
    const content = "Playwright LAN resumable upload";
    const create = await request.post(`${apiBase}/tools/lan-transfer/uploads`, {
      data: {
        originalName: fileName,
        mimeType: "text/plain",
        size: Buffer.byteLength(content),
        chunkSize: Buffer.byteLength(content),
        totalChunks: 1
      }
    });
    expect(create.status()).toBe(200);
    const uploadId = (await create.json()).data.uploadId as string;
    const incomplete = await request.post(`${apiBase}/tools/lan-transfer/uploads/${uploadId}/complete`);
    expect(incomplete.status()).toBe(409);
    expect((await incomplete.json()).error.code).toBe("UPLOAD_INCOMPLETE");

    const chunk = await request.put(`${apiBase}/tools/lan-transfer/uploads/${uploadId}/chunks/0`, {
      multipart: { file: { name: fileName, mimeType: "text/plain", buffer: Buffer.from(content) } }
    });
    expect(chunk.status()).toBe(200);
    const completed = await request.post(`${apiBase}/tools/lan-transfer/uploads/${uploadId}/complete`);
    expect(completed.status()).toBe(200);
    const fileId = (await completed.json()).data.file.id as string;

    await page.goto("/tools/lan-transfer");
    await expect(page.getByRole("heading", { name: "局域网文件传输" })).toBeVisible();
    await expect(page.getByText(fileName, { exact: true })).toBeVisible();
    await page.getByRole("checkbox", { name: `选择 ${fileName}` }).check();
    await page.getByRole("button", { name: /批量删除/ }).click();
    await page.getByRole("button", { name: "确认" }).click();
    await expect(page.getByText(fileName, { exact: true })).toHaveCount(0);

    const deleted = await request.get(`${apiBase}/tools/lan-transfer/files/${fileId}/download`);
    expect(deleted.status()).toBe(404);
  });

  test("creates and completes an Edge-TTS task in the page", async ({ page }) => {
    await page.route("**/api/v1/tools/edge-tts/health", async (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            available: true,
            version: "e2e",
            message: "E2E voice service",
            queue: { active: 0, queued: 0, concurrency: 1, limit: 20 },
            retentionDays: 3,
            maxTextLength: 20_000,
            onlineService: true
          },
          requestId: "e2e-health"
        })
      })
    );
    await page.route("**/api/v1/tools/edge-tts/voices**", async (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            voices: [
              {
                name: "Yasmin Neural",
                shortName: "ms-MY-YasminNeural",
                locale: "ms-MY",
                gender: "Female",
                suggested: true
              }
            ],
            source: "fallback"
          },
          requestId: "e2e-voices"
        })
      })
    );
    await page.route("**/api/v1/tools/edge-tts/tasks", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: { tasks: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 } },
            requestId: "e2e-history"
          })
        });
        return;
      }
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            id: "e2e-edge-task",
            status: "queued",
            progress: 0,
            text: "Selamat datang",
            language: "ms-MY",
            voice: "ms-MY-YasminNeural",
            rate: 0,
            volume: 0,
            pitch: 0,
            includeSubtitles: false,
            characterCount: 15,
            expiresAt: "2026-09-18T00:00:00.000Z",
            createdAt: "2026-09-15T00:00:00.000Z",
            updatedAt: "2026-09-15T00:00:00.000Z"
          },
          requestId: "e2e-create"
        })
      });
    });
    await page.route("**/api/v1/tasks/e2e-edge-task/events", async (route) => {
      await route.fulfill({
        contentType: "text/event-stream",
        body: `event: task\ndata: ${JSON.stringify({
          id: "e2e-edge-task",
          toolId: "edge-tts",
          status: "completed",
          progress: 100,
          createdAt: "2026-09-15T00:00:00.000Z",
          updatedAt: "2026-09-15T00:00:01.000Z"
        })}\n\n`
      });
    });
    await page.route("**/api/v1/tools/edge-tts/tasks/e2e-edge-task", async (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            id: "e2e-edge-task",
            status: "completed",
            progress: 100,
            text: "Selamat datang",
            language: "ms-MY",
            voice: "ms-MY-YasminNeural",
            rate: 0,
            volume: 0,
            pitch: 0,
            includeSubtitles: false,
            characterCount: 15,
            expiresAt: "2026-09-18T00:00:00.000Z",
            audioUrl: "/api/v1/tools/edge-tts/tasks/e2e-edge-task/audio",
            downloadUrl: "/api/v1/tools/edge-tts/tasks/e2e-edge-task/download",
            createdAt: "2026-09-15T00:00:00.000Z",
            updatedAt: "2026-09-15T00:00:01.000Z"
          },
          requestId: "e2e-task"
        })
      })
    );

    await page.goto("/tools/edge-tts");
    await expect(page.getByRole("heading", { name: "多国语言配音" })).toBeVisible();
    await page.getByPlaceholder(/例如：Selamat datang/).fill("Selamat datang");
    await page.getByRole("button", { name: "生成语音" }).click();
    const result = page.locator(".edge-tts-result");
    await expect(result).toBeVisible();
    await expect(result).toContainText("已完成");
    await expect(result).toContainText("ms-MY-YasminNeural");
  });

  test("lists XHS archives and retries a failed task", async ({ page }) => {
    let attempts = 0;
    await page.route("**/api/v1/tools/xhs-archive/items", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: { items: [], total: 0, page: 1, pageSize: 12, pageCount: 1 },
            requestId: "e2e-xhs-list"
          })
        });
        return;
      }
      attempts += 1;
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            id: `e2e-xhs-task-${attempts}`,
            status: "pending",
            stage: "parsing",
            progress: 15,
            message: "正在解析链接",
            createdAt: "2026-09-15T00:00:00.000Z",
            updatedAt: "2026-09-15T00:00:00.000Z"
          },
          requestId: `e2e-xhs-create-${attempts}`
        })
      });
    });
    await page.route("**/api/v1/tasks/e2e-xhs-task-1/events", async (route) => {
      await route.fulfill({
        contentType: "text/event-stream",
        body: `event: task\ndata: ${JSON.stringify({
          id: "e2e-xhs-task-1",
          toolId: "xhs-archive",
          status: "failed",
          progress: 15,
          error: "需要登录",
          createdAt: "2026-09-15T00:00:00.000Z",
          updatedAt: "2026-09-15T00:00:01.000Z"
        })}\n\n`
      });
    });
    await page.route("**/api/v1/tasks/e2e-xhs-task-2/events", async (route) => {
      await route.fulfill({
        contentType: "text/event-stream",
        body: `event: task\ndata: ${JSON.stringify({
          id: "e2e-xhs-task-2",
          toolId: "xhs-archive",
          status: "completed",
          progress: 100,
          createdAt: "2026-09-15T00:00:00.000Z",
          updatedAt: "2026-09-15T00:00:01.000Z"
        })}\n\n`
      });
    });
    await page.route("**/api/v1/tools/xhs-archive/tasks/e2e-xhs-task-*", async (route) => {
      const id = route.request().url().includes("e2e-xhs-task-1") ? "e2e-xhs-task-1" : "e2e-xhs-task-2";
      const failed = id.endsWith("-1");
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            id,
            status: failed ? "failed" : "completed",
            stage: failed ? "failed" : "completed",
            progress: failed ? 15 : 100,
            message: failed ? "需要登录" : "处理完成",
            ...(failed ? { error: "需要登录" } : {}),
            createdAt: "2026-09-15T00:00:00.000Z",
            updatedAt: "2026-09-15T00:00:01.000Z"
          },
          requestId: `e2e-xhs-task-${id}`
        })
      });
    });

    await page.goto("/tools/xhs-archive");
    await expect(page.getByRole("heading", { name: "小红书内容归档" })).toBeVisible();
    await page.getByPlaceholder(/直接按 Ctrl\+V/).fill("https://www.xiaohongshu.com/explore/e2e");
    await page.getByRole("button", { name: "获取并存档" }).click();
    await expect(page.getByRole("button", { name: "重新尝试" })).toBeVisible();
    await page.getByRole("button", { name: "重新尝试" }).click();
    await expect.poll(() => attempts).toBe(2);
  });
});
