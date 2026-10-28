/** Normal browser scrolling observes owner-bound responses; stalled scrolling never proves completeness. */
import { setTimeout as delay } from "node:timers/promises";
import type { Frame, Page, Request, Response } from "playwright-core";
import { normalizeTikTokProfileLink, type TikTokProfileWork } from "@toolbox/shared/archive";
import type { ComponentManager } from "../../../../modules/components/component-manager";
import { ArchiveTaskError, abortable } from "../../core/provider";
import { ProfileCollector, readProfileIdentity } from "./profile-source";
import { openProfileBrowser, resolveProfileBrowser } from "./profile-browser";

export type ProfileDiscovery = {
  works: TikTokProfileWork[];
  complete: boolean;
  declaredCount?: number;
  waitingUser: boolean;
  message: string;
};
const navigating = (error: unknown) =>
  error instanceof Error &&
  /Unable to retrieve content because the page is navigating|Execution context was destroyed.*navigation|Cannot find context with specified id/.test(
    error.message
  );
export async function readProfileWorks(
  page: Page,
  username: string,
  signal: AbortSignal,
  update: (snapshot: ProfileDiscovery) => void,
  seed: TikTokProfileWork[] = [],
  options: { pollMs?: number; stallMs?: number } = {}
) {
  const collector = new ProfileCollector(username, seed),
    early: Array<{ value: unknown; owner: string | null; cursor: string | null }> = [];
  let active = true,
    pending = 0,
    received = 0,
    failure: unknown,
    listProblem: string | undefined,
    navigationRevision = 0,
    waitingUser = false,
    lastChanged = Date.now();
  const snapshot = (message: string): ProfileDiscovery => ({
    works: [...collector.works.values()],
    complete: collector.complete,
    declaredCount: collector.identity.declaredCount,
    waitingUser,
    message
  });
  const response = (response: Response) => {
    const url = new URL(response.url());
    if (
      !active ||
      signal.aborted ||
      url.protocol !== "https:" ||
      url.hostname !== "www.tiktok.com" ||
      url.port ||
      url.pathname !== "/api/post/item_list/" ||
      (collector.identity.secUid && url.searchParams.get("secUid") !== collector.identity.secUid) ||
      pending >= 2 ||
      received >= 1000
    )
      return;
    pending++;
    received++;
    const revision = navigationRevision;
    void (async () => {
      try {
        if (response.status() === 429)
          throw new ArchiveTaskError("TIKTOK_RATE_LIMITED", "TikTok 请求过于频繁，作品列表尚未获取完整", 429);
        if (response.status() !== 200) {
          listProblem = `TikTok 作品列表请求失败（HTTP ${response.status()}），请检查独立浏览器中的提示后手动刷新；尚未获取完整列表`;
          return;
        }
        if (Number(response.headers()["content-length"]) > 4 * 1024 * 1024)
          throw new Error("PROFILE_RESPONSE_TOO_LARGE");
        const body = await response.body();
        if (!active || signal.aborted || revision !== navigationRevision) return;
        if (body.length > 4 * 1024 * 1024) throw new Error("PROFILE_RESPONSE_TOO_LARGE");
        if (!body.toString("utf8").trim()) {
          listProblem = `TikTok 作品列表返回空响应（HTTP 200）。当前已发现 ${collector.works.size} 条作品，发现进度保留；请在独立浏览器点击“刷新”后重试。这不等于必须登录`;
          return;
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(body.toString("utf8"));
        } catch {
          listProblem = "TikTok 作品列表返回的内容无法解析，尚未获取完整列表；请在独立浏览器检查页面提示后手动刷新";
          return;
        }
        const value: unknown = parsed,
          owner = url.searchParams.get("secUid"),
          cursor = url.searchParams.get("cursor");
        if (!collector.identity.secUid && early.length < 4) early.push({ value, owner, cursor });
        else collector.accept(value, owner, cursor);
        if (owner === collector.identity.secUid) listProblem = undefined;
        lastChanged = Date.now();
      } catch (error) {
        if (active && !signal.aborted && revision === navigationRevision) failure = error;
      } finally {
        pending--;
      }
    })();
  };
  const requestFailed = (request: Request) => {
    const url = new URL(request.url());
    if (
      active &&
      !signal.aborted &&
      url.protocol === "https:" &&
      url.hostname === "www.tiktok.com" &&
      !url.port &&
      url.pathname === "/api/post/item_list/" &&
      (!collector.identity.secUid || url.searchParams.get("secUid") === collector.identity.secUid)
    )
      listProblem =
        "TikTok 作品列表网络请求未完成，尚未获取完整列表；请检查 TikTok 网络或代理，并在独立浏览器手动刷新重试";
  };
  const navigated = (frame: Frame) => {
    if (frame !== page.mainFrame()) return;
    navigationRevision++;
    collector.resetPagination();
    early.length = 0;
    lastChanged = Date.now();
  };
  page.on("response", response);
  page.on("requestfailed", requestFailed);
  page.on("framenavigated", navigated);
  try {
    const navigation = await page.goto(`https://www.tiktok.com/@${username}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000
    });
    if ([401, 403, 404, 410, 429, 451].includes(navigation?.status() ?? 0))
      throw new ArchiveTaskError("TIKTOK_PROFILE_UNAVAILABLE", "TikTok 主页不可访问或暂时受限，请检查网络或代理", 409);
    let previousCount = collector.works.size;
    while (!page.isClosed()) {
      signal.throwIfAborted();
      const location = normalizeTikTokProfileLink(page.url());
      if (location && location.username !== username)
        throw new ArchiveTaskError("TIKTOK_PROFILE_IDENTITY_MISMATCH", "浏览器切换到了其他用户，已停止读取", 409);
      const state = await page
        .evaluate(() => ({
          scripts: ["__UNIVERSAL_DATA_FOR_REHYDRATION__", "SIGI_STATE"].map(
            (id) => document.getElementById(id)?.textContent?.slice(0, 4 * 1024 * 1024) ?? ""
          ),
          links: Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/video/"],a[href*="/photo/"]'))
            .slice(0, 500)
            .map((a) => ({
              url: a.href,
              title: (a.getAttribute("aria-label") ?? a.getAttribute("title") ?? "").slice(0, 500)
            })),
          waiting: Array.from(
            document.querySelectorAll(
              '#captcha-verify-container,[id*="captcha-verify"],[data-e2e="login-modal"],[role="dialog"]'
            )
          ).some((node) => node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().height > 0)
        }))
        .catch(async (error: unknown) => {
          signal.throwIfAborted();
          if (page.isClosed()) return undefined;
          if (!navigating(error)) throw error;
          update(snapshot("独立浏览器正在刷新或跳转，已发现链接保留；等待页面重新加载后继续读取"));
          await delay(options.pollMs ?? 1500, undefined, { signal });
          return undefined;
        });
      if (!state) continue;
      for (const script of state.scripts) {
        if (!script) continue;
        try {
          const identity = readProfileIdentity(JSON.parse(script), username);
          if (identity) collector.setIdentity(identity);
        } catch (error) {
          if (error instanceof ArchiveTaskError) throw error;
        }
      }
      if (collector.identity.secUid)
        for (const item of early.splice(0)) collector.accept(item.value, item.owner, item.cursor);
      for (const link of state.links) collector.addLink(link.url, link.title);
      waitingUser =
        state.waiting ||
        Boolean(listProblem) ||
        /^\/(?:login|signup|passport)(?:\/|$)/.test(new URL(page.url()).pathname);
      if (failure) throw failure;
      if (collector.works.size !== previousCount) {
        previousCount = collector.works.size;
        lastChanged = Date.now();
      }
      if (collector.complete) {
        const value = snapshot("已验证从首屏到末页的分页链，作品列表获取完整");
        update(value);
        return value;
      }
      if (collector.ended) {
        const value = snapshot("已读到分页末尾，但数量低于主页统计，尚未确认全量；可归档已发现作品");
        update(value);
        return value;
      }
      if (collector.limited) {
        const value = snapshot("已达到 10000 条发现上限，列表未确认完整；请先分批归档");
        update(value);
        return value;
      }
      update(
        snapshot(
          listProblem ??
            (waitingUser
              ? "请在本机独立 TikTok 浏览器中检查登录、验证、隐私或网络提示；程序不会代填凭据或跳过验证"
              : `已发现 ${collector.works.size} 条作品，正在向下加载；尚未确认分页结束`)
        )
      );
      if (!waitingUser && Date.now() - lastChanged >= (options.stallMs ?? 30_000))
        return snapshot("主页加载没有继续返回作品，未确认全量；请检查浏览器提示后继续读取");
      if (!waitingUser)
        await page
          .evaluate(() => window.scrollBy(0, Math.max(window.innerHeight, 800)))
          .catch((error: unknown) => {
            signal.throwIfAborted();
            if (!page.isClosed() && !navigating(error)) throw error;
          });
      await delay(options.pollMs ?? 1500, undefined, { signal });
    }
    return snapshot(
      listProblem
        ? `独立浏览器已关闭，已保留发现进度。${listProblem}`
        : "独立浏览器已关闭，已保留发现进度；可继续读取或归档已发现作品"
    );
  } finally {
    active = false;
    page.removeListener("response", response);
    page.removeListener("requestfailed", requestFailed);
    page.removeListener("framenavigated", navigated);
  }
}

export class TikTokProfileReader {
  private operation?: { controller: AbortController; done: Promise<ProfileDiscovery> };
  private closed = false;
  constructor(
    private readonly components: Pick<ComponentManager, "resolveInstalledAsset" | "list">,
    private readonly options: {
      proxy?: string;
      openBrowser?: typeof openProfileBrowser;
      read?: typeof readProfileWorks;
      resolveBrowser?: typeof resolveProfileBrowser;
      timeoutMs?: number;
    } = {}
  ) {}
  isActive() {
    return Boolean(this.operation);
  }
  read(
    input: string,
    signal: AbortSignal,
    update: (snapshot: ProfileDiscovery) => void,
    seed: TikTokProfileWork[] = []
  ) {
    const profile = normalizeTikTokProfileLink(input);
    if (!profile) throw new ArchiveTaskError("TIKTOK_PROFILE_URL_INVALID", "请输入 HTTPS TikTok 用户主页链接");
    if (this.closed || this.operation)
      throw new ArchiveTaskError("TIKTOK_PROFILE_BUSY", "主页读取正在运行或服务已关闭", 409);
    signal.throwIfAborted();
    const controller = new AbortController(),
      combined = AbortSignal.any([
        signal,
        controller.signal,
        AbortSignal.timeout(this.options.timeoutMs ?? 10 * 60_000)
      ]);
    const done = Promise.resolve()
      .then(async () => {
        const executablePath = await abortable(
          (this.options.resolveBrowser ?? resolveProfileBrowser)(this.components),
          combined
        );
        combined.throwIfAborted();
        const browser = await (this.options.openBrowser ?? openProfileBrowser)({
          executablePath,
          proxy: this.options.proxy,
          signal: combined
        });
        try {
          return await (this.options.read ?? readProfileWorks)(browser.page, profile.username, combined, update, seed);
        } finally {
          await browser.close();
        }
      })
      .finally(() => {
        if (this.operation?.controller === controller) this.operation = undefined;
      });
    this.operation = { controller, done };
    return done;
  }
  async stop() {
    const operation = this.operation;
    operation?.controller.abort(new DOMException("主页读取已停止", "AbortError"));
    await operation?.done.catch(() => undefined);
  }
  async close() {
    this.closed = true;
    await this.stop();
  }
}
