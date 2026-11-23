/** Desktop-only launch defaults. API and managed workers still bind a free dynamic port at startup. */
export const DESKTOP_SERVICE_PORTS = { api: 46310, lan: 46373, archive: 46356, translation: 46357 } as const;

export function desktopServiceEnvironment(environment: Record<string, string | undefined>) {
  return {
    ...environment,
    API_HOST: "127.0.0.1",
    API_PORT: String(DESKTOP_SERVICE_PORTS.api),
    LAN_TRANSFER_WEB_PORT: environment.TOOLBOX_DESKTOP_LAN_PORT?.trim() || String(DESKTOP_SERVICE_PORTS.lan),
    XHS_PROVIDER_PORT: String(DESKTOP_SERVICE_PORTS.archive),
    XHS_TRANSLATION_PROVIDER_PORT: String(DESKTOP_SERVICE_PORTS.translation),
    // Provider URLs inherited from a development shell must not bypass the desktop-owned workers.
    XHS_PROVIDER_URL: undefined,
    XHS_TRANSLATION_PROVIDER_URL: undefined
  };
}
