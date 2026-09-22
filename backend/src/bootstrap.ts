/**
 * 中文模块说明：后端启动层，负责在 CLI、桌面和测试环境中以同一方式启动 Fastify。
 */
import type { AddressResolver } from "./security/remote-fetch";
import { createApp } from "./app";
import { getConfig, type AppConfig } from "./config";

export type StartBackendOptions = {
  config?: AppConfig;
  host?: string;
  port?: number;
  remoteAddressResolver?: AddressResolver;
};

export async function startBackend(options: StartBackendOptions = {}) {
  const config = options.config ?? getConfig();
  const app = await createApp({ config, remoteAddressResolver: options.remoteAddressResolver });
  const address = await app.listen({ host: options.host ?? config.host, port: options.port ?? config.port });
  return {
    app,
    address,
    origin: address.replace(/\/$/, ""),
    close: () => app.close()
  };
}
