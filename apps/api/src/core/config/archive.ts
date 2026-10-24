import type { ConfigContext } from "./context";
import path from "node:path";
import { readInteger } from "@toolbox/runtime-core";
import { getEnv, resolveConfigPath } from "./environment";
export function readArchiveConfig(context: ConfigContext) {
  const { runtime, xhsArchiveDir, xhsTranslationRuntimeDir, fileEnv, environment, pathEnv } = context;
  return {
    xhsArchiveDir,
    xhsArchiveItemsDir: path.join(xhsArchiveDir, "items"),
    xhsArchiveStagingDir: path.join(xhsArchiveDir, "staging"),
    xhsArchiveIndexPath: path.join(xhsArchiveDir, "index.json"),
    xhsRuntimeDir: resolveConfigPath(
      runtime,
      pathEnv("XHS_RUNTIME_DIR")?.trim() || path.join(runtime.runtimeRoot, "xhs-downloader")
    ),
    xhsProviderUrl: getEnv("XHS_PROVIDER_URL", fileEnv, environment)?.trim() || undefined,
    xhsProviderToken: getEnv("XHS_PROVIDER_TOKEN", fileEnv, environment)?.trim() || undefined,
    xhsProviderPort: readInteger(
      "XHS_PROVIDER_PORT",
      getEnv("XHS_PROVIDER_PORT", fileEnv, environment),
      5556,
      1,
      65535
    ),
    xhsInstallTimeoutMs: readInteger(
      "XHS_INSTALL_TIMEOUT_MS",
      getEnv("XHS_INSTALL_TIMEOUT_MS", fileEnv, environment),
      20 * 60 * 1000,
      30_000,
      60 * 60 * 1000
    ),
    xhsArchiveMaxStorageBytes: readInteger(
      "XHS_ARCHIVE_MAX_STORAGE_BYTES",
      getEnv("XHS_ARCHIVE_MAX_STORAGE_BYTES", fileEnv, environment),
      100 * 1024 * 1024 * 1024,
      1
    ),
    xhsTranslationRuntimeDir,
    xhsTranslationModelDir: resolveConfigPath(
      runtime,
      pathEnv("XHS_TRANSLATION_MODEL_DIR")?.trim() || path.join(xhsTranslationRuntimeDir, "model")
    ),
    xhsTranslationProviderUrl: getEnv("XHS_TRANSLATION_PROVIDER_URL", fileEnv, environment)?.trim() || undefined,
    xhsTranslationToken: getEnv("XHS_TRANSLATION_TOKEN", fileEnv, environment)?.trim() || undefined,
    xhsTranslationProviderPort: readInteger(
      "XHS_TRANSLATION_PROVIDER_PORT",
      getEnv("XHS_TRANSLATION_PROVIDER_PORT", fileEnv, environment),
      5557,
      1,
      65535
    ),
    xhsTranslationInstallTimeoutMs: readInteger(
      "XHS_TRANSLATION_INSTALL_TIMEOUT_MS",
      getEnv("XHS_TRANSLATION_INSTALL_TIMEOUT_MS", fileEnv, environment),
      20 * 60 * 1000,
      30_000,
      60 * 60 * 1000
    ),
    xhsTranslationModelUrl:
      getEnv("XHS_TRANSLATION_MODEL_URL", fileEnv, environment)?.trim() ||
      "https://github.com/sunshine-tmy/tool2.0/releases/download/xhs-translation-v1/opus-mt-zh-en-ct2-int8-cf109095.tar.gz",
    xhsTranslationModelSha256: getEnv("XHS_TRANSLATION_MODEL_SHA256", fileEnv, environment)?.trim() || undefined,
    remoteFetchTimeoutMs: readInteger(
      "REMOTE_FETCH_TIMEOUT_MS",
      getEnv("REMOTE_FETCH_TIMEOUT_MS", fileEnv, environment),
      120000,
      1000,
      30 * 60 * 1000
    ),
    remoteMediaMaxBytes: readInteger(
      "REMOTE_MEDIA_MAX_BYTES",
      getEnv("REMOTE_MEDIA_MAX_BYTES", fileEnv, environment),
      2 * 1024 * 1024 * 1024,
      1
    )
  };
}
