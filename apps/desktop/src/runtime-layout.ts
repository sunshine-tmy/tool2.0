import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRuntimeLayout, type RuntimeLayout } from "../../../backend/src/runtime/runtime-layout";

export type DesktopRuntimeLayoutOptions = {
  packaged: boolean;
  userDataRoot: string;
  resourcesPath?: string;
};

export function createDesktopRuntimeLayout(options: DesktopRuntimeLayoutOptions): RuntimeLayout {
  const workspaceRoot = fileURLToPath(new URL("../../..", import.meta.url));
  const resourceRoot = options.packaged ? (options.resourcesPath ?? process.resourcesPath) : workspaceRoot;
  const dataRoot = path.resolve(options.userDataRoot);

  return createRuntimeLayout({
    appRoot: resourceRoot,
    configRoot: path.join(dataRoot, "config"),
    storageRoot: path.join(dataRoot, "data"),
    runtimeRoot: path.join(dataRoot, "components"),
    modelsRoot: path.join(dataRoot, "models"),
    scriptsRoot: path.join(resourceRoot, "scripts"),
    frontendDistRoot: path.join(resourceRoot, "frontend")
  });
}

export function desktopDataRoot(localAppData: string | undefined, fallback: string) {
  return path.join(localAppData || fallback, "EcommerceToolbox");
}

export function desktopBackendEntrypoint(packaged: boolean, resourcesPath?: string) {
  const workspaceRoot = fileURLToPath(new URL("../../..", import.meta.url));
  return packaged
    ? path.join(resourcesPath ?? process.resourcesPath, "backend", "dist", "desktop-entry.js")
    : path.join(workspaceRoot, "backend", "dist", "desktop-entry.js");
}
