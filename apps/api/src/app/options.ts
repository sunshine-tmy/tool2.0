/** Application assembly step; called directly on the original Fastify instance. */
import { type AppConfig } from "../config";
import { type AddressResolver } from "../security/remote-fetch";
import type { DesktopShutdown } from "../lifecycle/desktop-shutdown";

export type AppOptions = {
  remoteAddressResolver?: AddressResolver;
  config?: AppConfig;
  onStage?: (stage: string) => void;
  shutdown?: DesktopShutdown;
  onShutdownStage?: (stage: string) => void;
};
