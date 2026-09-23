import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createDesktopRuntimeLayout,
  desktopBackendEntrypoint,
  desktopDataRoot,
  desktopInstallRoot
} from "./runtime-layout";

describe("desktop runtime layout", () => {
  it("places packaged mutable data under the selected installation directory", () => {
    const installRoot = desktopInstallRoot(
      true,
      "D:\\Applications\\Ecommerce Toolbox\\EcommerceToolbox.exe",
      "C:\\fallback"
    );
    const dataRoot = desktopDataRoot(
      true,
      "D:\\Applications\\Ecommerce Toolbox\\EcommerceToolbox.exe",
      "C:\\Users\\demo\\AppData\\Local",
      "C:\\fallback"
    );
    const layout = createDesktopRuntimeLayout({
      packaged: true,
      installRoot,
      userDataRoot: dataRoot,
      resourcesPath: "C:\\Program Files\\Ecommerce Toolbox\\resources"
    });

    expect(installRoot).toBe("D:\\Applications\\Ecommerce Toolbox");
    expect(dataRoot).toBe(path.join(installRoot, "data"));
    expect(layout.configRoot).toBe(path.join(dataRoot, "config"));
    expect(layout.storageRoot).toBe(path.join(dataRoot, "data"));
    expect(layout.modelsRoot).toBe(path.join(dataRoot, "models"));
    expect(layout.frontendDistRoot).toBe(path.join(layout.appRoot, "frontend"));
  });

  it("keeps development data on its existing per-user path", () => {
    const localAppData = "C:\\Users\\demo\\AppData\\Local";
    const dataRoot = desktopDataRoot(false, "C:\\workspace\\EcommerceToolbox.exe", localAppData, "C:\\fallback");

    expect(dataRoot).toBe(path.join(localAppData, "EcommerceToolboxData"));
  });

  it("selects the copied backend entrypoint in a packaged application", () => {
    expect(desktopBackendEntrypoint(true, "C:\\app\\resources")).toBe(
      path.join("C:\\app\\resources", "backend", "dist", "desktop-entry.js")
    );
  });
});
