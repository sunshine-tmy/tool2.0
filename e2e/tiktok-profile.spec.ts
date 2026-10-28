import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
test("TikTok profile discovery previews partial lists and requires explicit confirmation before batch archiving", async ({
  page
}) => {
  const base = "/api/v1/tools/media-archive/tiktok-profiles";
  const time = "2026-10-27T00:00:00Z";
  let url: string | undefined,
    submission: { selection: string; existing: string; allowPartial: boolean } | undefined,
    polls = 0;
  const job = () => ({
    id: "profile_browser123",
    username: "shop",
    url: "https://www.tiktok.com/@shop",
    phase: submission ? (++polls > 1 ? "completed" : "archiving") : "ready",
    complete: false,
    discoveredCount: 2,
    declaredCount: 616,
    message: submission ? "正在按每批最多 100 条顺序归档" : "已发现 2 条，列表未确认完整",
    createdAt: time,
    updatedAt: time,
    archivedCount: submission && polls > 1 ? 1 : 0,
    failedCount: 0,
    skippedCount: submission && polls > 1 ? 1 : 0,
    pendingCount: submission && polls <= 1 ? 2 : 0,
    batchCount: submission ? 1 : 0
  });
  const envelope = (data: unknown) => JSON.stringify({ success: true, data, requestId: "tiktok-profile-browser" });
  await page.route(`**${base}`, async (route) => {
    if (route.request().method() === "POST") {
      url = route.request().postDataJSON().url;
      await route.fulfill({ contentType: "application/json", body: envelope(job()) });
    } else await route.fulfill({ contentType: "application/json", body: envelope([]) });
  });
  await page.route(`**${base}/profile_browser123`, (route) =>
    route.fulfill({ contentType: "application/json", body: envelope(job()) })
  );
  await page.route(`**${base}/profile_browser123/works?page=*`, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: envelope({
        items: [
          { id: "12345", url: "https://www.tiktok.com/@shop/video/12345", title: "TikTok 主页商品" },
          { id: "12346", url: "https://www.tiktok.com/@shop/photo/12346", title: "TikTok 图集" }
        ],
        page: 1,
        pageCount: 1,
        total: 2
      })
    })
  );
  await page.route(`**${base}/profile_browser123/archive`, async (route) => {
    submission = route.request().postDataJSON();
    await route.fulfill({ contentType: "application/json", body: envelope(job()) });
  });
  await page.goto("/tools/media-archive");
  await page.getByRole("button", { name: "TikTok 主页批量归档", exact: true }).click();
  await page
    .getByRole("textbox", { name: "TikTok 用户主页链接", exact: true })
    .fill("https://www.tiktok.com/@SHOP?_t=example");
  await page.getByRole("button", { name: "读取主页作品", exact: true }).click();
  await expect.poll(() => url).toBe("https://www.tiktok.com/@shop");
  await expect(page.getByRole("link", { name: "TikTok 主页商品", exact: true })).toBeVisible();
  expect(submission).toBeUndefined();
  const start = page.getByRole("button", { name: "确认并开始主页归档", exact: true });
  await expect(start).toBeDisabled();
  await page.getByText("确认仅归档当前已发现的作品，列表尚未确认完整", { exact: true }).click();
  await expect(start).toBeEnabled();
  await start.click();
  await expect.poll(() => submission).toEqual({ selection: "all", existing: "skip", allowPartial: true });
  await expect(page.getByText(/已归档 1 · 失败 0 · 跳过\/取消 1/)).toBeVisible();
  await expect(page.getByRole("link", { name: "导出作品与结果 CSV", exact: true })).toHaveAttribute(
    "href",
    /profile_browser123\/results\.csv$/
  );
});
test("normal-browser collector exports deduplicated 100-row CSVs accepted by the existing import preview", async ({
  page,
  context
}) => {
  await page.goto("/tools/media-archive");
  await page.getByRole("button", { name: "TikTok 主页批量归档", exact: true }).click();
  await page.getByText("自动窗口仍然出错？使用普通浏览器采集", { exact: true }).click();
  const helperDownloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载普通浏览器采集助手", exact: true }).click();
  const helperDownload = await helperDownloading;
  expect(helperDownload.suggestedFilename()).toBe("TikTok普通浏览器采集助手.html");
  const html = await fs.readFile((await helperDownload.path())!, "utf8");
  const bookmark = html.match(/href="(javascript:[^"]+)"/)?.[1];
  expect(bookmark).toBeDefined();
  const normal = context.newPage();
  const collector = await normal;
  await collector.route("https://www.tiktok.com/@shop", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><body>${Array.from({ length: 201 }, (_, index) => `<a href="https://www.tiktok.com/@shop/video/${123450000 + index}">作品 ${index}</a>`).join("")}<a href="https://www.tiktok.com/@other/video/987654321">其他账号</a></body></html>`
    })
  );
  await collector.goto("https://www.tiktok.com/@shop");
  await collector.evaluate(
    (code) => {
      new Function(code)();
    },
    decodeURIComponent(bookmark!.slice("javascript:".length))
  );
  await collector.getByRole("button", { name: "开始采集", exact: true }).click();
  await collector.getByRole("button", { name: "停止并准备 CSV", exact: true }).click();
  await expect(
    collector.getByText("已按当前发现的作品准备 CSV。已发现 201 条；列表未确认完整。", { exact: true })
  ).toBeVisible();
  await expect(collector.locator("a[download]")).toHaveCount(3);
  const csvDownloading = collector.waitForEvent("download");
  await collector.getByRole("link", { name: "下载第 1 批 CSV（100 条）", exact: true }).click();
  const csvDownload = await csvDownloading;
  const buffer = await fs.readFile((await csvDownload.path())!);
  await collector.close();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "表格批量归档", exact: true }).click();
  const before = (await (await page.request.get("/api/v1/tools/media-archive/import/batches")).json()).data;
  await page
    .getByLabel("选择批量归档表格")
    .setInputFiles({ name: csvDownload.suggestedFilename(), mimeType: "text/csv", buffer });
  await expect(page.getByText("可执行 100 条；无效和表内重复行将跳过", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "确认并开始归档", exact: true })).toBeEnabled();
  const after = (await (await page.request.get("/api/v1/tools/media-archive/import/batches")).json()).data;
  expect(after).toEqual(before);
});
