/**
 * 中文模块说明：端到端验收场景，验证真实浏览器中的关键用户流程
 */
import { expect, test } from "@playwright/test";
import type { EdgeTtsBatchCreate } from "../packages/shared/src/speech/edge-tts-batch";
import { assertOnlineSpeechInput, onlineSpeechBatch } from "./fixtures/online-speech";

const apiPort = process.env.PLAYWRIGHT_API_PORT || "33100";
const apiBase = `http://127.0.0.1:${apiPort}/api/v1`;

test.describe("toolbox critical workflows", () => {
  test("starts the web app and reports live/ready health", async ({ page, request }) => {
    await expect((await request.get(`http://127.0.0.1:${apiPort}/health/live`)).status()).toBe(200);
    await expect((await request.get(`http://127.0.0.1:${apiPort}/health/ready`)).status()).toBe(200);

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "今天要处理什么？" })).toBeVisible();
    const healthResponse = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/v1/health" && response.request().method() === "GET"
    );
    await page.getByRole("button", { name: "本地服务与管理员会话", exact: true }).click();
    expect((await healthResponse).ok()).toBe(true);
    await expect(page.locator(".service-summary")).toContainText("主服务运行正常");
    await expect(page.locator(".service-row .service-state")).toHaveCount(6);
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

  test("creates an ordered bilingual Edge-TTS batch and renders completed artifacts", async ({ page }) => {
    let submitted: EdgeTtsBatchCreate | undefined;
    let detailReads = 0;
    const unexpected: string[] = [];
    const pagination = { page: 1, pageSize: 10, total: 0, totalPages: 1 };
    await page.route(/\/api\/v1\/tools\/edge-tts\/(health|voices|tasks|batches)(\/|\?|$)/, async (route) => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      let data: unknown;
      let status = 200;
      if (pathname.endsWith("/health")) {
        data = {
          available: true,
          version: "e2e",
          message: "E2E voice service",
          queue: { active: 0, queued: 0, concurrency: 1, limit: 20 },
          retentionDays: 3,
          maxTextLength: 20_000,
          onlineService: true
        };
      } else if (pathname.endsWith("/voices")) {
        data = {
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
        };
      } else if (pathname.endsWith("/tasks") && request.method() === "GET") {
        data = { tasks: [], pagination };
      } else if (pathname.endsWith("/batches") && request.method() === "GET") {
        data = {
          batches: submitted ? [onlineSpeechBatch(submitted, detailReads > 0)] : [],
          pagination: { ...pagination, total: submitted ? 1 : 0 }
        };
      } else if (pathname.endsWith("/batches") && request.method() === "POST") {
        const input: unknown = request.postDataJSON();
        assertOnlineSpeechInput(input);
        submitted = input;
        data = onlineSpeechBatch(input, false);
        status = 202;
      } else if (pathname.endsWith("/batches/e2e-online-batch") && submitted && request.method() === "GET") {
        detailReads += 1;
        data = onlineSpeechBatch(submitted, true);
      } else {
        unexpected.push(`${request.method()} ${pathname}`);
        await route.fulfill({ status: 501, json: { success: false, message: "Unexpected test request" } });
        return;
      }
      await route.fulfill({ status, json: { success: true, data, requestId: "e2e-online" } });
    });

    await page.goto("/tools/edge-tts");
    await expect(page.getByRole("heading", { name: "多国语言配音" })).toBeVisible();
    await expect(page.getByRole("tab", { name: /参考音色克隆/ })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: /在线自然音色/ }).click();
    const panel = page.locator(".online-tts-panel");
    await panel.getByPlaceholder("批次名称（可选）").fill("双语有序测试");
    await panel.getByPlaceholder(/^第 1 段/).fill("Selamat datang.");
    await panel.getByPlaceholder("中文翻译（选填，不参与配音）").fill("欢迎。");
    await panel.getByRole("button", { name: "添加一段", exact: true }).click();
    await panel.getByPlaceholder(/^第 2 段/).fill("Terima kasih.");
    await panel.getByPlaceholder("中文翻译（选填，不参与配音）").nth(1).fill("谢谢。");
    await panel.getByRole("button", { name: "添加 2 个音频到生成队列", exact: true }).click();
    const result = panel.locator(".edge-tts-result");
    await expect(result).toContainText("已完成");
    await expect(result).toContainText("2/2");
    expect(submitted).toEqual({
      name: "双语有序测试",
      segments: [
        { text: "Selamat datang.", referenceTranslation: "欢迎。" },
        { text: "Terima kasih.", referenceTranslation: "谢谢。" }
      ],
      language: "ms-MY",
      voice: "ms-MY-YasminNeural",
      rate: 0,
      volume: 0,
      pitch: 0,
      includeSubtitles: true,
      subtitleMode: "sentences"
    });
    expect(detailReads).toBeGreaterThan(0);
    const root = "/api/v1/tools/edge-tts/batches/e2e-online-batch";
    for (const [label, suffix] of [
      ["下载全部 ZIP", "/download.zip"],
      ["下载总音频", "/combined-audio"],
      ["下载原文 SRT", "/subtitle"],
      ["下载中文 SRT", "/subtitle.zh-CN"],
      ["下载双语 SRT", "/subtitle.bilingual"]
    ]) {
      await expect(result.getByRole("link", { name: label, exact: true })).toHaveAttribute("href", `${root}${suffix}`);
    }
    expect(unexpected).toEqual([]);
  });

  test("lists XHS archives and retries a failed task", async ({ page }) => {
    let attempts = 0;
    await page.route("**/api/v1/tools/media-archive/items**", async (route) => {
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
            platform: "xiaohongshu",
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
    await page.route("**/api/v1/tools/media-archive/tasks/e2e-xhs-task-*", async (route) => {
      const id = route.request().url().includes("e2e-xhs-task-1") ? "e2e-xhs-task-1" : "e2e-xhs-task-2";
      const failed = id.endsWith("-1");
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            id,
            platform: "xiaohongshu",
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
    await expect(page.getByRole("heading", { name: "多媒体内容归档" })).toBeVisible();
    await page.getByPlaceholder(/直接按 Ctrl\+V/).fill("https://www.xiaohongshu.com/explore/e2e");
    await page.getByRole("button", { name: "获取并存档" }).click();
    await expect(page.getByRole("button", { name: "重新尝试" })).toBeVisible();
    await page.getByRole("button", { name: "重新尝试" }).click();
    await expect.poll(() => attempts).toBe(2);
  });

  test("cancels an active archive task and shows the server-confirmed terminal state", async ({ page }) => {
    let cancelRequests = 0;
    await page.route("**/api/v1/tools/media-archive/items**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: { items: [], total: 0, page: 1, pageSize: 12, pageCount: 1 },
            requestId: "e2e-cancel-list"
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
            id: "e2e-cancel-task",
            platform: "xiaohongshu",
            status: "running",
            stage: "downloading",
            progress: 45,
            message: "正在下载媒体",
            createdAt: "2026-10-01T00:00:00.000Z",
            updatedAt: "2026-10-01T00:00:01.000Z"
          },
          requestId: "e2e-cancel-create"
        })
      });
    });
    await page.route("**/api/v1/tasks/e2e-cancel-task/events", async (route) => {
      await route.fulfill({
        contentType: "text/event-stream",
        body: `event: task\ndata: ${JSON.stringify({
          id: "e2e-cancel-task",
          toolId: "media-archive",
          status: "running",
          progress: 45,
          createdAt: "2026-10-01T00:00:00.000Z",
          updatedAt: "2026-10-01T00:00:01.000Z"
        })}\n\n`
      });
    });
    await page.route("**/api/v1/tools/media-archive/tasks/e2e-cancel-task", async (route) => {
      if (route.request().method() === "DELETE") {
        cancelRequests += 1;
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              id: "e2e-cancel-task",
              platform: "xiaohongshu",
              status: "failed",
              stage: "failed",
              progress: 45,
              message: "任务已取消",
              error: "任务已取消",
              errorCode: "ARCHIVE_CANCELLED",
              createdAt: "2026-10-01T00:00:00.000Z",
              updatedAt: "2026-10-01T00:00:02.000Z"
            },
            requestId: "e2e-cancel-result"
          })
        });
        return;
      }
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            id: "e2e-cancel-task",
            platform: "xiaohongshu",
            status: "running",
            stage: "downloading",
            progress: 45,
            message: "正在下载媒体",
            createdAt: "2026-10-01T00:00:00.000Z",
            updatedAt: "2026-10-01T00:00:01.000Z"
          },
          requestId: "e2e-cancel-state"
        })
      });
    });

    await page.goto("/tools/xhs-archive");
    await expect(page.getByRole("heading", { name: "多媒体内容归档" })).toBeVisible();
    await page.getByPlaceholder(/直接按 Ctrl\+V/).fill("https://www.xiaohongshu.com/explore/e2e-cancel");
    await page.getByRole("button", { name: "获取并存档" }).click();
    await page.getByRole("button", { name: "取消获取" }).click();

    await expect(page.getByText("获取任务已取消")).toBeVisible();
    await expect(page.getByRole("button", { name: "重新尝试" })).toBeVisible();
    expect(cancelRequests).toBe(1);
  });
});
