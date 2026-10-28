/** Self-contained bookmark: runs only on a public TikTok profile, reads visible links, never cookies or APIs. */
export function installTikTokCollector() {
  const profile = () => {
    const url = new URL(window.location.href);
    const match = /^\/@([A-Za-z0-9_.]{1,24})\/?$/.exec(url.pathname);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      ["www.tiktok.com", "tiktok.com", "m.tiktok.com"].includes(url.hostname) &&
      match
      ? match[1].toLowerCase()
      : undefined;
  };
  const username = profile();
  if (!username) {
    window.alert("请先在普通浏览器中打开 TikTok 用户主页，看到视频列表后再点击采集书签。");
    return;
  }
  const panelId = "toolbox-tiktok-public-collector";
  if (document.getElementById(panelId)) {
    window.alert("采集助手已经打开，请使用页面右上角的采集面板。");
    return;
  }
  const works = new Map<string, string>();
  let timer: ReturnType<typeof setInterval> | undefined,
    started = 0,
    lastChange = Date.now(),
    stopped = true;
  const panel = document.createElement("section");
  panel.id = panelId;
  panel.setAttribute("aria-label", "TikTok 公开作品采集助手");
  panel.style.cssText =
    "position:fixed;right:16px;top:16px;width:340px;max-width:calc(100vw - 32px);max-height:80vh;overflow:auto;box-sizing:border-box;padding:16px;background:#fff;color:#162033;border:1px solid #ccd8ea;border-radius:12px;box-shadow:0 8px 28px #0003;z-index:2147483647;font:14px/1.6 sans-serif;text-align:left";
  const heading = document.createElement("strong"),
    status = document.createElement("p"),
    note = document.createElement("p"),
    actions = document.createElement("div"),
    exports = document.createElement("div");
  heading.textContent = `TikTok 公开作品采集 · @${username}`;
  note.textContent =
    "只收集此主页已显示的作品链接，不下载视频、不读取登录资料。数量不代表全部作品；遇到平台验证请手动处理。CSV 每批最多 100 条。";
  note.style.fontSize = "12px";
  panel.append(heading, status, note, actions, exports);
  const button = (text: string, run: () => void) => {
    const value = document.createElement("button");
    value.type = "button";
    value.textContent = text;
    value.style.cssText =
      "margin:4px;padding:6px 10px;cursor:pointer;border:1px solid #ccd8ea;border-radius:6px;background:#f5f7fb;color:#162033";
    value.addEventListener("click", run);
    actions.append(value);
    return value;
  };
  const clear = () => {
    clearInterval(timer);
    timer = undefined;
    stopped = true;
  };
  const report = (reason: string) => {
    status.textContent = `${reason}。已发现 ${works.size} 条；列表未确认完整。`;
  };
  const prepare = (reason: string) => {
    clear();
    start.textContent = "继续采集";
    report(reason);
    exports.replaceChildren();
    const values = [...works.values()];
    for (let offset = 0; offset < values.length; offset += 100) {
      const rows = [["作品链接", "平台"], ...values.slice(offset, offset + 100).map((url) => [url, "tiktok"])];
      const csv =
        "\uFEFF" +
        rows.map((row) => row.map((value) => '"' + value.replaceAll('"', '""') + '"').join(",")).join("\r\n") +
        "\r\n";
      const link = document.createElement("a");
      link.textContent = `下载第 ${offset / 100 + 1} 批 CSV（${rows.length - 1} 条）`;
      link.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
      link.download = `tiktok-${username}-${String(offset / 100 + 1).padStart(3, "0")}.csv`;
      link.style.cssText = "display:block;margin:8px 0;color:#245df5;text-decoration:underline";
      exports.append(link);
    }
  };
  const collect = () => {
    if (!panel.isConnected) {
      clear();
      window.removeEventListener("pagehide", clear);
      return;
    }
    if (profile() !== username) {
      prepare("主页已切换，采集已停止");
      return;
    }
    if (Date.now() - started >= 10 * 60_000) {
      prepare("已达到 10 分钟采集上限");
      return;
    }
    if (document.hidden) {
      lastChange = Date.now();
      report("页面在后台，已暂停滚动，切回后继续");
      return;
    }
    const restricted = Array.from(
      document.querySelectorAll(
        '[role="dialog"],#captcha-verify-container,[id*="captcha-verify"],[data-e2e="login-modal"]'
      )
    ).some((node) => node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().height > 0);
    if (restricted) {
      prepare("页面有弹窗或验证，请正常处理后再继续");
      return;
    }
    const before = works.size;
    for (const anchor of document.querySelectorAll<HTMLAnchorElement>('a[href*="/video/"],a[href*="/photo/"]')) {
      try {
        const url = new URL(anchor.href),
          match = /^\/@([A-Za-z0-9_.]{1,24})\/(video|photo)\/(\d{5,24})\/?$/.exec(url.pathname);
        if (
          url.protocol !== "https:" ||
          url.username ||
          url.password ||
          url.port ||
          !["www.tiktok.com", "tiktok.com", "m.tiktok.com"].includes(url.hostname) ||
          match?.[1].toLowerCase() !== username
        )
          continue;
        if (!works.has(match[3]) && works.size >= 10000) {
          prepare("达到 10000 条上限");
          return;
        }
        works.set(match[3], `https://www.tiktok.com/@${username}/${match[2]}/${match[3]}`);
      } catch {
        /* Ignore non-work anchors. */
      }
    }
    if (before !== works.size) lastChange = Date.now();
    if (Date.now() - lastChange >= 30_000) {
      prepare(works.size ? "加载没有继续返回作品，已停止滚动" : "尚未发现作品，请先确认主页视频可见");
      return;
    }
    report("正在采集公开作品");
    // Wait for the first visible cards before scrolling; no page reloads or direct API calls.
    if (works.size) window.scrollBy(0, Math.max(window.innerHeight * 0.8, 400));
  };
  const start = button("开始采集", () => {
    if (!stopped) return;
    stopped = false;
    started = lastChange = Date.now();
    exports.replaceChildren();
    start.textContent = "采集中";
    collect();
    if (!stopped) timer = setInterval(collect, 2500);
  });
  button("停止并准备 CSV", () => prepare("已按当前发现的作品准备 CSV"));
  button("关闭助手", () => {
    clear();
    window.removeEventListener("pagehide", clear);
    works.clear();
    panel.remove();
  });
  window.addEventListener("pagehide", clear, { once: true });
  document.body.append(panel);
  report("准备就绪，请点击开始采集");
}

