/**
 * 中文模块说明：短视频领域，负责 Provider 解析、缓存、下载和 SSRF 边界
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AppConfig } from "../config";
import type { ShortVideoParseResult } from "@toolbox/shared";

const execFileAsync = promisify(execFile);

export type ProviderResponse = {
  code?: unknown;
  msg?: unknown;
  data?: unknown;
  platform?: unknown;
  cache_status?: unknown;
};

export class ProviderResultError extends Error {}

class ProviderHttpError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

class ProviderTimeoutError extends Error {}

export async function requestProvider(config: AppConfig, sourceUrl: string) {
  const apiUrl = normalizeProviderEndpoint(config.shortVideoParseApiUrl);
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

function normalizeProviderEndpoint(value: string) {
  const apiUrl = new URL(value);
  // BugPk 已将旧的 /api/v1/short_videos 路径迁移到 /api/short_videos；
  // 自动修正历史 .env，避免升级后必须手工删除旧配置才能恢复解析。
  if (
    apiUrl.hostname.toLowerCase() === "api.bugpk.com" &&
    apiUrl.pathname.replace(/\/+$/, "") === "/api/v1/short_videos"
  ) {
    apiUrl.pathname = "/api/short_videos";
  }
  return apiUrl;
}

export async function requestTikTokOEmbed(
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

export function providerErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "";
}

export function providerMessage(response: ProviderResponse) {
  return typeof response.msg === "string" ? response.msg : "";
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

function isRetryableProviderError(error: unknown) {
  if (error instanceof ProviderTimeoutError || error instanceof TypeError) return true;
  if (error instanceof ProviderHttpError) return error.status === 408 || error.status === 429 || error.status >= 500;
  return false;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractTikTokVideoId(value: string) {
  return value.match(/(?:\/video\/|data-video-id=["'])(\d{8,})/i)?.[1];
}

function tiktokAuthorId(authorUrl: string) {
  const match = authorUrl.match(/\/@([^/?#]+)/);
  return match?.[1] || undefined;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
