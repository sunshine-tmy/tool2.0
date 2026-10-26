import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";

test("spreadsheet archive preview requires confirmation and retains per-row progress/results", async ({ page }) => {
  const root = "/api/v1/tools/media-archive/import";
  const time = "2026-10-26T00:00:00Z";
  let submitted:
    | {
        rows: Array<{ rowNumber: number; inputUrl: string; inputPlatform: string }>;
        existing: string;
        groupId?: string;
      }
    | undefined;
  const groupResponse = await page.request.post("/api/v1/tools/media-archive/groups", {
    data: { name: "浏览器批次目标" }
  });
  expect(groupResponse.ok()).toBe(true);
  const group = (await groupResponse.json()).data as { id: string };
  const batch = (completed: boolean) => ({
    id: "batch_browser_123",
    sourceName: "作品.csv",
    existing: "skip",
    status: completed ? "completed" : "running",
    createdAt: time,
    updatedAt: time,
    rows: submitted!.rows.map((row, index) => ({
      ...row,
      status: index === 1 ? "duplicate" : index === 2 ? "invalid" : completed ? "completed" : "waiting",
      progress: completed && index === 0 ? 100 : 0,
      message: index === 1 ? "表内重复" : index === 2 ? "无效链接" : completed ? "归档完成" : "等待获取",
      ...(index === 0 && completed ? { archiveId: "saved_browser_123" } : {})
    }))
  });
  const envelope = (data: unknown) => JSON.stringify({ success: true, data, requestId: "archive-import-browser" });
  await page.route(`**${root}/batches`, async (route) => {
    if (route.request().method() === "POST") {
      submitted = route.request().postDataJSON();
      await route.fulfill({ status: 202, contentType: "application/json", body: envelope(batch(false)) });
    } else await route.fulfill({ contentType: "application/json", body: envelope([]) });
  });
  await page.route(`**${root}/batches/batch_browser_123`, (route) =>
    route.fulfill({ contentType: "application/json", body: envelope(batch(true)) })
  );
  await page.goto("/tools/media-archive");
  await page.getByRole("button", { name: "表格批量归档", exact: true }).click();
  const downloading = page.waitForEvent("download");
  await page.getByRole("link", { name: "下载 Excel 模板", exact: true }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("多媒体批量归档空白模板.xlsx");
  const template = await fs.readFile((await download.path())!);
  expect(template.subarray(0, 2).toString()).toBe("PK");
  expect(template.length).toBeGreaterThan(1000);
  await page.getByLabel("选择批量归档表格").setInputFiles({
    name: "作品.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "\uFEFF作品链接,平台\r\nhttps://www.tiktok.com/@shop/video/123456789,tiktok\r\nhttps://www.tiktok.com/@shop/video/123456789?tracking=1,\r\nnot-a-link,"
    )
  });
  await expect(page.getByText("可执行 1 条；无效和表内重复行将跳过", { exact: true })).toBeVisible();
  expect(submitted).toBeUndefined();
  await expect(page.getByRole("cell", { name: "表内重复", exact: true })).toBeVisible();
  await page.getByLabel("导入目标分组", { exact: true }).click();
  await page
    .locator(".n-base-select-option")
    .filter({ hasText: /^浏览器批次目标$/ })
    .click();
  await page.getByRole("button", { name: "确认并开始归档", exact: true }).click();
  await expect.poll(() => submitted?.existing).toBe("skip");
  expect(submitted?.groupId).toBe(group.id);
  expect(submitted?.rows.map((row) => row.rowNumber)).toEqual([2, 3, 4]);
  expect(submitted?.rows[0]).not.toHaveProperty("status");
  await expect(page.getByText(/成功 1 · 失败 0/)).toBeVisible();
  await expect(page.getByRole("link", { name: "导出结果 CSV" })).toHaveAttribute(
    "href",
    /batch_browser_123\/results\.csv$/
  );
  await expect(page.getByRole("button", { name: "查看存档", exact: true })).toBeVisible();
  await page.request.delete(`/api/v1/tools/media-archive/groups/${group.id}`);
});

test("custom archive groups can be created, renamed, filtered and deleted without deleting works", async ({ page }) => {
  await page.goto("/tools/media-archive");
  await page.getByRole("button", { name: "新建分组", exact: true }).click();
  await page.getByLabel("分组名称", { exact: true }).fill("浏览器素材组");
  await page.getByRole("button", { name: "保存分组", exact: true }).click();
  await expect(page.getByLabel("归档分组筛选", { exact: true })).toContainText("浏览器素材组");
  await page.getByRole("button", { name: "重命名分组", exact: true }).click();
  await page.getByLabel("分组名称", { exact: true }).fill("浏览器素材已整理");
  await page.getByRole("button", { name: "保存分组", exact: true }).click();
  await expect(page.getByLabel("归档分组筛选", { exact: true })).toContainText("浏览器素材已整理");
  await page.getByRole("button", { name: "删除分组", exact: true }).click();
  await expect(page.getByText(/作品、媒体、翻译和截帧均保留/)).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "删除分组", exact: true }).click();
  await expect(page.getByLabel("归档分组筛选", { exact: true })).toContainText("全部分组");
});
