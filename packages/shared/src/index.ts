/**
 * 中文模块说明：共享契约层，负责跨前后端复用的类型、Schema、响应和领域常量
 */
export * from "./common/api-response";
export * from "./common/api-schema";
export * from "./common/worker-protocol";
export * from "./image/image-options";
export * from "./image/compress-result";
export * from "./system/cleanup";
export * from "./image/image-ai";
export * from "./image/product-image";
export * from "./speech/edge-tts";
export * from "./speech/edge-tts-batch";
export * from "./speech/chatterbox";
export * from "./lan/lan-file";
export * from "./lan/lan-note";
export * from "./lan/lan-transfer-api";
export * from "./common/tools";
export * from "./archive/xhs-archive";
export * from "./archive/xhs-text";
export * from "./archive/media-archive-link";
export * from "./archive/content-archive";
export * from "./archive/douyin-runtime";
export * from "./system/component-packages";
export * from "./audio-library/contracts";
export * from "./system/diagnostics";
export * from "./lan/lan-access";
export type {
  DesktopBridge,
  DesktopMigrationSummary,
  DesktopSettings,
  DesktopSettingsUpdate,
  DesktopSettingsState,
  StartupDataMigrationState,
  DesktopRootMigrationResult,
  DesktopDataMigrationResult,
  DesktopDataRollbackResult,
  DesktopLegacyDirectorySelection,
  DesktopUpdateCheck,
  StartupStepId,
  StartupSnapshot,
  ShutdownInspection,
  ShutdownPreparation
} from "./desktop/types";
