import type { FastifyInstance } from "fastify";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  ApiFailureSchema,
  ShortVideoDownloadQuerySchema,
  ShortVideoParseInputSchema,
  ShortVideoParseResultSchema,
  apiSuccessSchema,
  detectShortVideoPlatform,
  extractFirstUrl,
  fail,
  isSupportedShortVideoUrl,
  normalizeShortVideoProviderResult,
  ok,
  type ShortVideoParseInput,
  type ShortVideoParseResult,
  type ShortVideoPlatform
} from "@toolbox/shared";
import type { AppConfig } from "../config";
import {
  assertRemoteResponseSize,
  fetchRemoteResponse,
  limitedResponseStream,
  type RemoteFetch
} from "../security/remote-fetch";

const execFileAsync = promisify(execFile);
const resultCaches = new WeakMap<AppConfig, Map<string, { expiresAt: number; result: ShortVideoParseResult }>>();

type RegisterShortVideoRoutesOptions = {
  app: FastifyInstance;
  config: AppConfig;
  remoteFetch: RemoteFetch;
};

type ProviderResponse = {
  code?: unknown;
  msg?: unknown;
  data?: unknown;
  platform?: unknown;
  cache_status?: unknown;
};

class ProviderResultError extends Error {}
class ProviderHttpError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}
class ProviderTimeoutError extends Error {}

