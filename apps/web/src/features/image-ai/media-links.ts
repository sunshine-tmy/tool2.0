import { resolveBackendUrl } from "../../shared/config/runtime";
export function absoluteImageAiUrl(url: string) {
  return resolveBackendUrl(url);
}

export function resultDownloadUrl(url: string) {
  const separator = url.includes("?") ? "&" : "?";
  return absoluteImageAiUrl(`${url}${separator}download=1`);
}

export function triggerImageAiDownload(url: string) {
  const anchor = document.createElement("a");
  anchor.href = absoluteImageAiUrl(url);
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
