/** Default-layout compatibility only; no data migration and no configuration reads at import time. */
import fs from "node:fs";
import path from "node:path";
import { getProjectRoot, isBuiltProjectModule } from "../project-root";
import { createDevelopmentRuntimeLayout } from "./runtime-layout";

export function createDefaultRuntimeLayout(
  environment: Record<string, string | undefined>,
  { appRoot = getProjectRoot(), compiled = isBuiltProjectModule() }: { appRoot?: string; compiled?: boolean } = {}
) {
  const legacyRoot = environment.TOOLBOX_LEGACY_DATA_ROOT?.trim();
  if (legacyRoot) {
    if (!path.isAbsolute(legacyRoot))
      throw new Error("TOOLBOX_LEGACY_DATA_ROOT must be an absolute existing directory");
    const root = path.resolve(legacyRoot);
    if (!fs.statSync(root).isDirectory()) throw new Error("TOOLBOX_LEGACY_DATA_ROOT must be an existing directory");
    return createDevelopmentRuntimeLayout({
      appRoot,
      configRoot: root,
      storageRoot: path.join(root, "storage"),
      runtimeRoot: path.join(root, ".runtime"),
      modelsRoot: path.join(root, "models")
    });
  }

  if (compiled) {
    const previousRoot = path.dirname(path.resolve(appRoot));
    for (const marker of [".env", "storage", ".runtime", "models"]) {
      try {
        fs.lstatSync(path.join(previousRoot, marker));
      } catch (error) {
        if (["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) continue;
        throw error;
      }
      throw new Error(
        `LEGACY_RUNTIME_ROOT_DETECTED: the previous compiled root (${previousRoot}) contains possible configuration/data. ` +
          "Startup stopped without moving data. Review it and explicitly set TOOLBOX_LEGACY_DATA_ROOT " +
          "to the absolute data root you intend to use (or pass an explicit runtime layout)."
      );
    }
  }
  return createDevelopmentRuntimeLayout({ appRoot });
}
