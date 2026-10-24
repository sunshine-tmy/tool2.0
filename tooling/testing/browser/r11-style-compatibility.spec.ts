/** Two-pass local acceptance: capture only from the frozen pre-R11 CSS; compare never writes baselines. */
import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { image, installStyleFixtures, longName } from "./r11-fixtures";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const capture = process.env.R11_STYLE_MODE === "capture";
const directory = process.env.R11_STYLE_BASELINE;
if (!directory || !path.isAbsolute(directory))
  throw new Error("R11_STYLE_BASELINE must name an absolute local evidence directory");
const baseline = directory;

test.beforeAll(async ({ browser }) => {
  if (capture) {
    const contracts = JSON.parse(
      await fs.readFile(path.join(root, "docs/refactoring/r11-style-contracts.json"), "utf8")
    );
    for (const entry of contracts.entries)
      expect(
        createHash("sha256")
          .update(await fs.readFile(path.join(root, entry.file)))
          .digest("hex"),
        "Capture is allowed only before stylesheet migration"
      ).toBe(entry.sourceSha256);
    await fs.mkdir(baseline, { recursive: true });
    await fs.writeFile(
      path.join(baseline, "metadata.json"),
      JSON.stringify(
        { browser: browser.version(), platform: process.platform, sourceContracts: contracts, tolerance: 0 },
        null,
        2
      ),
      { flag: "wx" }
    );
  } else {
    const metadata = JSON.parse(await fs.readFile(path.join(baseline, "metadata.json"), "utf8"));
    expect(browser.version(), "Use the same browser as the frozen local baseline").toBe(metadata.browser);
    expect(process.platform).toBe(metadata.platform);
  }
});

