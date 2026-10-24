/**
 * 中文模块说明：后端启动层，负责在 CLI、桌面和测试环境中以同一方式启动 Fastify。
 */
import type { AddressResolver } from "./security/remote-fetch";
import { createApp } from "./app";
import { getConfig, type AppConfig } from "./config";
import { DesktopShutdown } from "./lifecycle/desktop-shutdown";

export type StartBackendOptions = {
  config?: AppConfig;
  host?: string;
  port?: number;
  remoteAddressResolver?: AddressResolver;
  onStage?: (stage: string) => void;
  onShutdownStage?: (stage: string) => void;
};

export async function startBackend(options: StartBackendOptions = {}) {
  const config = options.config ?? getConfig();
  const shutdown = new DesktopShutdown();
  const app = await createApp({
    config,
    remoteAddressResolver: options.remoteAddressResolver,
    onStage: options.onStage,
    onShutdownStage: options.onShutdownStage,
    shutdown
  });
  options.onStage?.("service");
  let address: string;
  try {
    address = await app.listen({ host: options.host ?? config.host, port: options.port ?? config.port });
  } catch (error) {
    await app.close().catch(() => undefined);
    throw error;
  }
  return {
    app,
    address,
    origin: address.replace(/\/$/, ""),
    shutdown,
    close: () => app.close()
  };
}
