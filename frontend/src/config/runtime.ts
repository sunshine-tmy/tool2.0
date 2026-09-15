const configuredApiBase = import.meta.env.VITE_API_BASE?.trim();

export const apiBaseUrl = normalizeApiBaseUrl(configuredApiBase);

export function normalizeApiBaseUrl(value?: string) {
  const base = (value?.trim() || "/api/v1").replace(/\/+$/, "");
  return /\/api$/i.test(base) ? `${base}/v1` : base;
}

export function resolveApiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${apiBaseUrl}${normalizedPath}`;
}

export function resolveBackendUrl(path: string) {
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
  return typeof window === "undefined" ? "http://127.0.0.1:5173" : window.location.origin;
}

function normalizeLegacyApiPath(value: string) {
  if (value === "/api") return "/api/v1";
  return value.replace(/^\/api\/(?!v1(?:\/|$))/i, "/api/v1/");
}
