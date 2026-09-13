const configuredApiBase = import.meta.env.VITE_API_BASE?.trim();

export const apiBaseUrl = (configuredApiBase || "/api/v1").replace(/\/$/, "");

export function resolveApiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${apiBaseUrl}${normalizedPath}`;
}

export function resolveBackendUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  if (!/^https?:\/\//i.test(apiBaseUrl)) return path;
  return new URL(path, new URL(apiBaseUrl).origin).toString();
}

export function currentWebUrl() {
  return typeof window === "undefined" ? "http://127.0.0.1:5173" : window.location.origin;
}
