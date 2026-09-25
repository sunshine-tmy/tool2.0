/** 中文模块说明：把 Electron 系统代理解析结果规整为能力包下载器可用的 HTTPS 代理地址。 */
export function componentProxyUrlFromResolution(resolution: string) {
  for (const candidate of resolution.split(";")) {
    const [kind, endpoint] = candidate.trim().split(/\s+/, 2);
    if (!kind || !endpoint) continue;
    const protocol = kind.toUpperCase() === "PROXY" ? "http:" : kind.toUpperCase() === "HTTPS" ? "https:" : undefined;
    if (!protocol) continue;
    try {
      const proxy = new URL(`${protocol}//${endpoint}`);
      if (
        proxy.hostname &&
        !proxy.username &&
        !proxy.password &&
        proxy.pathname === "/" &&
        !proxy.search &&
        !proxy.hash
      ) {
        return proxy.toString();
      }
    } catch {
      // Skip malformed PAC entries and try the next supported proxy candidate.
    }
  }
  return undefined;
}
