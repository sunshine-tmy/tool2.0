import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRuntimeLayout, type RuntimeLayout } from "../../../backend/src/runtime/runtime-layout";

type DesktopRuntimeLayoutOptions = {
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

export function desktopInstallRoot(
  packaged: boolean,
  executablePath: string,
  developmentRoot: string,
  platform: NodeJS.Platform = process.platform
) {
  if (!packaged) return path.resolve(developmentRoot);
  if (platform === "darwin") {
    const macPath = path.posix;
    let current = macPath.resolve(macPath.dirname(executablePath));
    while (macPath.dirname(current) !== current) {
      if (current.toLowerCase().endsWith(".app")) return current;
      current = macPath.dirname(current);
    }
    throw new Error("Unable to locate the enclosing macOS .app bundle");
  }
  return path.resolve(path.dirname(executablePath));
}

export function desktopDataRoot(
  packaged: boolean,
  executablePath: string,
  localAppData: string | undefined,
  fallback: string,
  platform: NodeJS.Platform = process.platform
) {
  // macOS app bundles are read-only and may be moved/replaced during updates.
  // Keep all mutable state in the user's Application Support directory.
  if (platform === "darwin") return path.posix.join(fallback, "EcommerceToolboxData");
  // Windows installer-selected directory owns persistent app files. Development/Web
  // keeps the historical per-user data location.
  return packaged
    ? path.join(desktopInstallRoot(true, executablePath, fallback, platform), "data")
    : path.join(localAppData || fallback, "EcommerceToolboxData");
}

export function desktopBackendEntrypoint(packaged: boolean, resourcesPath?: string) {
  const workspaceRoot = fileURLToPath(new URL("../../..", import.meta.url));
  return packaged
    ? path.join(resourcesPath ?? process.resourcesPath, "backend", "dist", "desktop-entry.js")
    : path.join(workspaceRoot, "backend", "dist", "desktop-entry.js");
}
