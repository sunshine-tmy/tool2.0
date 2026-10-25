import { expect, test } from "@playwright/test";

test("TikTok public link submission and platform filtering work without a Douyin capability", async ({ page }) => {
  const time = "2026-10-25T00:00:00.000Z";
  const id = "tiktok_e2e_archive";
  const taskId = "tiktok_e2e_task";
  let submitted = false;
  let payload: unknown;
  const filters: string[] = [];
  const item = {
    id,
    platform: "tiktok",
    contentId: "7700596613189963029",
    title: "TikTok 商品归档",
    sourceUrl: "https://vt.tiktok.com/ZSgQrEYNG/",
    canonicalUrl: "https://www.tiktok.com/@shop/video/7700596613189963029",
    type: "video",
    topics: [],
    fetchedAt: time,
    updatedAt: time,
    status: "ready",
    warnings: [],
    totalBytes: 1024,
    mediaCount: 2
  };
  const task = {
    id: taskId,
    platform: "tiktok",
    archiveId: id,
    status: "completed",
    stage: "completed",
    progress: 100,
    message: "TikTok 已获取并归档",
    createdAt: time,
    updatedAt: time
  };
  const envelope = (data: unknown) => JSON.stringify({ success: true, data, requestId: "tiktok-e2e" });
  await page.route("**/api/v1/tools/media-archive/items**", async (route) => {
    if (route.request().method() === "POST") {
      payload = route.request().postDataJSON();
      submitted = true;
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: envelope({ ...task, archiveId: undefined, status: "pending", stage: "parsing", progress: 0 })
      });
      return;
    }
    const target = new URL(route.request().url());
    if (target.pathname.endsWith(`/items/${id}`)) {
      const { mediaCount: _mediaCount, ...detail } = item;
      await route.fulfill({ contentType: "application/json", body: envelope({ ...detail, media: [] }) });
      return;
    }
    filters.push(target.searchParams.get("platform") ?? "all");
    await route.fulfill({
      contentType: "application/json",
      body: envelope({ items: submitted ? [item] : [], total: submitted ? 1 : 0, page: 1, pageSize: 12, pageCount: 1 })
    });
  });
  await page.route(`**/api/v1/tools/media-archive/tasks/${taskId}`, (route) =>
    route.fulfill({ contentType: "application/json", body: envelope(task) })
  );
  await page.route(`**/api/v1/tasks/${taskId}/events`, (route) =>
    route.fulfill({
      contentType: "text/event-stream",
      body: `event: task\ndata: ${JSON.stringify({ id: taskId, toolId: "media-archive", status: "completed", progress: 100, createdAt: time, updatedAt: time })}\n\n`
    })
  );
  await page.goto("/tools/media-archive");
  await page.getByPlaceholder(/直接按 Ctrl\+V/).fill("https://vt.tiktok.com/ZSgQrEYNG/");
  await expect(page.getByText(/已识别：TikTok/)).toBeVisible();
  await expect(page.getByRole("button", { name: "获取并存档" })).toBeEnabled();
  await page.getByRole("button", { name: "获取并存档" }).click();
  await expect.poll(() => payload).toEqual({ url: "https://vt.tiktok.com/ZSgQrEYNG/", platform: "tiktok" });
  await expect(page.getByText("TikTok 已获取并归档", { exact: true })).toBeVisible();
  await expect(page.locator("article").getByText("TikTok 商品归档", { exact: true })).toBeVisible();
  await page.getByLabel("归档平台筛选").click();
  await page
    .locator(".n-base-select-option")
    .filter({ hasText: /^TikTok$/ })
    .click();
  await expect.poll(() => filters).toContain("tiktok");
});
