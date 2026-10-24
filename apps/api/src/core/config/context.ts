import type { AppConfig } from "./types";
export type ConfigContext = Pick<
  AppConfig,
  | "runtime"
  | "desktopManagedCapabilities"
  | "deploymentMode"
  | "adminPin"
  | "storageRoot"
  | "imageAiDir"
  | "edgeTtsDir"
  | "chatterboxDir"
  | "xhsArchiveDir"
  | "xhsTranslationRuntimeDir"
> & {
  fileEnv: Record<string, string>;
  environment: Record<string, string | undefined>;
  runtimeEnv: (key: string) => string | undefined;
  pathEnv: (key: string) => string | undefined;
};
