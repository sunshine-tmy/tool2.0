import { app } from "electron";
import type { createDesktopApplication } from "./application";
/** Main calls this once; app-wide state survives all startup retries and window changes. */
export function launchDesktopApplication(application: ReturnType<typeof createDesktopApplication>) {
  app.setAppUserModelId("com.ecommercetoolbox.desktop");
  if (!app.requestSingleInstanceLock()) {
    app.quit();
  } else {
    app.on("second-instance", application.focusMainWindow);
    void application.boot();
  }
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", application.beforeQuit);
}
