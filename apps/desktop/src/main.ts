import path from "node:path";
import { fileURLToPath } from "node:url";
import { app } from "electron";
import { desktopInstallRoot, desktopDataRoot } from "./runtime-layout";
import { configureIsolatedTestAppDataRoot } from "./data/isolated-test-app-data";
import { createDesktopApplication } from "./app/application";
import { launchDesktopApplication } from "./app/launch";
configureIsolatedTestAppDataRoot(app, process.env, process.platform);
const workspaceRoot = fileURLToPath(new URL("../../..", import.meta.url));
const preloadPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "preload.cjs");
const desktopIconPath =
  process.platform === "darwin"
    ? undefined
    : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../assets/ecommerce-toolbox.ico");
const systemTrayIconPath =
  process.platform === "darwin"
    ? app.isPackaged
      ? path.join(process.resourcesPath, "ecommerce-toolbox-icon-24.png")
      : fileURLToPath(new URL("../assets/ecommerce-toolbox-icon-24.png", import.meta.url))
    : desktopIconPath;
const installRoot = desktopInstallRoot(app.isPackaged, app.getPath("exe"), workspaceRoot);
// Automatic migration is intentionally Windows-only. A Mac install starts in a
// clean Application Support directory and never imports an unrelated Windows tree.
const legacyDataRoot = path.join(
  process.env.LOCALAPPDATA || app.getPath("appData"),
  process.platform === "win32" ? "EcommerceToolboxData" : "EcommerceToolboxData-Windows-Legacy"
);
const dataRoot = desktopDataRoot(app.isPackaged, app.getPath("exe"), process.env.LOCALAPPDATA, app.getPath("appData"));
const application = createDesktopApplication({
  preloadPath,
  desktopIconPath,
  systemTrayIconPath,
  installRoot,
  dataRoot,
  legacyDataRoot
});
launchDesktopApplication(application);
