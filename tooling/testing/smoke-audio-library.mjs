// Anchor filesystem and CLI identity at the stable public entry.
const publicEntryUrl = new URL("../../scripts/smoke-audio-library.mjs", import.meta.url).href;

/** 构建后真实浏览器验收：仅使用临时服务和临时音频，不触碰现有 storage。 */
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import net from "node:net";
import { chromium } from "playwright-core";
import { createApp } from "../../apps/api/dist/app.js";
import { getConfig } from "../../apps/api/src/config.ts";

const root = await mkdtemp(path.join(os.tmpdir(), "toolbox-audio-browser-"));
process.env.STORAGE_ROOT = path.join(root, "storage");
process.env.DATABASE_PATH = path.join(root, "storage", "toolbox.db");
process.env.NODE_ENV = "test";
const repoRoot = fileURLToPath(new URL("..", publicEntryUrl));
const desktopExe = process.env.AUDIO_LIBRARY_DESKTOP_EXE;
if (desktopExe)
  assert.ok(
    path.resolve(desktopExe).startsWith(path.join(repoRoot, "apps", "desktop", "out") + path.sep),
    "只允许验收本次生成的桌面包"
  );
const output = path.join(repoRoot, "output/playwright/audio-library", desktopExe ? "windows" : "web");
await mkdir(output, { recursive: true });
const config = getConfig({ dotenvPath: null });
config.runtime.frontendDistRoot = path.join(repoRoot, "apps/web/dist");
const app = await createApp({ config });
let browser, page;
let desktopProcess;
const errors = [];
async function launchDesktop() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  desktopProcess = spawn(desktopExe, [`--remote-debugging-port=${port}`], {
    windowsHide: true,
    stdio: "ignore",
    env: { ...process.env, LOCALAPPDATA: path.join(root, "localappdata") }
  });
  for (let i = 0; i < 150; i++) {
    try {
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  assert.ok(browser, "无法连接生成的桌面应用");
  for (let i = 0; i < 150; i++) {
    page = browser.contexts()[0]?.pages()[0];
    if (page) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(page, "桌面窗口尚未创建");
  await page.waitForFunction(() => location.hostname === "127.0.0.1");
  await page.setViewportSize({ width: 1480, height: 1000 });
  return new URL(page.url()).origin;
}
async function stopDesktop() {
  if (!desktopProcess || desktopProcess.exitCode !== null) return;
  await new Promise((resolve) => {
    const kill = spawn("taskkill", ["/PID", String(desktopProcess.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore"
    });
    kill.on("exit", resolve);
    kill.on("error", resolve);
  });
  desktopProcess = undefined;
}
try {
  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address();
  assert.ok(address && typeof address === "object");
  const origin = desktopExe ? await launchDesktop() : `http://127.0.0.1:${address.port}`;
  if (!desktopExe) {
    browser = await chromium.launch({
      channel: "chrome",
      headless: true,
      args: ["--autoplay-policy=no-user-gesture-required"]
    });
    page = await browser.newPage({ viewport: { width: 1480, height: 1000 } });
  }
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${origin}/tools/audio-library`);
  await page.getByRole("heading", { name: "直播音频库", exact: true }).waitFor();
  await page.getByRole("button", { name: "上传音频", exact: true }).click();
  await page.getByText("支持 MP3、PCM WAV、AAC M4A、FLAC", { exact: false }).waitFor();
  const samples = 80000,
    buffer = Buffer.alloc(44 + samples * 2);
  buffer.write("RIFF");
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(8000, 24);
  buffer.writeUInt32LE(16000, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples * 2, 40);
  await page
    .locator("input[type=file][multiple]")
    .setInputFiles({ name: "直播开场.wav", mimeType: "audio/wav", buffer });
  await page.getByPlaceholder("外语文案（可后补）").fill("Selamat datang ke siaran langsung kami.");
  await page.getByPlaceholder("中文译文（可后补）").fill("欢迎来到我们的直播间。");
  await page.getByRole("button", { name: "上传并入库 / 重试失败项" }).click();
  await page.getByText("已永久保存", { exact: true }).waitFor();
  await page.locator(".library-upload-dialog .n-base-close").click();
  await page.locator(".library-item").waitFor();
  assert.equal(await page.getByRole("button", { name: "收藏", exact: true }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "已收藏", exact: true }).count(), 0);
  assert.equal(await page.locator(".library-item").getByRole("button", { name: "下载", exact: true }).count(), 0);
  assert.equal(await page.locator(".library-item a[href*='/download']").count(), 0);
  assert.match(await page.locator(".library-items").innerText(), /欢迎来到我们的直播间/);
  const queueAudio = page.locator("audio[data-audio-library-queue]");
  const itemAudio = page.locator(".library-item-player audio[data-audio-library-inline]");
  const itemPlayButton = page.locator(".library-item-play");
  assert.equal(await itemAudio.getAttribute("src"), null, "未点击播放时不请求单条音频");
  await itemPlayButton.click();
  await page.waitForFunction(() => {
    const audio = document.querySelector("audio[data-audio-library-inline]");
    return audio && !audio.paused && audio.currentTime > 0;
  });
  assert.equal(await page.locator(".library-player").count(), 0, "列表内播放不能自动创建队列");
  assert.equal(await queueAudio.evaluate((audio) => audio.paused), true);
  await page.locator(".library-item-player").getByRole("button", { name: "停止", exact: true }).click();
  await page.locator(".library-item").getByRole("button", { name: "＋队列", exact: true }).click();
  await page.locator(".library-player").waitFor();
  async function assertInlinePlayer() {
    const layout = await page.evaluate(() => {
      const player = document.querySelector(".library-page .library-player");
      const panel = document.querySelector(".audio-queue-panel");
      const queue = player?.querySelector(".library-queue");
      const bounds = player?.getBoundingClientRect();
      return {
        position: player && getComputedStyle(player).position,
        queuePosition: queue && getComputedStyle(queue).position,
        playerBottom: player?.getBoundingClientRect().bottom,
        panelTop: panel?.getBoundingClientRect().top,
        controlsContained:
          bounds &&
          [
            ...player.querySelectorAll(
              ".library-player-select, .library-player-gap-input, .library-player-volume-slider"
            )
          ].every((control) => {
            const rect = control.getBoundingClientRect();
            return rect.left >= bounds.left && rect.right <= bounds.right;
          })
      };
    });
    assert.equal(layout.position, "relative", "播放器应位于音频库模块正常文档流中");
    if (layout.queuePosition) assert.equal(layout.queuePosition, "static", "展开队列不得悬浮遮挡");
    assert.ok(layout.panelTop >= layout.playerBottom, "播放器及展开队列不得覆盖后续内容");
    assert.ok(layout.controlsContained, "播放设置控件应保持在播放器内部");
  }
  await assertInlinePlayer();
  assert.equal(await page.locator(".library-player-volume-value").innerText(), "100%");
  assert.equal(
    await page.locator(".library-player-controls select, .library-player-controls input[type=range]").count(),
    0
  );
  const volumeSlider = page.getByRole("slider", { name: "音量", exact: true });
  await volumeSlider.press("ArrowLeft");
  assert.equal(await page.locator(".library-player-volume-value").innerText(), "99%");
  await volumeSlider.press("ArrowRight");
  assert.equal(await volumeSlider.getAttribute("aria-valuetext"), "100%");
  const progressSlider = page.getByRole("slider", { name: "播放进度", exact: true });
  await progressSlider.press("ArrowRight");
  assert.equal(await progressSlider.getAttribute("aria-valuenow"), "0.1");
  await progressSlider.press("ArrowLeft");
  await page.setViewportSize({ width: 1024, height: 900 });
  await assertInlinePlayer();
  await page.locator(".library-player").screenshot({ path: path.join(output, "player-tablet.png") });
  await page.setViewportSize({ width: 1480, height: 1000 });
  await page.locator(".library-player").getByRole("button", { name: "队列 1", exact: true }).click();
  await page.locator(".library-queue").waitFor();
  assert.match(await page.locator(".library-queue").innerText(), /中文：欢迎来到我们的直播间/);
  await assertInlinePlayer();
  await page.locator(".library-player").screenshot({ path: path.join(output, "inline-player.png") });
  await page.locator(".library-player").getByRole("button", { name: "队列 1", exact: true }).click();
  await page.locator(".library-player").getByRole("button", { name: "播放", exact: true }).click();
  await page.waitForFunction(() => {
    const audio = document.querySelector("audio[data-audio-library-queue]");
    return audio && !audio.paused && audio.currentTime > 0;
  });
  const queueBefore = await queueAudio.evaluate((audio) => ({ src: audio.currentSrc, time: audio.currentTime }));
  await itemPlayButton.click();
  await page.waitForFunction(() => {
    const queue = document.querySelector("audio[data-audio-library-queue]");
    const item = document.querySelector("audio[data-audio-library-inline]");
    return queue && item && !queue.paused && !item.paused && item.currentTime > 0;
  });
  const queueAfter = await queueAudio.evaluate((audio) => ({ src: audio.currentSrc, time: audio.currentTime }));
  assert.equal(queueAfter.src, queueBefore.src);
  assert.ok(queueAfter.time >= queueBefore.time && queueAfter.time < queueBefore.time + 4, "分组播放不跳转队列进度");
  assert.equal(await page.locator(".audio-queue-entries li").count(), 1);
  const independentProgress = page.locator(".library-item-player").getByRole("slider");
  await independentProgress.press("ArrowRight");
  await page.locator(".library-player").getByRole("button", { name: "暂停", exact: true }).click();
  assert.equal(await itemAudio.evaluate((audio) => audio.paused), false, "暂停队列不暂停分组播放");
  await page.locator(".library-player").getByRole("button", { name: "播放", exact: true }).click();
  assert.equal(await itemAudio.evaluate((audio) => audio.paused), false, "继续队列不暂停分组播放");
  await page.locator(".library-item").screenshot({ path: path.join(output, "independent-item-player.png") });
  // 切换模块隐藏控件但仍播放，返回后可操作；刷新恢复暂停而非自动出声。
  await page.getByRole("link", { name: "图片压缩", exact: true }).first().click();
  await page.getByRole("heading", { name: "图片压缩", exact: true }).waitFor();
  assert.equal(await queueAudio.evaluate((audio) => audio.paused), false);
  assert.equal(await page.locator("audio[data-audio-library-inline]").count(), 0);
  assert.equal(await page.locator(".library-player").count(), 0);
  assert.equal(await page.locator(".library-queue").count(), 0);
  await page.getByRole("link", { name: "直播音频库", exact: true }).first().click();
  await page.locator(".library-player").waitFor();
  await page.locator(".library-player").getByRole("button", { name: "暂停", exact: true }).click();
  const position = await queueAudio.evaluate((audio) => audio.currentTime);
  assert.ok(position > 0);
  await page.reload();
  await page.locator(".library-player").waitFor();
  assert.equal(await queueAudio.evaluate((audio) => audio.paused), true);
  await page.locator(".library-item").waitFor();
  // 预设保存重复项、播放设置；清空后仍可加载，刷新后不丢失。
  await page.locator(".library-item").getByRole("button", { name: "＋队列", exact: true }).click();
  await page.locator(".library-item").getByRole("button", { name: "＋队列", exact: true }).click();
  await page.locator(".library-player-select .n-base-selection").click();
  await page.getByText("列表循环", { exact: true }).last().click();
  await page.locator('.library-player input[aria-label="播放间隔（秒）"]').fill("5");
  await page.getByRole("button", { name: "保存当前队列为预设", exact: true }).click();
  await page.getByPlaceholder("例如：马来语开场 / 晚场促销").fill("直播开场预设");
  await page.getByRole("button", { name: "确认保存", exact: true }).click();
  await page.locator(".audio-preset").waitFor();
  await page.locator(".audio-preset").getByRole("button", { name: "查看内容", exact: true }).click();
  assert.equal(await page.locator(".audio-preset-contents li").count(), 3);
  await page.locator(".audio-queue-panel .n-tabs-tab").filter({ hasText: "当前队列" }).click();
  await page.getByRole("button", { name: "清空当前队列", exact: true }).click();
  await page.getByRole("button", { name: "确认", exact: true }).click();
  await page.locator(".audio-queue-panel .n-tabs-tab").filter({ hasText: "预设队列" }).click();
  await page.locator(".audio-preset").getByRole("button", { name: "加载队列", exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll(".audio-queue-entries li").length === 3);
  assert.equal(await queueAudio.evaluate((audio) => audio.paused), true);
  assert.match(await page.locator(".library-player-select").innerText(), /列表循环/);
  assert.equal(await page.locator('.library-player input[aria-label="播放间隔（秒）"]').inputValue(), "5");
  await page.reload();
  await page.locator(".audio-queue-panel .n-tabs-tab").filter({ hasText: "预设队列" }).click();
  await page.locator(".audio-preset").waitFor();
  assert.equal(await page.locator(".audio-preset strong").innerText(), "直播开场预设");
  await page.getByRole("button", { name: "＋新建", exact: true }).click();
  await page.locator(".library-dialog input").first().fill("开场话术");
  await page.getByRole("button", { name: "保存分组", exact: true }).click();
  await page.getByText("开场话术", { exact: true }).first().waitFor();
  await page.locator(".library-item").getByRole("button", { name: "移动至", exact: true }).click();
  await page.locator(".library-dialog .n-base-selection").click();
  await page.getByText("开场话术", { exact: true }).last().click();
  await page.getByRole("button", { name: "确认移动", exact: true }).click();
  await page.getByRole("button", { name: "撤销移动", exact: true }).waitFor();
  await page.getByRole("button", { name: "撤销移动", exact: true }).click();
  await page.locator(".library-item").getByRole("button", { name: "详情", exact: true }).click();
  await page.getByText("校对文案不会改变已保存的音频", { exact: false }).waitFor();
  await page.locator(".n-drawer .n-base-close").click();
  await page.locator(".library-player").getByRole("button", { name: "停止", exact: true }).click();
  // 中间编辑区裁剪另存，真实浏览器解码 WAV，并验证服务端保存内容与队列隔离。
  const originalRow = page.locator(".library-item").first();
  await originalRow.getByRole("button", { name: "裁剪", exact: true }).click();
  assert.equal(await originalRow.getByRole("textbox", { name: "裁剪开始时间", exact: true }).count(), 0);
  assert.equal(await originalRow.getByRole("textbox", { name: "裁剪结束时间", exact: true }).count(), 0);
  const setBoundary = async (name, seconds) => {
    const handle = originalRow.getByRole("slider", { name, exact: true });
    await handle.waitFor();
    const delta = seconds - Number(await handle.getAttribute("aria-valuenow"));
    for (let i = 0; i < Math.round(Math.abs(delta) / 0.05); i++)
      await handle.press(delta > 0 ? "ArrowRight" : "ArrowLeft");
    assert.ok(Math.abs(Number(await handle.getAttribute("aria-valuenow")) - seconds) < 0.001);
  };
  await setBoundary("裁剪起点", 1);
  await setBoundary("裁剪终点", 3);
  await originalRow.screenshot({ path: path.join(output, "center-clip-editor.png") });
  const savedQueue = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((x) => x.startsWith("toolbox-audio-player:"));
    return key ? JSON.parse(localStorage.getItem(key)).queue : [];
  });
  await page.locator(".library-player").getByRole("button", { name: "播放", exact: true }).click();
  await page.waitForFunction(() => {
    const audio = document.querySelector("audio[data-audio-library-queue]");
    return audio && !audio.paused && audio.currentSrc && audio.currentTime > 0;
  });
  const playingSource = await queueAudio.evaluate((audio) => audio.currentSrc);
  const clipResponse = page.waitForResponse(
    (response) => response.url().endsWith("/clips") && response.request().method() === "POST"
  );
  await originalRow.getByRole("button", { name: "另存裁剪音频", exact: true }).click();
  const clipped = await clipResponse;
  assert.equal(clipped.status(), 200, await clipped.text());
  const clippedItem = (await clipped.json()).data.item;
  assert.ok(Math.abs(clippedItem.duration - 2) < 0.01);
  assert.equal(clippedItem.source.kind, "clip");
  assert.ok(Math.abs(clippedItem.source.startSeconds - 1) < 0.001);
  assert.ok(Math.abs(clippedItem.source.endSeconds - 3) < 0.001);
  await page.waitForFunction(() => document.querySelectorAll(".library-item").length === 2);
  assert.deepEqual(
    await page.evaluate(() => {
      const key = Object.keys(localStorage).find((x) => x.startsWith("toolbox-audio-player:"));
      return key ? JSON.parse(localStorage.getItem(key)).queue : [];
    }),
    savedQueue
  );
  assert.equal(await queueAudio.evaluate((audio) => audio.paused), false, "裁剪保存不暂停正在播放的队列");
  assert.equal(await queueAudio.evaluate((audio) => audio.currentSrc), playingSource);
  await page.locator(".library-player").getByRole("button", { name: "停止", exact: true }).click();
  await page.screenshot({ path: path.join(output, "desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".sidebar[aria-hidden=true]").waitFor({ state: "attached" });
  await page.waitForFunction(() => document.querySelector(".sidebar")?.getBoundingClientRect().right <= 1);
  await page.locator(".library-player").getByRole("button", { name: "队列 3", exact: true }).click();
  await page.locator(".library-queue").waitFor();
  await assertInlinePlayer();
  await page.locator(".library-player").screenshot({ path: path.join(output, "inline-player-mobile.png") });
  await page.locator(".library-item-play").first().click();
  await page.waitForFunction(() => {
    const audio = document.querySelector("audio[data-audio-library-inline]");
    return audio && !audio.paused;
  });
  await page.locator(".library-item").first().getByRole("button", { name: "裁剪", exact: true }).click();
  await page
    .locator(".library-item")
    .first()
    .screenshot({ path: path.join(output, "independent-item-player-mobile.png") });
  await page.screenshot({ path: path.join(output, "mobile.png"), fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert.equal(overflow, false, "移动视口不得横向溢出");
  assert.deepEqual(errors, []);
  if (desktopExe) {
    await browser.close();
    browser = undefined;
    await stopDesktop();
    const nextOrigin = await launchDesktop();
    await page.goto(`${nextOrigin}/tools/audio-library`);
    await page.locator(".library-item").first().waitFor();
    assert.match(await page.locator(".library-items").innerText(), /欢迎来到我们的直播间/);
    assert.equal(await page.locator("audio[data-audio-library-queue]").evaluate((audio) => audio.paused), true);
    await page.locator(".audio-queue-panel .n-tabs-tab").filter({ hasText: "预设队列" }).click();
    await page.locator(".audio-preset").waitFor();
    assert.equal(await page.locator(".audio-preset strong").innerText(), "直播开场预设");
  }
  await writeFile(
    path.join(output, "result.json"),
    JSON.stringify(
      {
        success: true,
        storageRoot: root,
        checks: [
          "本地上传双语音频",
          "条目中间播放裁剪、浏览器真实解码、另存两秒 WAV、原队列不变",
          "无收藏入口和单条下载，保留导出备份",
          "播放与跨路由持续播放",
          "分组内独立播放、队列双向不互相暂停、不改队列进度和顺序、离页停止单条",
          "播放器仅音频库模块可见，正常文档流及展开队列不遮挡，窄屏不溢出",
          "刷新不自动播放",
          "预设队列保存、加载、重复项与设置、刷新和重启保留",
          "分组新建和移动撤销",
          "详情与移动端布局"
        ],
        errors
      },
      null,
      2
    )
  );
  console.log(`Audio library browser smoke passed: ${output}`);
} catch (error) {
  if (page) {
    console.error("Browser errors:", errors);
    console.error((await page.locator("body").innerText()).slice(0, 3500));
    await page.screenshot({ path: path.join(output, "failure.png"), fullPage: true });
  }
  throw error;
} finally {
  await browser?.close();
  await stopDesktop();
  await app.close();
}
