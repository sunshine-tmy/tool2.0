/**
 * 中文模块说明：短视频领域，负责 Provider 解析、缓存、下载和 SSRF 边界
 */
import type { FastifyInstance } from "fastify";
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
import { REQUEST_QUOTAS } from "../security/request-quotas";
import type { RemoteFetch } from "../security/remote-fetch";
import { cacheResult, readCachedResult } from "./short-video-cache";
import {
  ProviderResultError,
  providerErrorMessage,
  providerMessage,
  requestProvider,
  requestTikTokOEmbed,
  type ProviderResponse
} from "./short-video-provider";
import { proxyShortVideoDownload, sanitizeDownloadFilename } from "./short-video-download";

type RegisterShortVideoRoutesOptions = {
  app: FastifyInstance;
  config: AppConfig;
  remoteFetch: RemoteFetch;
};

export async function registerShortVideoRoutes({ app, config, remoteFetch }: RegisterShortVideoRoutesOptions) {
  app.post<{ Body: ShortVideoParseInput }>(
    "/api/v1/tools/short-video/parse",
    {
      config: REQUEST_QUOTAS.remoteFetch,
      schema: {
        body: ShortVideoParseInputSchema,
        response: { 200: apiSuccessSchema(ShortVideoParseResultSchema), 400: ApiFailureSchema, 502: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const rawInput = request.body.input.trim();
      const sourceUrl = extractFirstUrl(rawInput) ?? rawInput;
      const requestedPlatform = request.body.platform ?? "auto";
      if (!sourceUrl)
        return reply.code(400).send(fail("SHORT_VIDEO_URL_REQUIRED", "请输入抖音、小红书或 TikTok 分享链接"));
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
        if (error instanceof ProviderResultError)
          return reply.code(400).send(fail("SHORT_VIDEO_PARSE_FAILED", message));
        return reply.code(502).send(fail("SHORT_VIDEO_PROVIDER_UNAVAILABLE", message));
      }
    }
  );

  app.get<{ Querystring: { url: string; filename?: string } }>(
    "/api/v1/tools/short-video/download",
    {
      config: REQUEST_QUOTAS.remoteFetch,
      schema: {
        querystring: ShortVideoDownloadQuerySchema,
        response: { 400: ApiFailureSchema, 502: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const mediaUrl = request.query.url.trim();
      if (!isHttpUrl(mediaUrl)) return reply.code(400).send(fail("INVALID_SHORT_VIDEO_MEDIA_URL", "下载地址无效"));
      return proxyShortVideoDownload({
        reply,
        config,
        remoteFetch,
        url: mediaUrl,
        filename: sanitizeDownloadFilename(request.query.filename || "short-video-media")
      });
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
    const providerResponse: ProviderResponse = await requestProvider(config, sourceUrl);
    if (providerResponse.code === 200) {
      const result = normalizeShortVideoProviderResult(providerResponse, { sourceUrl, requestedPlatform });
      cacheResult(config, sourceUrl, requestedPlatform, result);
      return result;
    }
    providerFailure = new ProviderResultError(providerMessage(providerResponse) || "短视频解析失败");
  } catch (error) {
    providerFailure = error;
  }

  if (detectShortVideoPlatform(sourceUrl) === "tiktok" && config.shortVideoTikTokOembedFallback) {
    try {
      const result = await requestTikTokOEmbed(config, sourceUrl, providerErrorMessage(providerFailure));
      cacheResult(config, sourceUrl, requestedPlatform, result);
      return result;
    } catch {
      // Preserve the primary provider error because it best explains why media download is unavailable.
    }
  }
  throw providerFailure instanceof Error ? providerFailure : new Error("短视频解析请求失败");
}

function isPlatformMismatch(sourceUrl: string, requestedPlatform: Exclude<ShortVideoPlatform, "unknown">) {
  return requestedPlatform !== "auto" && detectShortVideoPlatform(sourceUrl) !== requestedPlatform;
}

function isValidRequestedPlatform(value: unknown): value is Exclude<ShortVideoPlatform, "unknown"> {
  return value === "auto" || value === "douyin" || value === "xiaohongshu" || value === "tiktok";
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
