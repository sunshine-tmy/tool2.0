import type { FastifyInstance } from "fastify";
import { execFile } from "node:child_process";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { promisify } from "node:util";
import {
  detectShortVideoPlatform,
  extractFirstUrl,
  fail,
  isSupportedShortVideoUrl,
  normalizeShortVideoProviderResult,
  ok,
  type ShortVideoParseInput,
  type ShortVideoPlatform
} from "@toolbox/shared";
import type { AppConfig } from "../config";

const execFileAsync = promisify(execFile);

type RegisterShortVideoRoutesOptions = {
  app: FastifyInstance;
  config: AppConfig;
};

type ProviderResponse = {
  code?: unknown;
  msg?: unknown;
  data?: unknown;
  platform?: unknown;
  cache_status?: unknown;
};

const platformParam: Record<Exclude<ShortVideoPlatform, "unknown">, string | undefined> = {
  auto: undefined,
  douyin: "douyin",
  xiaohongshu: "xiaohongshu"
};

export async function registerShortVideoRoutes({ app, config }: RegisterShortVideoRoutesOptions) {
  app.post("/api/tools/short-video/parse", async (request, reply) => {
    const body = request.body as Partial<ShortVideoParseInput> | undefined;
    const rawInput = typeof body?.input === "string" ? body.input.trim() : "";
    const sourceUrl = extractFirstUrl(rawInput) ?? rawInput;
    const requestedPlatform = body?.platform ?? "auto";

    if (!sourceUrl) {
      return reply.code(400).send(fail("SHORT_VIDEO_URL_REQUIRED", "请输入抖音或小红书分享链接"));
    }

    if (!isValidRequestedPlatform(requestedPlatform)) {
      return reply.code(400).send(fail("INVALID_SHORT_VIDEO_PLATFORM", "不支持的平台参数"));
    }

    if (!isSupportedShortVideoUrl(sourceUrl)) {
      return reply
        .code(400)
        .send(fail("UNSUPPORTED_SHORT_VIDEO_URL", "当前仅支持抖音和小红书公开分享链接"));
    }

    try {
      const providerResponse = await requestProvider(config, sourceUrl, requestedPlatform);
      if (providerResponse.code !== 200) {
        return reply
          .code(400)
          .send(fail("SHORT_VIDEO_PARSE_FAILED", getProviderMessage(providerResponse) || "短视频解析失败"));
      }

      const result = normalizeShortVideoProviderResult(providerResponse, {
        sourceUrl,
        requestedPlatform
      });

      return ok(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "短视频解析请求失败";
      return reply.code(502).send(fail("SHORT_VIDEO_PROVIDER_UNAVAILABLE", message));
    }
  });

  app.get("/api/tools/short-video/download", async (request, reply) => {
    const query = request.query as { url?: string; filename?: string };
    const mediaUrl = typeof query.url === "string" ? query.url.trim() : "";
    const filename = sanitizeDownloadFilename(query.filename || "short-video-media");

    if (!isHttpUrl(mediaUrl)) {
      return reply.code(400).send(fail("INVALID_SHORT_VIDEO_MEDIA_URL", "下载地址无效"));
    }

    try {
      const response = await fetch(mediaUrl, {
        headers: {
          accept: "*/*",
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36"
        }
      });

      if (!response.ok || !response.body) {
        return reply.code(502).send(fail("SHORT_VIDEO_DOWNLOAD_FAILED", `媒体下载失败：${response.status}`));
      }

      const contentType = response.headers.get("content-type") || "application/octet-stream";
      const contentLength = response.headers.get("content-length");
      reply.header("content-type", contentType);
      reply.header("content-disposition", createAttachmentDisposition(filename));
      if (contentLength) {
        reply.header("content-length", contentLength);
      }

      return reply.send(Readable.fromWeb(response.body as unknown as NodeReadableStream<Uint8Array>));
    } catch (error) {
      const message = error instanceof Error ? error.message : "媒体下载失败";
      return reply.code(502).send(fail("SHORT_VIDEO_DOWNLOAD_FAILED", message));
    }
  });
}

async function requestProvider(config: AppConfig, sourceUrl: string, requestedPlatform: Exclude<ShortVideoPlatform, "unknown">) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.shortVideoParseTimeoutMs);
  const apiUrl = new URL(config.shortVideoParseApiUrl);
  apiUrl.searchParams.set("url", sourceUrl);

  const providerPlatform = platformParam[requestedPlatform];
  if (providerPlatform && detectShortVideoPlatform(sourceUrl) !== providerPlatform) {
    apiUrl.searchParams.set("platform", providerPlatform);
  }

  const providerUrl = apiUrl.toString();

  try {
    const response = await fetch(providerUrl, {
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36"
      }
    });

    if (!response.ok) {
      throw new Error(`解析服务响应异常：${response.status}`);
    }

    return (await response.json()) as ProviderResponse;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("解析服务请求超时");
    }
    const fallbackResult = await requestProviderWithPowerShell(providerUrl, config.shortVideoParseTimeoutMs);
    if (fallbackResult) {
      return fallbackResult;
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
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      {
        timeout: timeoutMs + 1000,
        encoding: "utf8",
        maxBuffer: 5 * 1024 * 1024
      }
    );
    return JSON.parse(stdout) as ProviderResponse;
  } catch {
    return null;
  }
}

function toPowerShellString(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function isValidRequestedPlatform(value: unknown): value is Exclude<ShortVideoPlatform, "unknown"> {
  return value === "auto" || value === "douyin" || value === "xiaohongshu";
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
  const filename = value.trim().replace(/[\\/:*?"<>|]+/g, "").slice(0, 160);
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
