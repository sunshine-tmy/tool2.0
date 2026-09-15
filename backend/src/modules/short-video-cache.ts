/**
 * 中文模块说明：短视频领域，负责 Provider 解析、缓存、下载和 SSRF 边界
 */
import type { AppConfig } from "../config";
import type { ShortVideoParseResult, ShortVideoPlatform } from "@toolbox/shared";

type RequestedPlatform = Exclude<ShortVideoPlatform, "unknown">;
const resultCaches = new WeakMap<AppConfig, Map<string, { expiresAt: number; result: ShortVideoParseResult }>>();

export function readCachedResult(config: AppConfig, sourceUrl: string, requestedPlatform: RequestedPlatform) {
  if (config.shortVideoCacheTtlMs <= 0) return undefined;
  const cache = resultCaches.get(config);
  const entry = cache?.get(cacheKey(sourceUrl, requestedPlatform));
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    cache?.delete(cacheKey(sourceUrl, requestedPlatform));
    return undefined;
  }
  return {
    ...entry.result,
    media: [...entry.result.media],
    warnings: [...entry.result.warnings],
    cacheStatus: "local-hit"
  };
}

export function cacheResult(
  config: AppConfig,
  sourceUrl: string,
  requestedPlatform: RequestedPlatform,
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

function cacheKey(sourceUrl: string, requestedPlatform: RequestedPlatform) {
  return `${requestedPlatform}\u0000${sourceUrl}`;
}
