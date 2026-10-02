/** 平台读取网关：小红书维持原 Worker/登录流程；抖音只调用匿名受管浏览器，不携带任何 Cookie。 */
import { createHash } from "node:crypto";
import type { AppConfig } from "../../config";
import type { RemoteFetch } from "../../security/remote-fetch";
import { workerAuthHeaders } from "../../security/worker-auth";
import type { XhsRuntimeManager } from "../xhs-archive/runtime";
import type { XhsAuthManager } from "../xhs-archive/auth";
import { extractXhsUrl, normalizeXhsProviderItem } from "../xhs-archive/provider-item";
import type { DouyinRuntimeManager } from "./douyin-runtime";
import { abortable, ArchiveTaskError, type ArchiveProvider } from "./provider";

export function xhsProvider(
  config: AppConfig,
  remoteFetch: RemoteFetch,
  runtime: XhsRuntimeManager,
  auth: XhsAuthManager
): ArchiveProvider {
  return {
    platform: "xiaohongshu",
    async extract(url, signal, progress) {
      progress("installing", 3, "准备小红书解析环境");
      const provider = await abortable(
        runtime.ensureReady(
          (status) => {
            if (!signal.aborted)
              progress("installing", Math.max(3, Math.round(status.installProgress * 0.3)), status.message);
          },
          { signal }
        ),
        signal
      );
      signal.throwIfAborted();
      const local = ["127.0.0.1", "localhost", "::1"].includes(new URL(provider).hostname.replace(/^\[|\]$/g, ""));
      // 平台 Cookie 仅交给本机 Worker，不发送到外部配置的解析服务。
      const cookie = local ? await abortable(auth.cookieHeader(), signal) : "";
      let providerInput = url;
      if (["xhslink.com", "www.xhslink.com", "xhslink.cn", "www.xhslink.cn"].includes(new URL(url).hostname)) {
        const response = await remoteFetch(url, { method: "GET", headers: { "user-agent": "Mozilla/5.0" }, signal });
        await response.body?.cancel();
        const resolved = extractXhsUrl(response.url);
        if (!resolved || !["xiaohongshu.com", "www.xiaohongshu.com"].includes(new URL(resolved).hostname))
          throw new ArchiveTaskError("XHS_URL_INVALID", "小红书短链未跳转到受支持的内容地址");
        providerInput = resolved;
      }
      progress("parsing", 32, "正在解析标题、正文和媒体");
      const response = await fetch(`${provider}/extract`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...workerAuthHeaders(local ? config.xhsProviderToken : undefined)
        },
        body: JSON.stringify({ url: providerInput, cookie }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(90_000)])
      });
      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        items?: unknown[];
        detail?: string;
      };
      signal.throwIfAborted();
      if (!response.ok || !payload.success || !Array.isArray(payload.items) || !payload.items[0]) {
        const unavailable = /已删除|不存在|not found|unavailable/i.test(payload.detail || "");
        throw new ArchiveTaskError(
          unavailable ? "XHS_CONTENT_UNAVAILABLE" : cookie ? "XHS_PARSE_FAILED" : "XHS_AUTH_REQUIRED",
          unavailable
            ? "该内容已删除、不可见或链接已失效"
            : cookie
              ? "小红书内容解析失败，请稍后重试"
              : "内容不完整或触发访问限制，请登录小红书后重试"
        );
      }
      const { noteId, media, ...rest } = normalizeXhsProviderItem(payload.items[0], url);
      if (!media.length)
        throw new ArchiveTaskError(
          cookie ? "XHS_MEDIA_EMPTY" : "XHS_AUTH_REQUIRED",
          "未获取到媒体文件，请登录后重试或检查内容是否已删除"
        );
      return {
        ...rest,
        platform: "xiaohongshu",
        contentId: noteId,
        media: media.map(({ url: mediaUrl, ...entry }) => ({ ...entry, urls: [mediaUrl] }))
      };
    },
    close: () => runtime.stop()
  };
}

export function douyinProvider(runtime: DouyinRuntimeManager): ArchiveProvider {
  return {
    platform: "douyin",
    async extract(url, signal, progress) {
      progress("installing", 2, "正在检查抖音匿名归档环境");
      const { source } = await runtime.extract(url, {
        signal,
        onInstallProgress: (value, message) => progress("installing", value, message)
      });
      progress("parsing", 32, "正在匿名读取抖音公开作品");
      signal.throwIfAborted();
      const { tags, ...rest } = source;
      return {
        ...rest,
        rawText: source.description,
        topics: tags.map((source) => ({ id: createHash("sha256").update(source).digest("hex").slice(0, 16), source }))
      };
    },
    close: () => runtime.close()
  };
}
