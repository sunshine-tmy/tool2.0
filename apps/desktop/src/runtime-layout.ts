import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRuntimeLayout, type RuntimeLayout } from "../../../backend/src/runtime/runtime-layout";

export type DesktopRuntimeLayoutOptions = {
  packaged: boolean;
  installRoot?: string;
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

export function desktopInstallRoot(packaged: boolean, executablePath: string, developmentRoot: string) {
  return path.resolve(packaged ? path.dirname(executablePath) : developmentRoot);
}

export function desktopDataRoot(
  packaged: boolean,
  executablePath: string,
  localAppData: string | undefined,
  fallback: string
) {
  // In packaged builds the installer-selected directory owns every persistent
  // app file. Development/Web keeps the historical per-user data location.
  return packaged
    ? path.join(desktopInstallRoot(true, executablePath, fallback), "data")
    : path.join(localAppData || fallback, "EcommerceToolboxData");
}

export function desktopBackendEntrypoint(packaged: boolean, resourcesPath?: string) {
  const workspaceRoot = fileURLToPath(new URL("../../..", import.meta.url));
  return packaged
    ? path.join(resourcesPath ?? process.resourcesPath, "backend", "dist", "desktop-entry.js")
    : path.join(workspaceRoot, "backend", "dist", "desktop-entry.js");
}
