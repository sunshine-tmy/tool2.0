import path from "node:path";
import { describe, expect, it } from "vitest";
import { createDesktopRuntimeLayout, desktopBackendEntrypoint, desktopDataRoot } from "./runtime-layout";

describe("desktop runtime layout", () => {
  it("keeps mutable data below the per-user application directory", () => {
    const dataRoot = desktopDataRoot("C:\\Users\\demo\\AppData\\Local", "C:\\fallback");
    const layout = createDesktopRuntimeLayout({
      packaged: true,
      userDataRoot: dataRoot,
      resourcesPath: "C:\\Program Files\\Ecommerce Toolbox\\resources"
    });

    expect(layout.configRoot).toBe(path.join(dataRoot, "config"));
    expect(layout.storageRoot).toBe(path.join(dataRoot, "data"));
    expect(layout.modelsRoot).toBe(path.join(dataRoot, "models"));
    expect(layout.frontendDistRoot).toBe(path.join(layout.appRoot, "frontend"));
  });

  it("keeps mutable data outside a selectable NSIS installation directory", () => {
    const localAppData = "C:\\Users\\demo\\AppData\\Local";
    const dataRoot = desktopDataRoot(localAppData, "C:\\fallback");
    const nsisInstallRoot = "D:\\Applications\\Ecommerce Toolbox";

    expect(dataRoot).toBe(path.join(localAppData, "EcommerceToolboxData"));
    expect(dataRoot).not.toBe(nsisInstallRoot);
    expect(dataRoot.startsWith(`${nsisInstallRoot}${path.sep}`)).toBe(false);
    expect(nsisInstallRoot.startsWith(`${dataRoot}${path.sep}`)).toBe(false);
  });

  it("selects the copied backend entrypoint in a packaged application", () => {
    expect(desktopBackendEntrypoint(true, "C:\\app\\resources")).toBe(
      path.join("C:\\app\\resources", "backend", "dist", "desktop-entry.js")
    );
  });
});
