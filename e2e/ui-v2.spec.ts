import { expect, test } from "@playwright/test";

const tools = [
  ["image-compress", "图片压缩"],
  ["image-ai", "AI 图片处理"],
  ["media-archive", "多媒体内容归档"],
  ["video-subtitle", "视频去字幕"],
  ["edge-tts", "多国语言配音"],
  ["audio-library", "音频素材库"],
  ["audio-extract", "音频提取器"],
  ["audio-convert", "音频格式转换"],
  ["json-format", "JSON 格式化"],
  ["base64", "Base64 编解码"],
  ["url-codec", "URL 编解码"],
  ["uuid-generator", "UUID 生成"],
  ["lan-transfer", "局域网文件传输"]
];

test("all real module entries keep SPA navigation, headings, assets and compatible return paths", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.evaluate(() => Reflect.set(window, "uiV2Identity", "retained"));
  await expect(page.locator(".workbench-card")).toHaveCount(13);
  for (const [path, title] of tools) {
    await page.locator(`.workbench-card[href="/tools/${path}"]`).click();
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(page.locator(".tool-page-icon")).toHaveCount(1);
    expect(
      await page
        .locator(".tool-page-icon")
        .evaluate((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0)
    ).toBe(true);
    expect(await page.evaluate(() => Reflect.get(window, "uiV2Identity"))).toBe("retained");
    await expect(page.locator(".sidebar")).toHaveCount(0);
    await page.getByRole("navigation", { name: "当前位置" }).getByRole("link", { name: "返回首页" }).click();
    await expect(page.locator(".workbench-card")).toHaveCount(13);
  }
  expect(errors).toEqual([]);
});

for (const [width, columns] of [
  [1920, 4],
  [1440, 4],
  [1024, 3],
  [768, 2],
  [375, 1]
]) {
  test(`responsive content frames at ${width}px, measured without screenshots`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await expect(page.locator(".workbench-card")).toHaveCount(13);
    expect(
      await page.locator(".workbench-grid").evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length)
    ).toBe(columns);
    for (const [path] of tools) {
      await page.locator(`.workbench-card[href="/tools/${path}"]`).click();
      await expect(page.locator(".tool-page-header")).toBeVisible();
      const frame = await page.locator(".content").boundingBox();
      expect(frame!.x).toBeGreaterThanOrEqual(0);
      expect(frame!.x + frame!.width).toBeLessThanOrEqual(width + 1);
      expect(await page.locator(".content").evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      if (path === "lan-transfer") {
        for (const selector of [".lan-share-card", ".lan-workspace-tabs", ".lan-file-section"]) {
          const panel = await page.locator(selector).boundingBox();
          expect(panel!.x + panel!.width).toBeLessThanOrEqual(width + 1);
        }
      }
      const icon = await page.locator(".tool-page-icon").boundingBox();
      expect(icon!.width).toBeGreaterThanOrEqual(48);
      if (path === "image-compress") {
        const actions = await page.locator(".tool-page-header").boundingBox();
        const panel = await page.locator(".image-compress-panel").boundingBox();
        expect(actions!.y + actions!.height).toBeLessThanOrEqual(panel!.y);
      }
      await page.getByRole("navigation", { name: "当前位置" }).getByRole("link", { name: "返回首页" }).click();
    }
  });
}

test("desktop home exposes system links and uses the design font", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1024 });
  await page.goto("/");
  await expect(page.locator(".workbench-card")).toHaveCount(13);
  await expect(page.locator(".workbench-footer")).toBeInViewport({ ratio: 1 });
  expect(await page.locator(".workspace").evaluate((el) => getComputedStyle(el).fontFamily)).toContain(
    "Microsoft YaHei"
  );
});

test("module workbenches use the selected layout while retaining their tools", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1024 });
  await page.goto("/tools/audio-convert");
  await expect(page.getByRole("heading", { name: "音频格式转换", exact: true })).toBeVisible();
  const upload = await page.locator(".conversion-upload-section").boundingBox();
  const queue = await page.locator(".conversion-queue-section").boundingBox();
  expect(queue!.x).toBeGreaterThan(upload!.x + upload!.width);
  await expect(page.locator('[aria-label="MP3 码率"]')).toBeVisible();
  await page.goto("/tools/audio-extract");
  await expect(page.getByRole("heading", { name: "音频提取器", exact: true })).toBeVisible();
  const input = await page.locator(".extract-upload-section").boundingBox();
  const options = await page.locator(".extract-configuration").boundingBox();
  expect(options!.x).toBeGreaterThan(input!.x + input!.width);
  await page.goto("/tools/media-archive");
  await expect(page.getByRole("heading", { name: "多媒体内容归档", exact: true })).toBeVisible();
  await expect(page.locator(".fetch-panel").getByRole("group", { name: "批量归档入口" })).toBeVisible();
  await expect(page.locator('[aria-label="链接归档目标分组"]')).toBeVisible();
  await page.goto("/tools/base64");
  await page.getByLabel("编码输入", { exact: true }).fill("图片与视频素材");
  await page.getByRole("button", { name: "开始编码", exact: true }).click();
  await expect(page.locator("#base64-output")).not.toHaveValue("");
  await expect(page.locator(".output-heading").getByRole("button", { name: "复制结果" })).toBeEnabled();
  await page.goto("/tools/video-subtitle");
  await expect(page.getByRole("heading", { name: "视频去字幕", exact: true })).toBeVisible();
  await expect(page.locator(".video-preview-panel").getByRole("button", { name: "上传视频" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "视频处理设置" })).toBeVisible();
});

test("shared provider theme, real local text processing and modal boundary survive navigation", async ({ page }) => {
  await page.goto("/tools/json-format");
  await page.getByLabel("JSON 输入", { exact: true }).fill('{"id":9007199254740993,"name":"商品"}');
  await page.getByRole("button", { name: "格式化", exact: true }).click();
  await expect(page.locator("#json-output")).toHaveValue(/9007199254740993/);
  expect(
    await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--color-primary-600").trim())
  ).toBe("#6558ff");
  await page.getByRole("button", { name: "本地服务与管理员会话", exact: true }).click();
  const header = await page.locator(".topbar").boundingBox();
  const drawer = await page.locator(".n-drawer").boundingBox();
  expect(drawer!.y).toBeGreaterThanOrEqual(header!.y + header!.height - 1);
  expect(await page.locator(".topbar").evaluate((el) => getComputedStyle(el).minHeight)).toBe("64px");
});
