/** R08 real-browser regression: route ownership and KeepAlive, never inference or capability installation. */
import { expect, test } from "@playwright/test";

test("R08 lazy feature entries keep SPA navigation and legacy archive URLs", async ({ page }) => {
  const errors: string[] = [];
  const submissions: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      /\/api\/v1\/(?:components\/[^/]+\/(?:install|reinstall)|tools\/(?:image-ai\/(?:tasks|compose)|(?:chatterbox|edge-tts)\/(?:tasks|batches)))$/.test(
        new URL(request.url()).pathname
      )
    )
      submissions.push(request.url());
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "今天要处理什么？" })).toBeVisible();
  await page.evaluate(() => Object.assign(window, { r08NavigationIdentity: "same-app" }));
  for (const [path, heading] of [
    ["/tools/image-compress", "图片压缩"],
    ["/tools/image-ai", "AI 图片处理"],
    ["/tools/edge-tts", "多国语言配音"],
    ["/tools/audio-library", "直播音频库"],
    ["/tools/media-archive", "多媒体内容归档"],
    ["/tools/lan-transfer", "局域网文件传输"]
  ]) {
    await page.locator(`.sidebar a[href="${path}"]`).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    expect(await page.evaluate(() => Reflect.get(window, "r08NavigationIdentity"))).toBe("same-app");
  }
  await page.getByRole("button", { name: "桌面设置", exact: true }).click();
  await expect(page.getByRole("heading", { name: "桌面设置与数据迁移" })).toBeVisible();
  await expect(page.getByText("此页面仅在桌面应用中提供。", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "打开诊断", exact: true }).click();
  await expect(page.getByRole("heading", { name: "启动与环境诊断", exact: true })).toBeVisible();
  await page.goto("/tools/xhs-archive?item=r08#media");
  await expect(page).toHaveURL(/\/tools\/media-archive\?item=r08#media$/);
  await expect(page.getByRole("heading", { name: "多媒体内容归档" })).toBeVisible();
  expect(errors).toEqual([]);
  expect(submissions).toEqual([]);
});

test("R08 real speech engine switches preserve independent unsubmitted drafts", async ({ page }) => {
  await page.goto("/tools/edge-tts");
  const cloneTab = page.getByRole("tab", { name: /参考音色克隆/ });
  const onlineTab = page.getByRole("tab", { name: /在线自然音色/ });
  const clone = page.locator(".chatterbox-workbench");
  await clone.getByPlaceholder("批次名称（可选）").fill("R08 克隆草稿");
  await onlineTab.click();
  const online = page.locator(".online-tts-panel");
  await online.getByPlaceholder("批次名称（可选）").fill("R08 在线草稿");
  await cloneTab.click();
  await expect(clone.getByPlaceholder("批次名称（可选）")).toHaveValue("R08 克隆草稿");
  await onlineTab.click();
  await expect(online.getByPlaceholder("批次名称（可选）")).toHaveValue("R08 在线草稿");
});
