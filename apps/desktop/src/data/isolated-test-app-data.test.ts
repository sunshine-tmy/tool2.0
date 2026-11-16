import { mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { configureIsolatedTestAppDataRoot } from "./isolated-test-app-data";

function appPort({ isPackaged = true, home = "/Users/example" } = {}) {
  return {
    isPackaged,
    getPath: vi.fn((_name: "home") => home),
    setPath: vi.fn((_name: "appData" | "cache", _value: string) => undefined)
  };
}

describe("isolated packaged app data root", () => {
  it("leaves normal launches on Electron's default paths", () => {
    const app = appPort();
    expect(configureIsolatedTestAppDataRoot(app, {}, "darwin")).toBe(false);
    expect(app.setPath).not.toHaveBeenCalled();
  });

  it("redirects app data and cache only for an explicitly enabled packaged macOS test run", () => {
    const app = appPort();
    const root = path.join(os.tmpdir(), "toolbox-isolated-app-data");
    expect(
      configureIsolatedTestAppDataRoot(
        app,
        {
          TOOLBOX_ENABLE_ISOLATED_TEST_APP_DATA: "1",
          TOOLBOX_ISOLATED_TEST_APP_DATA_ROOT: root
        },
        "darwin"
      )
    ).toBe(true);
    const resolvedRoot = path.join(realpathSync(os.tmpdir()), path.basename(root));
    expect(app.setPath.mock.calls).toEqual([
      ["appData", resolvedRoot],
      ["cache", path.join(resolvedRoot, "cache")]
    ]);
  });

  it("allows an explicitly isolated, source-managed macOS acceptance run", () => {
    const app = appPort({ isPackaged: false });
    const root = path.join(os.tmpdir(), "toolbox-isolated-source-app-data");
    expect(
      configureIsolatedTestAppDataRoot(
        app,
        {
          TOOLBOX_ENABLE_ISOLATED_TEST_APP_DATA: "1",
          TOOLBOX_ISOLATED_TEST_APP_DATA_ROOT: root,
          TOOLBOX_SOURCE_MANAGED: "1"
        },
        "darwin"
      )
    ).toBe(true);
    const resolvedRoot = path.join(realpathSync(os.tmpdir()), path.basename(root));
    expect(app.setPath.mock.calls).toEqual([
      ["appData", resolvedRoot],
      ["cache", path.join(resolvedRoot, "cache")]
    ]);
  });

  it("rejects partial, non-test, unpackaged, non-macOS, relative and in-home overrides", () => {
    const enabled = {
      TOOLBOX_ENABLE_ISOLATED_TEST_APP_DATA: "1",
      TOOLBOX_ISOLATED_TEST_APP_DATA_ROOT: path.join(os.tmpdir(), "toolbox-isolated-app-data")
    };
    expect(() =>
      configureIsolatedTestAppDataRoot(appPort(), { TOOLBOX_ISOLATED_TEST_APP_DATA_ROOT: "/tmp/x" }, "darwin")
    ).toThrow("同时设置");
    expect(() => configureIsolatedTestAppDataRoot(appPort({ isPackaged: false }), enabled, "darwin")).toThrow(
      "macOS 打包或受管源码验收"
    );
    expect(() => configureIsolatedTestAppDataRoot(appPort(), enabled, "win32")).toThrow("macOS 打包或受管源码验收");
    expect(() =>
      configureIsolatedTestAppDataRoot(
        appPort(),
        { ...enabled, TOOLBOX_ISOLATED_TEST_APP_DATA_ROOT: "relative/path" },
        "darwin"
      )
    ).toThrow("绝对路径");
    expect(() =>
      configureIsolatedTestAppDataRoot(
        appPort({ home: "/Users/example" }),
        { ...enabled, TOOLBOX_ISOLATED_TEST_APP_DATA_ROOT: "/Users/example/Library/Application Support" },
        "darwin"
      )
    ).toThrow("主目录之外");
  });

  it("rejects an out-of-home path that resolves through a symlink into the home directory", () => {
    const scratch = mkdtempSync(path.join(os.tmpdir(), "toolbox-isolated-home-link-"));
    const canonicalScratch = realpathSync(scratch);
    const homeAlias = path.join(canonicalScratch, "home-alias");
    const aliasType = process.platform === "win32" ? "junction" : "dir";
    symlinkSync(os.homedir(), homeAlias, aliasType);
    const root = path.join(homeAlias, "temporary-data");

    try {
      expect(() =>
        configureIsolatedTestAppDataRoot(
          appPort({ home: os.homedir() }),
          {
            TOOLBOX_ENABLE_ISOLATED_TEST_APP_DATA: "1",
            TOOLBOX_ISOLATED_TEST_APP_DATA_ROOT: root
          },
          "darwin"
        )
      ).toThrow("主目录之外");
    } finally {
      rmSync(canonicalScratch, { recursive: true, force: true });
    }
  });
});
