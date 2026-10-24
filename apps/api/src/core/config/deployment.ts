import type { ConfigContext } from "./context";
import { readInteger } from "@toolbox/runtime-core";
import { getEnv, readCorsOrigins } from "./environment";
export function readDeploymentConfig(context: ConfigContext) {
  const { runtime, desktopManagedCapabilities, deploymentMode, adminPin, fileEnv, environment } = context;
  return {
    runtime,
    desktopManagedCapabilities,
    edgeTtsCapabilityReady: false,
    imageAiCapabilityReady: false,
    chatterboxCapabilityReady: false,
    deploymentMode,
    adminPin,
    host: getEnv("API_HOST", fileEnv, environment)?.trim() || (deploymentMode === "lan" ? "0.0.0.0" : "127.0.0.1"),
    port: readInteger("API_PORT", getEnv("API_PORT", fileEnv, environment), 3100, 1, 65535),
    corsOrigins: readCorsOrigins(fileEnv, environment)
  };
}