export async function registerShortVideoRoutes({ app, config, remoteFetch }: RegisterShortVideoRoutesOptions) {
  app.post<{ Body: ShortVideoParseInput }>(
    "/api/v1/tools/short-video/parse",
    {
      schema: {
        body: ShortVideoParseInputSchema,
        response: { 200: apiSuccessSchema(ShortVideoParseResultSchema), 400: ApiFailureSchema, 502: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const body = request.body;
      const rawInput = body.input.trim();
      const sourceUrl = extractFirstUrl(rawInput) ?? rawInput;
      const requestedPlatform = body.platform ?? "auto";

      if (!sourceUrl) {
        return reply.code(400).send(fail("SHORT_VIDEO_URL_REQUIRED", "请输入抖音、小红书或 TikTok 分享链接"));
      }

      if (!isValidRequestedPlatform(requestedPlatform)) {
        return reply.code(400).send(fail("INVALID_SHORT_VIDEO_PLATFORM", "不支持的平台参数"));
      }

      if (!isSupportedShortVideoUrl(sourceUrl)) {
        return reply.code(400).send(fail("UNSUPPORTED_SHORT_VIDEO_URL", "当前支持抖音、小红书和 TikTok 公开分享链接"));
      }

      if (isPlatformMismatch(sourceUrl, requestedPlatform)) {
        return reply
          .code(400)
          .send(fail("SHORT_VIDEO_PLATFORM_MISMATCH", "选择的平台与分享链接不匹配，请切换平台或使用自动识别"));
      }

      try {
        return ok(await resolveShortVideo(config, sourceUrl, requestedPlatform));
      } catch (error) {
        const message = error instanceof Error ? error.message : "短视频解析请求失败";
        if (error instanceof ProviderResultError) {
          return reply.code(400).send(fail("SHORT_VIDEO_PARSE_FAILED", message));
        }
        return reply.code(502).send(fail("SHORT_VIDEO_PROVIDER_UNAVAILABLE", message));
      }
    }
  );

  app.get<{ Querystring: { url: string; filename?: string } }>(
    "/api/v1/tools/short-video/download",
    {
      schema: {
        querystring: ShortVideoDownloadQuerySchema,
        response: { 400: ApiFailureSchema, 502: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const query = request.query;
      const mediaUrl = query.url.trim();
      const filename = sanitizeDownloadFilename(query.filename || "short-video-media");

      if (!isHttpUrl(mediaUrl)) {
        return reply.code(400).send(fail("INVALID_SHORT_VIDEO_MEDIA_URL", "下载地址无效"));
      }

      try {
        const response = await fetchRemoteResponse(
          remoteFetch,
          mediaUrl,
          {
            headers: {
              accept: "*/*",
              "user-agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36"
            }
          },
          config.remoteFetchTimeoutMs
        );

        if (!response.ok || !response.body) {
          return reply.code(502).send(fail("SHORT_VIDEO_DOWNLOAD_FAILED", `媒体下载失败：${response.status}`));
        }
        assertRemoteResponseSize(response, config.remoteMediaMaxBytes);

        const contentType = response.headers.get("content-type") || "application/octet-stream";
        const contentLength = response.headers.get("content-length");
        reply.header("content-type", contentType);
        reply.header("content-disposition", createAttachmentDisposition(filename));
        if (contentLength) {
          reply.header("content-length", contentLength);
        }

        return reply.send(limitedResponseStream(response, config.remoteMediaMaxBytes));
      } catch (error) {
        const message = error instanceof Error ? error.message : "媒体下载失败";
        return reply.code(502).send(fail("SHORT_VIDEO_DOWNLOAD_FAILED", message));
      }
    }
  );
}

async function resolveShortVideo(
  config: AppConfig,
  sourceUrl: string,
  requestedPlatform: Exclude<ShortVideoPlatform, "unknown">
): Promise<ShortVideoParseResult> {
  const cached = readCachedResult(config, sourceUrl, requestedPlatform);
  if (cached) return cached;

  let providerFailure: unknown;
  try {
    const providerResponse = await requestProvider(config, sourceUrl);
    if (providerResponse.code === 200) {
      const result = normalizeShortVideoProviderResult(providerResponse, { sourceUrl, requestedPlatform });
      cacheResult(config, sourceUrl, requestedPlatform, result);
      return result;
    }
    providerFailure = new ProviderResultError(getProviderMessage(providerResponse) || "短视频解析失败");
  } catch (error) {
    providerFailure = error;
  }

  if (detectShortVideoPlatform(sourceUrl) === "tiktok" && config.shortVideoTikTokOembedFallback) {
    try {
      const result = await requestTikTokOEmbed(config, sourceUrl, errorMessage(providerFailure));
      cacheResult(config, sourceUrl, requestedPlatform, result);
      return result;
    } catch {
      // Preserve the primary provider error because it best explains why media download is unavailable.
    }
  }

  throw providerFailure instanceof Error ? providerFailure : new Error("短视频解析请求失败");
}

async function requestProvider(config: AppConfig, sourceUrl: string) {
  const apiUrl = new URL(config.shortVideoParseApiUrl);
  apiUrl.searchParams.set("url", sourceUrl);

  const providerUrl = apiUrl.toString();

  let lastError: unknown;
  for (let attempt = 0; attempt <= config.shortVideoParseRetries; attempt += 1) {
    try {
      return await requestProviderWithFetch(providerUrl, config.shortVideoParseTimeoutMs);
    } catch (error) {
      lastError = error;
      if (!isRetryableProviderError(error) || attempt >= config.shortVideoParseRetries) break;
      await delay(250 * (attempt + 1));
    }
  }

  if (isRetryableProviderError(lastError)) {
    const fallbackResult = await requestProviderWithPowerShell(providerUrl, config.shortVideoParseTimeoutMs);
    if (fallbackResult) return fallbackResult;
  }
  throw lastError instanceof Error ? lastError : new Error("短视频解析请求失败");
}

async function requestProviderWithFetch(providerUrl: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(providerUrl, {
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36"
      }
    });
    if (!response.ok) throw new ProviderHttpError(`解析服务响应异常：${response.status}`, response.status);
    return (await response.json()) as ProviderResponse;
  } catch (error) {
    if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
      throw new ProviderTimeoutError("解析服务请求超时");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function requestTikTokOEmbed(
  config: AppConfig,
  sourceUrl: string,
  providerFailure: string
): Promise<ShortVideoParseResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.shortVideoParseTimeoutMs);
  const endpoint = new URL("https://www.tiktok.com/oembed");
  endpoint.searchParams.set("url", sourceUrl);

  try {
    const response = await fetch(endpoint, {
      signal: controller.signal,
      headers: { accept: "application/json" }
    });
    if (!response.ok) throw new Error(`TikTok 官方预览响应异常：${response.status}`);
    const payload = (await response.json()) as Record<string, unknown>;
    const title = stringValue(payload.title) || "TikTok 视频";
    const authorName = stringValue(payload.author_name);
    const authorUrl = stringValue(payload.author_url);
    const html = stringValue(payload.html);
    const videoId = extractTikTokVideoId(sourceUrl) || extractTikTokVideoId(html);
    const thumbnailUrl = stringValue(payload.thumbnail_url) || undefined;

    return {
      platform: "tiktok",
      sourceUrl,
      type: "video",
      title,
      author: authorName || authorUrl ? { name: authorName || undefined, id: tiktokAuthorId(authorUrl) } : undefined,
      coverUrl: thumbnailUrl,
      media: [],
      provider: "tiktok-oembed",
      embedUrl: videoId ? `https://www.tiktok.com/player/v1/${videoId}` : undefined,
      providerMessage: "TikTok 官方预览",
      warnings: [`${providerFailure ? `${providerFailure}；` : ""}当前显示 TikTok 官方预览，下载和文案提取暂不可用`]
    } satisfies ShortVideoParseResult;
  } finally {
    clearTimeout(timeout);
  }
}

async function requestProviderWithPowerShell(providerUrl: string, timeoutMs: number) {
  if (process.platform !== "win32") return null;

  const timeoutSeconds = Math.max(1, Math.ceil(timeoutMs / 1000));
  const script = [
    `$uri = ${toPowerShellString(providerUrl)}`,
    `$timeout = ${timeoutSeconds}`,
    "$ProgressPreference = 'SilentlyContinue'",
    "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
    "$headers = @{ 'User-Agent' = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36'; 'Accept' = 'application/json' }",
    "(Invoke-WebRequest -Uri $uri -UseBasicParsing -TimeoutSec $timeout -Headers $headers).Content"
  ].join("; ");

  try {
    const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
      timeout: timeoutMs + 1000,
      encoding: "utf8",
      maxBuffer: 5 * 1024 * 1024
    });
    return JSON.parse(stdout) as ProviderResponse;
  } catch {
    return null;
  }
}

