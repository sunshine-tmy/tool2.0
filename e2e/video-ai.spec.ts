/** Real renderer workflow with explicit HTTP fixtures; no models, user files or capability changes. */
import { expect, test } from "@playwright/test";
import type { VideoAiTask } from "../packages/shared/src/video/video-ai";

test("sequence repair keeps phases, cancellation, completed history, download and confirmed deletion distinct", async ({
  page
}) => {
  const root = "/api/v1/tools/video-ai";
  const id = "sequence_browser_01";
  let task: VideoAiTask | undefined;
  let attempts = 0;
  let deleted = false;
  const json = (data: unknown) => JSON.stringify({ success: true, data, requestId: "sequence-browser" });
  const baseTask = (): VideoAiTask => ({
    id,
    mode: "extreme",
    status: "running",
    phase: "estimating-flow",
    progress: 12,
    processedFrames: 12,
    totalFrames: 100,
    queuePosition: null,
    inputName: "synthetic.mp4",
    inputBytes: 5,
    segments: [],
    warnings: [],
    output: null,
    createdAt: "2026-11-06T00:00:00Z",
    updatedAt: "2026-11-06T00:00:00Z",
    expiresAt: null
  });
  await page.route(`**${root}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (path === `${root}/health`)
      return route.fulfill({
        contentType: "application/json",
        body: json({
          protocolVersion: 1,
          available: true,
          device: "cuda",
          vramTotalMb: 8192,
          engines: ["delogo", "fast", "balanced", "extreme"].map((provider) => ({
            provider,
            available: true,
            reason: null,
            license: "test fixture"
          }))
        })
      });
    if (path === `${root}/history`)
      return route.fulfill({
        contentType: "application/json",
        body: json({ items: task && !deleted ? [task] : [], total: task && !deleted ? 1 : 0, page: 1, pageSize: 20 })
      });
    if (path === `${root}/tasks` && method === "POST") {
      attempts++;
      task = baseTask();
      if (attempts === 2)
        task = {
          ...task,
          status: "completed",
          phase: "done",
          progress: 100,
          processedFrames: 100,
          output: { width: 64, height: 48, bytes: 15, durationMs: 1000, downloadUrl: `${root}/tasks/${id}/output` }
        };
      return route.fulfill({ status: 202, contentType: "application/json", body: json(task) });
    }
    if (path === `${root}/tasks/${id}/cancel` && task) {
      task = { ...task, status: "canceled", phase: "canceled" };
      return route.fulfill({ contentType: "application/json", body: json(task) });
    }
    if (path === `${root}/tasks/${id}/output`)
      return route.fulfill({ contentType: "video/mp4", body: "synthetic-output" });
    if (path === `${root}/tasks/${id}` && method === "DELETE") {
      deleted = true;
      return route.fulfill({ contentType: "application/json", body: json({ id, deleted: true }) });
    }
    if (path === `${root}/tasks/${id}`) return route.fulfill({ contentType: "application/json", body: json(task) });
    throw new Error(`Unexpected video fixture request: ${method} ${path}`);
  });
  await page.route(`**/api/v1/tasks/${id}/events`, (route) =>
    route.fulfill({ contentType: "text/event-stream", body: ": fixture\n\n" })
  );
  await page.goto("/tools/video-subtitle");
  await expect(page.getByRole("heading", { name: "视频去字幕", exact: true })).toBeVisible();
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "synthetic.mp4", mimeType: "video/mp4", buffer: Buffer.from("video") });
  await page.getByText("极致", { exact: true }).click();
  await page.getByRole("button", { name: "开始处理", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("估计连续帧光流");
  await expect(page.getByRole("link", { name: "下载结果", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "取消任务", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已取消");
  await page.getByRole("button", { name: "开始处理", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已完成");
  await expect(page.locator(".output-preview")).toHaveAttribute("src", `${root}/tasks/${id}/output?preview=1`);
  await expect(page.getByRole("heading", { name: "处理记录 · 共 1 条", exact: true })).toBeVisible();
  const output = await page.evaluate(async (url) => {
    const response = await fetch(url);
    return { status: response.status, type: response.headers.get("content-type"), body: await response.text() };
  }, `${root}/tasks/${id}/output`);
  expect(output).toEqual({ status: 200, type: "video/mp4", body: "synthetic-output" });
  await page.getByRole("button", { name: "删除", exact: true }).click();
  await expect(page.getByText("删除视频处理结果", { exact: true })).toBeVisible();
  expect(deleted).toBe(false);
  await page.getByRole("button", { name: "确认", exact: true }).click();
  await expect(page.getByText("暂无处理记录", { exact: true })).toBeVisible();
  expect(deleted).toBe(true);
});
