/** 多平台归档的输入识别边界。这里只识别作品链接，不请求网络，也不表示解析能力已就绪。 */
export type ArchivePlatform = "xiaohongshu" | "douyin";
export type ArchivePlatformSelection = "auto" | ArchivePlatform;

export type ArchiveLinkResult = { ok: true; platform: ArchivePlatform; url: string } | { ok: false; message: string };

export function identifyArchiveLink(input: string, selection: ArchivePlatformSelection = "auto"): ArchiveLinkResult {
  // 完整保留查询参数（分享令牌可能是访问作品的必要条件），只剔除分享文案的尾随标点。
  const candidates = [
    ...new Set(
      (input.match(/https?:\/\/[^\s<>"，。！？、；（）【】]+/gi) || []).map((value) =>
        value.replace(/[),.;!\]}]+$/, "")
      )
    )
  ];
  if (!candidates.length) return { ok: false, message: "请粘贴小红书或抖音的作品链接或分享文案" };
  if (candidates.length > 1) return { ok: false, message: "检测到多个链接，请仅保留本次需要归档的一条作品链接" };
  let url: URL;
  try {
    url = new URL(candidates[0]);
  } catch {
    return { ok: false, message: "作品链接格式无效，请重新复制分享链接" };
  }
  // 拒绝伪装域名、凭据和非标准端口；此校验不能替代下载端的 SSRF 与逐跳 DNS 校验。
  if (url.username || url.password || url.port) return { ok: false, message: "作品链接不能包含账号、密码或非标准端口" };
  let platform: ArchivePlatform | undefined;
  if (
    (["xiaohongshu.com", "www.xiaohongshu.com"].includes(url.hostname) &&
      /^\/(?:explore|discovery\/item)\/[^/]+\/?$/.test(url.pathname)) ||
    (["xhslink.com", "www.xhslink.com", "xhslink.cn", "www.xhslink.cn"].includes(url.hostname) && url.pathname !== "/")
  )
    platform = "xiaohongshu";
  if (
    (["douyin.com", "www.douyin.com"].includes(url.hostname) && /^\/(?:video|note)\/\d+\/?$/.test(url.pathname)) ||
    (url.hostname === "v.douyin.com" && /^\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)) ||
    (url.hostname === "www.iesdouyin.com" && /^\/share\/(?:video|slides)\/\d+\/?$/.test(url.pathname))
  )
    platform = "douyin";
  if (!platform) return { ok: false, message: "仅支持小红书或抖音的作品分享链接，不支持主页、直播或其他网站" };
  if (selection !== "auto" && selection !== platform)
    return { ok: false, message: "所选平台与作品链接不一致，请切换平台或使用自动识别" };
  return { ok: true, platform, url: url.toString() };
}