for (const width of [1920, 1440, 1024, 768, 375])
  test(`R11 cascade at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
    page.setDefaultTimeout(10000);
    const writes = await installStyleFixtures(page);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("dialog", (dialog) => dialog.accept());
    const position = async (anchor?: string) => {
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        document.querySelector<HTMLElement>(".content")?.scrollTo(0, 0);
      });
      if (anchor)
        await page
          .locator(anchor)
          .evaluate((node) => node.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }));
      await page.evaluate(
        () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      );
    };
    const shot = async (name: string, anchor?: string, keepPosition = false) => {
      await page.mouse.move(0, 0);
      await page.waitForLoadState("networkidle");
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map((image) => image.decode().catch(() => undefined)));
      });
      if (!keepPosition) await position(anchor);
      await page.evaluate(async () => {
        await Promise.all(
          document
            .getAnimations()
            .filter(
              (animation) =>
                Number.isFinite(animation.effect?.getComputedTiming().endTime) && animation.playState === "running"
            )
            .map((animation) => animation.finished.catch(() => undefined))
        );
      });
      const screenshot = () => page.screenshot({ animations: "disabled", caret: "hide", scale: "css" });
      let current = await screenshot();
      let stable = false;
      for (let attempt = 0; attempt < 20; attempt++) {
        await page.waitForTimeout(100);
        const next = await screenshot();
        if (next.equals(current)) {
          stable = true;
          break;
        }
        current = next;
      }
      expect(stable, `Scene did not reach identical consecutive screenshots: ${width}-${name}`).toBe(true);
      const filename = path.join(baseline, `${width}-${name}.png`);
      if (capture) await fs.writeFile(filename, current, { flag: "wx" });
      else if (!current.equals(await fs.readFile(filename))) {
        await fs.writeFile(test.info().outputPath(`${name}-actual.png`), current);
        throw new Error(`Exact screenshot mismatch: ${width}-${name}; baseline was not changed`);
      }
    };
    const open = async (url: string, heading: string) => {
      await page.goto(url);
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
      await expect(page.locator(".topbar-status")).not.toHaveClass(/is-loading/);
    };

    await open("/", "今天要处理什么？");
    await shot("home");
    await page.locator(".sidebar-toggle").click();
    await shot(width <= 900 ? "mobile-drawer" : "collapsed-navigation");
    await page
      .locator(width <= 900 ? ".sidebar-head-actions button[aria-label='关闭工具菜单']" : ".sidebar-toggle")
      .click();
    await open("/tools/image-compress", "图片压缩");
    await page
      .locator(".image-compress-dropzone input")
      .setInputFiles({ name: longName, mimeType: "image/png", buffer: image });
    await expect(page.locator(".image-result-row")).toHaveCount(1);
    await shot("image-compress-long-name");

    await open("/tools/image-ai", "AI 图片处理");
    await expect(page.getByText("推理服务可用", { exact: true })).toBeVisible();
    await shot("watermark");
    await page
      .locator(".image-ai-workspace .n-tabs-tab")
      .filter({ hasText: /^变清晰$/ })
      .click();
    await page
      .locator(".image-ai-dropzone")
      .filter({ hasText: "添加低清图片" })
      .locator("input")
      .setInputFiles({ name: longName, mimeType: "image/png", buffer: image });
    await shot("enhance-upload");
    await page
      .locator(".image-ai-workspace .n-tabs-tab")
      .filter({ hasText: /^抠图$/ })
      .click();
    await page
      .locator(".image-ai-dropzone")
      .filter({ hasText: "添加商品图片" })
      .locator("input")
      .setInputFiles({ name: longName, mimeType: "image/png", buffer: image });
    await shot("cutout-upload");
    await page
      .locator(".image-ai-workspace .n-tabs-tab")
      .filter({ hasText: /^处理记录$/ })
      .click();
    await expect(page.locator(".history-item")).toHaveCount(1);
    await page.locator(".history-selection .n-checkbox").click();
    await expect(page.locator(".history-selection .n-checkbox")).toHaveClass(/n-checkbox--checked/);
    await shot("image-history-selection");
    await page.getByRole("button", { name: "查看详情", exact: true }).click();
    await expect(page.getByRole("button", { name: "编辑商品图", exact: true })).toBeVisible();
    await shot("image-history-detail");
    await page.getByRole("button", { name: "编辑商品图", exact: true }).click();
    await expect(page.getByRole("button", { name: "保存并留档", exact: true })).toBeEnabled();
    await shot("product-editor", ".product-toolbar");
    await page.getByRole("button", { name: "自定义检查底色（不导出）", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "HEX", exact: true })).toBeVisible();
    await shot("product-check-color-popover", undefined, true);
    await page.keyboard.press("Escape");
    await page.locator(".product-settings fieldset").nth(1).locator(".n-select").click();
    await page.getByText("自定义图片", { exact: true }).click();
    await page.locator(".product-settings fieldset").nth(1).locator("legend").click();
    await expect(page.locator(".n-base-select-menu:visible")).toHaveCount(0);
    await page
      .locator("input[aria-label='选择本机背景图']")
      .setInputFiles({ name: longName, mimeType: "image/png", buffer: image });
    await expect(page.locator(".product-background-thumbnail")).toBeVisible();
    await page.locator(".product-settings fieldset").nth(1).locator("legend").click();
    await expect(page.locator(".n-base-select-menu:visible")).toHaveCount(0);
    await shot("product-background-long-name", ".product-background-field");

    await open("/tools/edge-tts", "多国语言配音");
    await page.locator(".chatterbox-workbench").getByPlaceholder("批次名称（可选）").fill("R11 克隆草稿");
    await shot("speech-clone");
    await page.getByRole("tab", { name: /在线自然音色/ }).click();
    await shot("speech-online");
    for (const [url, heading, name] of [
      ["/tools/audio-library", "直播音频库", "audio-library"],
      ["/tools/media-archive", "多媒体内容归档", "content-archive"],
      ["/tools/lan-transfer", "局域网文件传输", "lan-transfer"],
      ["/settings", "桌面设置与数据迁移", "desktop-settings"]
    ]) {
      await open(url, heading);
      await shot(name);
    }
    await expect(page.locator("#capability-image-ai")).toBeVisible();
    await shot("desktop-capability-card", "#capability-image-ai");
    await open("/settings/diagnostics", "启动与环境诊断");
    await shot("diagnostics");
    expect(writes).toEqual([]);
    expect(errors).toEqual([]);
  });
