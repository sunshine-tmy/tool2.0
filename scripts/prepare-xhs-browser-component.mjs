/** 中文模块说明：使用当前锁定 Playwright 版本准备可选的小红书扫码登录 Chromium。 */
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLAYWRIGHT_VERSION = "1.63.0";
const CHROMIUM_REVISION = "1243";
const CHROMIUM_VERSION = "153.0.8010.12";
const ARCHIVE_NAME = "chrome-for-testing-153.0.8010.12-win64.zip";
const ARCHIVE_BYTES = 205_123_748;
const ARCHIVE_SHA256 = "415968b02065d4a9e2c10b85f0ae9f489b8fba500e94d9d0a7b7c4852a7234c1";

export async function prepareXhsBrowserComponent({ archivePath, stagingDirectory }) {
  const stage = path.resolve(stagingDirectory);
  if (process.platform !== "win32" || process.arch !== "x64") {
    throw new Error("小红书登录浏览器能力仅支持 Windows x64 产物");
  }
  await verifyPinnedArchive(path.resolve(archivePath));
  if (await pathExists(stage)) throw new Error("小红书浏览器暂存目录已存在，拒绝覆盖");
  const browserPackageRoot = path.join(REPOSITORY_ROOT, "backend", "node_modules", "playwright-core");
  const packageJson = JSON.parse(await fs.readFile(path.join(browserPackageRoot, "package.json"), "utf8"));
  const browsers = JSON.parse(await fs.readFile(path.join(browserPackageRoot, "browsers.json"), "utf8"));
  const chromium = browsers.browsers?.find((item) => item.name === "chromium");
  if (
    packageJson.version !== PLAYWRIGHT_VERSION ||
    chromium?.revision !== CHROMIUM_REVISION ||
    chromium?.browserVersion !== CHROMIUM_VERSION
  ) {
    throw new Error("Playwright/Chromium 版本与签名能力定义不匹配，请先更新固定版本定义");
  }

  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-xhs-chromium-"));
  const extraction = path.join(temporary, "extracted");
  try {
    await fs.mkdir(extraction);
    execFileSync("tar", ["-xf", path.resolve(archivePath), "-C", extraction], {
      stdio: "ignore",
      windowsHide: true,
      timeout: 10 * 60 * 1000
    });
    const browserSource = path.join(extraction, "chrome-win64");
    await assertNoLinks(browserSource);
    const browserVersion = execFileSync(
      path.join(browserSource, "chrome.exe"),
      ["--no-sandbox", "--headless", "--disable-gpu", "--dump-dom", "about:blank"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        timeout: 30_000,
        env: cleanEnvironment()
      }
    );
    if (!browserVersion.includes("<html")) throw new Error("下载的 Chromium headless 自检失败");
    const target = path.join(stage, "browser");
    await fs.mkdir(target, { recursive: true });
    await fs.cp(browserSource, target, { recursive: true });
    const executable = path.join(target, "chrome.exe");
    const output = execFileSync(
      executable,
      ["--no-sandbox", "--headless", "--disable-gpu", "--dump-dom", "about:blank"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        timeout: 30_000,
        env: cleanEnvironment()
      }
    );
    if (!output.includes("<html")) throw new Error("打包 Chromium headless 自检未返回 HTML");
    const browserBytes = await directoryBytes(target);
    return { stagingDirectory: stage, chromiumVersion: CHROMIUM_VERSION, browserBytes };
  } catch (error) {
    await fs.rm(stage, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  } finally {
    await fs.rm(temporary, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function verifyPinnedArchive(archive) {
  const stat = await fs.stat(archive);
  if (!stat.isFile() || path.basename(archive) !== ARCHIVE_NAME || stat.size !== ARCHIVE_BYTES) {
    throw new Error("Playwright Chromium 固定归档大小或文件名不匹配");
  }
  const digest = crypto.createHash("sha256");
  for await (const chunk of createReadStream(archive)) digest.update(chunk);
  if (digest.digest("hex") !== ARCHIVE_SHA256) throw new Error("Playwright Chromium 固定归档 SHA-256 校验失败");
  const entries = execFileSync("tar", ["-tf", archive], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    timeout: 60_000
  })
    .split(/\r?\n/)
    .filter(Boolean);
  if (!entries.length) throw new Error("Playwright Chromium 固定归档为空");
  for (const entry of entries) {
    const normalized = entry.replaceAll("\\", "/").replace(/\/$/, "");
    const segments = normalized.split("/");
    if (
      !normalized ||
      path.posix.isAbsolute(normalized) ||
      segments[0] !== "chrome-win64" ||
      segments.some((segment) => !segment || segment === "." || segment === ".." || segment.includes(":"))
    ) {
      throw new Error("Playwright Chromium 固定归档路径无效：" + entry);
    }
  }
}

async function assertNoLinks(root) {
  const pending = [root];
  while (pending.length) {
    const current = pending.pop();
    if (!current) continue;
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      const stat = await fs.lstat(fullPath);
      if (stat.isSymbolicLink()) throw new Error("Playwright 浏览器目录不允许包含符号链接");
      if (stat.isDirectory()) pending.push(fullPath);
      else if (!stat.isFile()) throw new Error("Playwright 浏览器目录包含特殊文件");
    }
  }
}

async function directoryBytes(root) {
  let bytes = 0;
  const pending = [root];
  while (pending.length) {
    const current = pending.pop();
    if (!current) continue;
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(fullPath);
      else bytes += (await fs.stat(fullPath)).size;
    }
  }
  return bytes;
}

function cleanEnvironment() {
  const environment = { ...process.env };
  for (const key of ["PLAYWRIGHT_BROWSERS_PATH", "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD"]) delete environment[key];
  return environment;
}

function pathExists(candidate) {
  return fs.lstat(candidate).then(
    () => true,
    (error) => {
      if (error?.code === "ENOENT") return false;
      throw error;
    }
  );
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value || values.has(key.slice(2))) throw new Error("命令行参数无效");
  }
  for (let index = 0; index < argv.length; index += 2) values.set(argv[index].slice(2), argv[index + 1]);
  if (values.size !== 2 || !values.has("archive") || !values.has("stage")) {
    throw new Error("用法：pnpm components:prepare-xhs-browser -- --archive <固定 Chromium zip> --stage <新暂存目录>");
  }
  return { archivePath: values.get("archive"), stagingDirectory: values.get("stage") };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await prepareXhsBrowserComponent(parseArguments(process.argv.slice(2)));
    console.log("小红书登录浏览器暂存目录已准备：" + result.stagingDirectory);
    console.log("固定 Chromium：" + result.chromiumVersion + "；资产大小：" + result.browserBytes + " bytes");
  } catch (error) {
    console.error(error instanceof Error ? error.message : "小红书登录浏览器能力准备失败");
    process.exitCode = 1;
  }
}
