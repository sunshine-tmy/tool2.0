import { app } from "electron";
import type { createDesktopApplication } from "./application";
/** Main calls this once; app-wide state survives all startup retries and window changes. */
export function launchDesktopApplication(application: ReturnType<typeof createDesktopApplication>) {
  app.setAppUserModelId("com.ecommercetoolbox.desktop");
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }
  app.on("second-instance", application.focusMainWindow);
  if (process.platform === "darwin") app.on("activate", application.focusMainWindow);
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
  app.on("before-quit", application.beforeQuit);
  void application.boot();
}
