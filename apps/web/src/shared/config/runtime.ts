/**
 * 中文模块说明：前端应用层，负责 页面布局、共享组件、服务或工具能力
 */
const configuredApiBase = import.meta.env.VITE_API_BASE?.trim();

// 所有业务 API 都从同一基地址派生，默认使用相对路径以兼容 Vite 代理和生产反向代理。
export const apiBaseUrl = normalizeApiBaseUrl(configuredApiBase);

export function normalizeApiBaseUrl(value?: string) {
  // 兼容旧配置中的 /api，并统一补齐 /api/v1，避免页面分别拼接新旧接口路径。
  const base = (value?.trim() || "/api/v1").replace(/\/+$/, "");
  return /\/api$/i.test(base) ? `${base}/v1` : base;
}

export function resolveApiUrl(path: string) {
  // 已经是绝对 URL 时原样返回，内部相对路径则统一拼到 API 基地址上。
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${apiBaseUrl}${normalizedPath}`;
}

export function resolveBackendUrl(path: string) {
  // 下载/媒体链接可能来自后端或外部 CDN；仅对路径做旧 /api 兼容，不改动外部域名。
  if (/^https?:\/\//i.test(path)) {
    const url = new URL(path);
    url.pathname = normalizeLegacyApiPath(url.pathname);
    return url.toString();
  }
  const normalizedPath = normalizeLegacyApiPath(path);
  if (!/^https?:\/\//i.test(apiBaseUrl)) return normalizedPath;
  return new URL(normalizedPath, new URL(apiBaseUrl).origin).toString();
}

export function currentWebUrl() {
  // SSR/测试环境没有 window 时回退到本地开发地址，浏览器中始终使用当前 origin。
  return typeof window === "undefined" ? "http://127.0.0.1:5173" : window.location.origin;
}

function normalizeLegacyApiPath(value: string) {
  if (value === "/api") return "/api/v1";
  return value.replace(/^\/api\/(?!v1(?:\/|$))/i, "/api/v1/");
}
