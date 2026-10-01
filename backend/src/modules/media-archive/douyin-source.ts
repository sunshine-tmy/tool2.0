/** 抖音作品数据适配：只解析普通浏览器已收到的数据，不生成签名、不执行远程脚本、不写归档。 */
export class DouyinSourceError extends Error {
  constructor(
    readonly code:
      | "DOUYIN_AUTH_REQUIRED"
      | "DOUYIN_CHALLENGE_REQUIRED"
      | "DOUYIN_RATE_LIMITED"
      | "DOUYIN_CONTENT_UNAVAILABLE"
      | "DOUYIN_PARSE_FAILED"
      | "DOUYIN_MEDIA_INCOMPLETE"
      | "DOUYIN_RESPONSE_TOO_LARGE",
    message: string
  ) {
    super(message);
    this.name = "DouyinSourceError";
  }
}

type MediaSource = {
  kind: "image" | "video" | "live-photo";
  index: number;
  urls: string[];
  width?: number;
  height?: number;
  durationMs?: number;
};
export type DouyinSource = {
  platform: "douyin";
  contentId: string;
  canonicalUrl: string;
  type: "image" | "video" | "live-photo";
  title: string;
  description: string;
  tags: string[];
  author: { id?: string; name?: string };
  publishedAt?: string;
  media: MediaSource[];
};
const MAX_PAGE_BYTES = 4 * 1024 * 1024;
const MAX_NODES = 25_000;

/** API snake_case 与页面 SSR camelCase 共用严格身份和媒体校验，不把推荐作品当成当前作品。 */
export function readDouyinApiResponse(input: unknown, expectedId: string): DouyinSource {
  const envelope = record(input);
  const detail = record(envelope.aweme_detail);
  if (!Object.keys(detail).length) {
    throw new DouyinSourceError("DOUYIN_CONTENT_UNAVAILABLE", "抖音没有返回可访问的作品内容");
  }
  if (envelope.status_code !== 0) throw new DouyinSourceError("DOUYIN_PARSE_FAILED", "抖音作品响应状态异常");
  return normalizeDetail(detail, expectedId);
}

/** 流式 SSR 的 JSON 可能嵌套于 children；RENDER_DATA 旧格式也接受，但必须精确匹配作品 ID。 */
export function readDouyinPage(html: string, expectedId: string): DouyinSource | undefined {
  if (Buffer.byteLength(html, "utf8") > MAX_PAGE_BYTES)
    throw new DouyinSourceError("DOUYIN_RESPONSE_TOO_LARGE", "抖音作品页面超过解析上限");
  // 仅依据真实验证页标题分类，不因文案提到验证码而误判，更不自动绕过平台访问限制。
  if (/<title>\s*(?:验证码中间页|安全验证)\s*<\/title>/i.test(html))
    throw new DouyinSourceError("DOUYIN_CHALLENGE_REQUIRED", "抖音要求安全验证，请在本机浏览器中正常完成后重试");
  let visited = 0;
  const find = (value: unknown, depth: number): Record<string, unknown> | undefined => {
    if (!value || typeof value !== "object") return;
    if (++visited > MAX_NODES || depth > 32)
      throw new DouyinSourceError("DOUYIN_RESPONSE_TOO_LARGE", "抖音作品数据嵌套或节点数量超过解析上限");
    const object = record(value);
    if (object.awemeId === expectedId || object.aweme_id === expectedId) {
      if (object.video || object.images) return object;
      const detail = record(record(object.aweme).detail);
      if (Object.keys(detail).length) return detail;
    }
    for (const child of Object.values(value)) {
      const result = find(child, depth + 1);
      if (result) return result;
    }
  };
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    const script = match[2].trim();
    let tree: unknown;
    try {
      if (/\bid\s*=\s*["']RENDER_DATA["']/i.test(match[1])) {
        tree = JSON.parse(decodeURIComponent(script));
      } else {
        // 仅接受完整 push(JSON) 表达式，追加代码或其他 JS 语法绝不会被 eval 执行。
        const pushed = /^self\.__pace_f\.push\(([\s\S]*)\);?$/.exec(script);
        if (!pushed) continue;
        const payload: unknown = JSON.parse(pushed[1]);
        if (!Array.isArray(payload) || payload[0] !== 1 || typeof payload[1] !== "string") continue;
        const separator = payload[1].indexOf(":");
        if (separator < 0) continue;
        tree = JSON.parse(payload[1].slice(separator + 1));
      }
    } catch {
      // 网站脚本和不可解析的流式片段不是作品；继续寻找合法 JSON，不能执行它们。
      continue;
    }
    const detail = find(tree, 0);
    if (detail) return normalizeDetail(detail, expectedId);
  }
}

