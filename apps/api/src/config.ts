/** Flat configuration facade; section evaluation order and precedence remain unchanged. */
import path from "node:path";
import { createDefaultRuntimeLayout } from "./runtime/default-layout";
import type { AppConfig, ConfigOptions } from "./core/config/types";
import { getEnv, loadDotEnv, resolveConfigPath, readDeploymentMode } from "./core/config/environment";
import { readDeploymentConfig } from "./core/config/deployment";
import { readStorageConfig } from "./core/config/storage";
import { readLanConfig } from "./core/config/lan";
import { readArchiveConfig } from "./core/config/archive";
import { readImageConfig } from "./core/config/image";
import { readSpeechConfig } from "./core/config/speech";
export type { AppConfig } from "./core/config/types";

export function getConfig(options: ConfigOptions = {}): AppConfig {
  const environment = options.environment ?? process.env;
  const runtime = options.layout ?? createDefaultRuntimeLayout(environment);
  const desktopManagedCapabilities = options.desktopManagedCapabilities === true;
  const dotenvPath = options.dotenvPath === undefined ? path.join(runtime.configRoot, ".env") : options.dotenvPath;
  const fileEnv = dotenvPath ? loadDotEnv([dotenvPath]) : {};
  const runtimeEnv = (key: string) => (desktopManagedCapabilities ? undefined : getEnv(key, fileEnv, environment));
  const pathEnv = (key: string) => (desktopManagedCapabilities ? undefined : getEnv(key, fileEnv, environment));
  const storageRoot = desktopManagedCapabilities
    ? runtime.storageRoot
    : resolveConfigPath(runtime, getEnv("STORAGE_ROOT", fileEnv, environment) ?? runtime.storageRoot);

  const imageAiDir = path.join(storageRoot, "image-ai");
  const edgeTtsDir = path.join(storageRoot, "edge-tts");
  const chatterboxDir = path.join(storageRoot, "chatterbox");
  const xhsArchiveDir = path.join(storageRoot, "xhs-archive");
  const xhsTranslationRuntimeDir = resolveConfigPath(
    runtime,
    pathEnv("XHS_TRANSLATION_RUNTIME_DIR")?.trim() || path.join(runtime.runtimeRoot, "xhs-translate")
  );
  const configuredUsage = getEnv("DEPLOYMENT_USAGE", fileEnv, environment)?.trim();
  const deploymentMode = readDeploymentMode(getEnv("DEPLOYMENT_MODE", fileEnv, environment));
  const adminPin = getEnv("ADMIN_PIN", fileEnv, environment)?.trim() || undefined;
  if (deploymentMode === "lan" && !adminPin) {
    throw new Error("ADMIN_PIN is required when DEPLOYMENT_MODE=lan");
  }

  const context = {
    runtime,
    desktopManagedCapabilities,
    deploymentMode,
    adminPin,
    storageRoot,
    imageAiDir,
    edgeTtsDir,
    chatterboxDir,
    xhsArchiveDir,
    xhsTranslationRuntimeDir,
    fileEnv,
    environment,
    runtimeEnv,
    pathEnv
  };
  return {
    ...readDeploymentConfig(context),
    ...readStorageConfig(context),
    ...readLanConfig(context),
    ...readArchiveConfig(context),
    ...readImageConfig(context),
    ...readSpeechConfig(context),
    deploymentUsage: configuredUsage === "internal-noncommercial" ? "internal-noncommercial" : "commercial"
  };
}