function toPowerShellString(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function isPlatformMismatch(sourceUrl: string, requestedPlatform: Exclude<ShortVideoPlatform, "unknown">) {
  return requestedPlatform !== "auto" && detectShortVideoPlatform(sourceUrl) !== requestedPlatform;
}

function readCachedResult(
  config: AppConfig,
  sourceUrl: string,
  requestedPlatform: Exclude<ShortVideoPlatform, "unknown">
) {
  if (config.shortVideoCacheTtlMs <= 0) return undefined;
  const cache = resultCaches.get(config);
  const key = cacheKey(sourceUrl, requestedPlatform);
  const entry = cache?.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    cache?.delete(key);
    return undefined;
  }
  return {
    ...entry.result,
    media: [...entry.result.media],
    warnings: [...entry.result.warnings],
    cacheStatus: "local-hit"
  };
}

function cacheResult(
  config: AppConfig,
  sourceUrl: string,
  requestedPlatform: Exclude<ShortVideoPlatform, "unknown">,
  result: ShortVideoParseResult
) {
  if (config.shortVideoCacheTtlMs <= 0) return;
  let cache = resultCaches.get(config);
  if (!cache) {
    cache = new Map();
    resultCaches.set(config, cache);
  }
  cache.set(cacheKey(sourceUrl, requestedPlatform), {
    expiresAt: Date.now() + config.shortVideoCacheTtlMs,
    result
  });
  if (cache.size > 500) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
}

function cacheKey(sourceUrl: string, requestedPlatform: Exclude<ShortVideoPlatform, "unknown">) {
  return `${requestedPlatform}\u0000${sourceUrl}`;
}

function isRetryableProviderError(error: unknown) {
  if (error instanceof ProviderTimeoutError || error instanceof TypeError) return true;
  if (error instanceof ProviderHttpError) {
    return error.status === 408 || error.status === 429 || error.status >= 500;
  }
  return false;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractTikTokVideoId(value: string) {
  return value.match(/(?:\/video\/|data-video-id=["'])(\d{8,})/i)?.[1];
}

function tiktokAuthorId(authorUrl: string) {
  const match = authorUrl.match(/\/(@[^/?#]+)/);
  return match?.[1]?.slice(1) || undefined;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "";
}

function isValidRequestedPlatform(value: unknown): value is Exclude<ShortVideoPlatform, "unknown"> {
  return value === "auto" || value === "douyin" || value === "xiaohongshu" || value === "tiktok";
}

function getProviderMessage(response: ProviderResponse) {
  return typeof response.msg === "string" ? response.msg : "";
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function sanitizeDownloadFilename(value: string) {
  const filename = value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "")
    .slice(0, 160);
  return filename || "short-video-media";
}

function createAttachmentDisposition(filename: string) {
  return `attachment; filename="${toAsciiDownloadFilename(filename)}"; filename*=UTF-8''${encodeRFC5987Value(filename)}`;
}

function toAsciiDownloadFilename(filename: string) {
  const extension = filename.match(/\.([a-z0-9]{1,8})$/i)?.[0] ?? "";
  const withoutExtension = extension ? filename.slice(0, -extension.length) : filename;
  const asciiBase = withoutExtension
    .replace(/[^\x20-\x7E]+/g, "")
    .replace(/[\\/:*?"<>|]+/g, "")
    .trim();
  return `${asciiBase || fallbackAsciiBase(extension)}${extension}`;
}

function fallbackAsciiBase(extension: string) {
  return extension.toLowerCase() === ".mp4" ? "video" : "short-video-media";
}

function encodeRFC5987Value(value: string) {
  return encodeURIComponent(value).replace(/['()]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}
