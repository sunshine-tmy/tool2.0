/**
 * 中文模块说明：小红书归档领域，负责获取、媒体、翻译、运行时和恢复
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import type { XhsAuthSession } from "@toolbox/shared";
import type { AppConfig } from "../../config";
import { ComponentManager, ComponentManagerError } from "../components/component-manager";

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
export class XhsAuthManager {
  private sessions = new Map<string, XhsAuthSession>();
  private activeSessions = new Set<string>();
  private contexts = new Map<string, { close: () => Promise<void> }>();

  constructor(
    private readonly config: AppConfig,
    private readonly components?: ComponentManager,
    private readonly findSystemBrowser: () => string | undefined = findBrowser
  ) {}

  isActive() {
    return this.activeSessions.size > 0;
  }

  async isAuthenticated() {
    return Boolean((await this.cookieHeader()).trim());
  }

  async cookieHeader() {
    const cookies = await fsp
      .readFile(this.cookiePath(), "utf8")
      .catch(() => fsp.readFile(this.legacyCookiePath(), "utf8"))
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
    this.activeSessions.add(session.id);
    void this.run(session.id);
    return { ...session };
  }

  async stop() {
    const contexts = [...this.contexts.entries()];
    this.contexts.clear();
    await Promise.allSettled(contexts.map(([, context]) => context.close()));
    for (const id of this.activeSessions) this.update(id, "failed", "应用已关闭，登录窗口已结束");
    this.activeSessions.clear();
  }

  get(id: string) {
    const session = this.sessions.get(id);
    return session ? { ...session } : undefined;
  }

  private async run(id: string) {
    try {
      const { chromium } = await import("playwright-core");
      const executablePath = await this.resolveBrowser(id, chromium.executablePath());
      await fsp.mkdir(this.profileDir(), { recursive: true });
      this.update(id, "waiting", "请在打开的浏览器中扫码登录小红书");
      const context = await chromium.launchPersistentContext(this.profileDir(), { headless: false, executablePath });
      this.contexts.set(id, context);
      const page = context.pages()[0] ?? (await context.newPage());
      await page.goto("https://www.xiaohongshu.com/", { waitUntil: "domcontentloaded", timeout: 60_000 });
      const deadline = Date.now() + 10 * 60 * 1000;
      while (Date.now() < deadline) {
        const cookies = await context.cookies("https://www.xiaohongshu.com/");
        if (cookies.some((cookie) => cookie.name === "web_session" && cookie.value)) {
          await fsp.writeFile(this.cookiePath(), JSON.stringify(cookies), { encoding: "utf8", mode: 0o600 });
          await context.close();
          this.contexts.delete(id);
          this.update(id, "completed", "登录成功，将自动重试获取");
          return;
        }
        if (context.pages().length === 0) throw new Error("登录窗口已关闭");
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
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
    } finally {
      const context = this.contexts.get(id);
      this.contexts.delete(id);
      await context?.close().catch(() => undefined);
      this.activeSessions.delete(id);
    }
  }

  private update(id: string, status: XhsAuthSession["status"], message: string) {
    const session = this.sessions.get(id);
    if (session) this.sessions.set(id, { ...session, status, message, updatedAt: new Date().toISOString() });
  }

  private profileDir() {
    return path.join(path.dirname(this.config.runtime.storageRoot), "profile", "xhs-archive");
  }

  private legacyProfileDir() {
    return path.resolve(this.config.xhsRuntimeDir, "..", "xhs-browser-profile");
  }

  private async resolveBrowser(sessionId: string, playwrightPath: string) {
    const systemBrowser = this.findSystemBrowser();
    if (systemBrowser) return systemBrowser;
    if (fs.existsSync(playwrightPath)) return playwrightPath;
    if (this.components) {
      try {
        return (await this.components.resolveInstalledAsset("xhs-browser", "browser/chrome.exe")).path;
      } catch (error) {
        if (
          !(error instanceof ComponentManagerError) ||
          !["COMPONENT_NOT_FOUND", "COMPONENT_NOT_INSTALLED", "COMPONENT_DEPENDENCY_MISSING"].includes(error.code)
        ) {
          throw error;
        }
      }
    }
    // Legacy managed Playwright downloads are only reused when they already exist;
    // new browser downloads must be explicitly installed from Settings.
    const legacyPlaywrightPath = path.join(
      this.legacyProfileDir(),
      "..",
      "playwright-browsers",
      "chromium",
      "chrome.exe"
    );
    if (fs.existsSync(legacyPlaywrightPath)) return legacyPlaywrightPath;
    this.update(sessionId, "waiting", "未检测到可复用浏览器，请安装 Chrome/Edge，或前往设置安装登录浏览器能力");
    throw new Error("未检测到登录浏览器。请安装 Chrome/Edge，或前往设置的能力管理中安装登录浏览器后重试");
  }

  private cookiePath() {
    return path.join(this.profileDir(), "auth.json");
  }

  private legacyCookiePath() {
    return path.join(this.legacyProfileDir(), "auth.json");
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