function normalizeDetail(detail: Record<string, unknown>, expectedId: string): DouyinSource {
  const contentId = text(detail.awemeId ?? detail.aweme_id);
  if (!/^\d{5,24}$/.test(expectedId) || contentId !== expectedId)
    throw new DouyinSourceError("DOUYIN_PARSE_FAILED", "返回作品与请求的作品 ID 不一致");
  if (detail.pcNeedLogin === true || detail.pc_need_login === true)
    throw new DouyinSourceError("DOUYIN_AUTH_REQUIRED", "抖音要求登录后查看此作品");
  if (detail.isPrivate === true || detail.isFriendLimit === true || record(detail.status).is_private === true)
    throw new DouyinSourceError("DOUYIN_CONTENT_UNAVAILABLE", "此抖音作品的访问权限受限");
  const images = detail.images;
  if (images != null && !Array.isArray(images))
    throw new DouyinSourceError("DOUYIN_PARSE_FAILED", "抖音图片列表格式异常");
  if (Array.isArray(images) && images.length > 100)
    throw new DouyinSourceError("DOUYIN_RESPONSE_TOO_LARGE", "抖音作品的媒体数量超过上限");
  const media: MediaSource[] = [];
  if (Array.isArray(images) && images.length) {
    for (const [index, input] of images.entries()) {
      const image = record(input);
      media.push({
        kind: "image",
        index,
        urls: urls(image.urlList ?? image.url_list),
        width: positive(image.width),
        height: positive(image.height)
      });
      const video = record(image.video);
      const live =
        Object.keys(video).length > 0 || positive(image.livePhotoType ?? image.live_photo_type) !== undefined;
      if (live) media.push(videoSource(video, index, "live-photo"));
    }
  } else {
    if ((detail.awemeType ?? detail.aweme_type) === 68)
      throw new DouyinSourceError("DOUYIN_MEDIA_INCOMPLETE", "图文作品未返回完整图片列表，不能仅保存顶层视频");
    media.push(videoSource(record(detail.video), 0, "video"));
  }
  const description = text(detail.desc);
  const author = record(detail.authorInfo ?? detail.author);
  const extras = detail.textExtra ?? detail.text_extra;
  const tags = Array.isArray(extras)
    ? [...new Set(extras.map((value) => text(record(value).hashtagName ?? record(value).hashtag_name)).filter(Boolean))]
    : [];
  const created = positive(detail.createTime ?? detail.create_time);
  return {
    platform: "douyin",
    contentId,
    canonicalUrl: `https://www.douyin.com/${Array.isArray(images) && images.length ? "note" : "video"}/${contentId}`,
    type: media.some((m) => m.kind === "live-photo") ? "live-photo" : media[0].kind === "image" ? "image" : "video",
    // 没有独立标题时从完整文案生成短展示标题；完整文案保持原样，不截断、不抹掉话题。
    title:
      text(detail.itemTitle ?? detail.item_title) ||
      Array.from(description).slice(0, 80).join("") ||
      `抖音作品 ${contentId}`,
    description,
    tags,
    author: { id: text(author.uid) || undefined, name: text(author.nickname) || undefined },
    publishedAt: created && created < 8_640_000_000_000 ? new Date(created * 1000).toISOString() : undefined,
    media
  };
}

function videoSource(video: Record<string, unknown>, index: number, kind: "video" | "live-photo"): MediaSource {
  // 首选通用 playAddr/H.264，不能把图集背景音乐或封面误当作可归档的视频。
  const address = video.playAddr ?? record(video.play_addr).url_list;
  return {
    kind,
    index,
    urls: urls(address),
    width: positive(video.width),
    height: positive(video.height),
    durationMs: positive(video.duration)
  };
}
function urls(input: unknown): string[] {
  const result: string[] = [];
  for (const value of Array.isArray(input) ? input.slice(0, 8) : []) {
    const candidate = typeof value === "string" ? value : text(record(value).src);
    try {
      const url = new URL(candidate);
      // 下载端仍必须执行 DNS 固定、逐跳 SSRF 校验；这里绝不返回 Cookie 或其他页面认证字段。
      if (url.protocol !== "https:" || url.username || url.password || url.port || !url.hostname) continue;
      if (!result.includes(url.href)) result.push(url.href);
    } catch {
      /* 错误的媒体地址不参与候选回退。 */
    }
  }
  if (!result.length)
    throw new DouyinSourceError("DOUYIN_MEDIA_INCOMPLETE", "作品有媒体未返回可用的 HTTPS 地址，原归档不会被覆盖");
  return result;
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function positive(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}