export function createTikTokCollectorBookmarklet() {
  return "javascript:" + encodeURIComponent(`void (${installTikTokCollector.toString()})()`);
}

export function createTikTokCollectorHelpHtml() {
  const link = createTikTokCollectorBookmarklet();
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TikTok 普通浏览器采集助手</title><style>body{max-width:820px;margin:48px auto;padding:0 24px;font:16px/1.8 sans-serif;color:#162033}a{display:inline-block;padding:12px 24px;background:#245df5;color:white;border-radius:8px}li{margin:12px 0}small{color:#60708a}</style><h1>TikTok 普通浏览器采集助手</h1><p>用于普通浏览器可以显示作品，但程序自动窗口无法加载的情况。不需要安装扩展或提供 Cookie。</p><ol><li>按 Ctrl+Shift+B（Mac 为 ⌘+Shift+B）显示书签栏，把下面的蓝色链接拖到书签栏。</li><li>在这个普通浏览器中打开 TikTok 用户主页，确认视频可见，再点击书签栏里的“采集 TikTok 作品”。</li><li>在采集面板点击“开始采集”。保持页面在前台；可随时“停止并准备 CSV”。程序不会处理登录或验证码。</li><li>逐个下载生成的 CSV，每份最多 100 条。回到电商工具箱，使用“表格批量归档”预览、选择分组并确认。已有归档默认跳过。</li></ol><p><a href="${link}" title="拖到浏览器书签栏；不要直接在此页面点击">采集 TikTok 作品</a></p><small>仅收集公开页面实际显示的作品链接。停止滚动或采集数量均不能证明账号作品已全部获取；采集助手不发起 API 请求、不读取 Cookie、浏览器登录资料或本机文件。关闭后丢弃未导出的发现列表，已下载 CSV 保留。</small></html>`;
}
