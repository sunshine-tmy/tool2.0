import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DesktopBridge, StartupSnapshot } from "@toolbox/shared/desktop";

const mock = vi.hoisted(() => ({
  expose: vi.fn(),
  invoke: vi.fn<(channel: string, ...args: unknown[]) => Promise<unknown>>(),
  on: vi.fn(),
  remove: vi.fn()
}));
vi.mock("electron", () => ({
  contextBridge: { exposeInMainWorld: mock.expose },
  ipcRenderer: { invoke: mock.invoke, on: mock.on, removeListener: mock.remove }
}));

let bridge: Required<DesktopBridge>;
beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  mock.invoke.mockResolvedValue(undefined);
  await import("./preload");
  bridge = mock.expose.mock.calls[0][1] as Required<DesktopBridge>;
});

const calls = [
  ["getStartupDiagnostics", "diagnostics:startup-state", []],
  ["retryStartup", "diagnostics:startup-retry", []],
  ["copyStartupDiagnostics", "diagnostics:startup-copy", []],
  ["exportStartupDiagnostics", "diagnostics:startup-export", []],
  ["revealStartupLogs", "diagnostics:startup-logs", []],
  ["exitStartupDiagnostics", "diagnostics:startup-exit", []],
  ["saveDiagnosticReport", "desktop:save-diagnostic-report", ['{"schemaVersion":1}']],
  ["getVersion", "desktop:get-version", []],
  ["setAudioPlaybackActive", "desktop:audio-playback", [true]],
  ["getSettings", "desktop:get-settings", []],
  ["getStartupDataMigrationState", "desktop:get-startup-data-migration", []],
  ["migrateStartupData", "desktop:migrate-startup-data", []],
  ["chooseFreshStartupData", "desktop:choose-fresh-startup-data", []],
  ["exitStartupMigration", "desktop:exit-startup-migration", []],
  ["updateSettings", "desktop:update-settings", [{ startAtLogin: true, automaticUpdateChecks: false }]],
  ["checkForUpdates", "desktop:check-for-updates", []],
  ["revealDataDirectory", "desktop:reveal-data-directory", []],
  ["selectLegacyDataDirectory", "desktop:select-legacy-data-directory", []],
  ["importLegacyData", "desktop:import-legacy-data", ["opaque-selection-id"]],
  ["rollbackDataMigration", "desktop:rollback-data-migration", ["migration-id"]]
] as const satisfies ReadonlyArray<readonly [keyof Required<DesktopBridge>, string, readonly unknown[]]>;

describe("fixed-capability desktop preload", () => {
  it("exposes exactly the existing methods once, with no generic IPC/file/process API", () => {
    expect(mock.expose).toHaveBeenCalledTimes(1);
    expect(mock.expose.mock.calls[0][0]).toBe("toolboxDesktop");
    expect(Object.keys(bridge).sort()).toEqual([...calls.map(([method]) => method), "onStartupDiagnostics"].sort());
    expect(mock.invoke).not.toHaveBeenCalled();
  });

  it.each(calls)("%s preserves its fixed channel, arguments and raw result", async (method, channel, args) => {
    const result = { sentinel: "existing IPC payload", extraField: true };
    mock.invoke.mockResolvedValue(result);
    await expect(Reflect.apply(bridge[method], bridge, args)).resolves.toBe(result);
    expect(mock.invoke).toHaveBeenCalledExactlyOnceWith(channel, ...args);
  });

  it("propagates rejected IPC calls and does not fabricate a recovered migration result", async () => {
    const error = new Error("existing sender/operation rejection");
    mock.invoke.mockRejectedValueOnce(error);
    await expect(bridge.importLegacyData("selected-id")).rejects.toBe(error);
    await expect(bridge.migrateStartupData()).resolves.toBeUndefined();
  });

  it("forwards only snapshots and removes exactly the subscription's listener", () => {
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = bridge.onStartupDiagnostics(first);
    const stopSecond = bridge.onStartupDiagnostics(second);
    expect(mock.on.mock.calls.map(([channel]) => channel)).toEqual([
      "diagnostics:startup-updated",
      "diagnostics:startup-updated"
    ]);
    const listener = mock.on.mock.calls[0][1] as (event: unknown, snapshot: StartupSnapshot) => void;
    const snapshot = { revision: 42 } as StartupSnapshot;
    listener({ sender: "not exposed" }, snapshot);
    expect(first).toHaveBeenCalledExactlyOnceWith(snapshot);
    expect(second).not.toHaveBeenCalled();
    stopFirst();
    expect(mock.remove).toHaveBeenCalledExactlyOnceWith("diagnostics:startup-updated", listener);
    stopSecond();
    expect(mock.remove.mock.calls[1]).toEqual(["diagnostics:startup-updated", mock.on.mock.calls[1][1]]);
  });
});
