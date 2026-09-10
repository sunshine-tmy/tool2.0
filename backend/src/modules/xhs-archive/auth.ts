import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import { nanoid } from "nanoid";
import type { XhsAuthSession } from "@toolbox/shared";
import type { AppConfig } from "../../config";

type StoredCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: string;
};
const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

export class XhsAuthManager {
  private sessions = new Map<string, XhsAuthSession>();

  constructor(private readonly config: AppConfig) {}

  async isAuthenticated() {
    return Boolean((await this.cookieHeader()).trim());
  }

  async cookieHeader() {
    const cookies = await fsp
      .readFile(this.cookiePath(), "utf8")
      .then((value) => JSON.parse(value) as StoredCookie[])
      .catch(() => []);
    return cookies
      .filter(
        (cookie) => cookie.domain.endsWith("xiaohongshu.com") && (!cookie.expires || cookie.expires * 1000 > Date.now())
      )
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");
  }

  start() {
    const now = new Date().toISOString();
    const session: XhsAuthSession = {
      id: nanoid(12),
      status: "pending",
      message: "正在准备登录窗口",
      createdAt: now,
      updatedAt: now
    };
    this.sessions.set(session.id, session);
    void this.run(session.id);
    return { ...session };
  }

  get(id: string) {
    const session = this.sessions.get(id);
    return session ? { ...session } : undefined;
  }

  private async run(id: string) {
    try {
      process.env.PLAYWRIGHT_BROWSERS_PATH = this.browserDir();
      const { chromium } = await import("playwright-core");
      const executablePath = await this.ensureBrowser(id, chromium.executablePath());
      await fsp.mkdir(this.profileDir(), { recursive: true });
      this.update(id, "waiting", "请在打开的浏览器中扫码登录小红书");
      const context = await chromium.launchPersistentContext(this.profileDir(), { headless: false, executablePath });
      const page = context.pages()[0] ?? (await context.newPage());
      await page.goto("https://www.xiaohongshu.com/", { waitUntil: "domcontentloaded", timeout: 60_000 });
      const deadline = Date.now() + 10 * 60 * 1000;
      while (Date.now() < deadline) {
        const cookies = await context.cookies("https://www.xiaohongshu.com/");
        if (cookies.some((cookie) => cookie.name === "web_session" && cookie.value)) {
          await fsp.writeFile(this.cookiePath(), JSON.stringify(cookies), { encoding: "utf8", mode: 0o600 });
          await context.close();
          this.update(id, "completed", "登录成功，将自动重试获取");
          return;
        }
        if (context.pages().length === 0) throw new Error("登录窗口已关闭");
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      await context.close();
      throw new Error("登录等待超时，请重新发起登录");
    } catch (error) {
      const message = error instanceof Error ? error.message : "登录失败";
      const session = this.sessions.get(id);
      if (session)
        this.sessions.set(id, {
          ...session,
          status: "failed",
          message,
          error: message,
          updatedAt: new Date().toISOString()
        });
    }
  }

  private update(id: string, status: XhsAuthSession["status"], message: string) {
    const session = this.sessions.get(id);
    if (session) this.sessions.set(id, { ...session, status, message, updatedAt: new Date().toISOString() });
  }

  private profileDir() {
    return path.resolve(this.config.xhsRuntimeDir, "..", "xhs-browser-profile");
  }

  private browserDir() {
    return path.resolve(this.config.xhsRuntimeDir, "..", "playwright-browsers");
  }

  private async ensureBrowser(sessionId: string, playwrightPath: string) {
    const systemBrowser = findBrowser();
    if (systemBrowser) return systemBrowser;
    if (fs.existsSync(playwrightPath)) return playwrightPath;
    this.update(sessionId, "waiting", "正在按需安装登录浏览器，请稍候");
    const cli = path.join(path.dirname(require.resolve("playwright-core")), "cli.js");
    await fsp.mkdir(this.browserDir(), { recursive: true });
    await execFileAsync(process.execPath, [cli, "install", "chromium"], {
      env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: this.browserDir() },
      windowsHide: true,
      timeout: this.config.xhsInstallTimeoutMs,
      maxBuffer: 2 * 1024 * 1024
    });
    if (!fs.existsSync(playwrightPath)) throw new Error("登录浏览器安装失败，请检查网络后重试");
    return playwrightPath;
  }

  private cookiePath() {
    return path.join(this.profileDir(), "auth.json");
  }
}

function findBrowser() {
  const candidates =
    process.platform === "win32"
      ? [
          path.join(process.env.PROGRAMFILES || "", "Google/Chrome/Application/chrome.exe"),
          path.join(process.env["PROGRAMFILES(X86)"] || "", "Microsoft/Edge/Application/msedge.exe"),
          path.join(process.env.LOCALAPPDATA || "", "Google/Chrome/Application/chrome.exe")
        ]
      : process.platform === "darwin"
        ? [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
          ]
        : ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/microsoft-edge"];
  return candidates.find((candidate) => candidate && fs.existsSync(candidate));
}
