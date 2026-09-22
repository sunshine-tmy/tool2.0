import { describe, expect, it } from "vitest";
import { isSquirrelFirstRun, squirrelLifecycleCommand } from "./squirrel-events";

describe("Squirrel lifecycle commands", () => {
  const executable = "C:\\Users\\user\\AppData\\Local\\EcommerceToolbox\\app-1.0.0\\EcommerceToolbox.exe";

  it.each([
    ["--squirrel-install", ["--createShortcut", "EcommerceToolbox.exe"]],
    ["--squirrel-updated", ["--createShortcut", "EcommerceToolbox.exe"]],
    ["--squirrel-uninstall", ["--removeShortcut", "EcommerceToolbox.exe"]],
    ["--squirrel-obsolete", []]
  ])("maps %s to the constrained Update.exe action", (event, args) => {
    expect(squirrelLifecycleCommand(["app", event], executable)).toEqual({
      executable: "C:\\Users\\user\\AppData\\Local\\EcommerceToolbox\\Update.exe",
      args
    });
  });

  it("does not spawn an updater for normal startup and skips first-run update checks", () => {
    expect(squirrelLifecycleCommand(["app"], executable)).toBeUndefined();
    expect(isSquirrelFirstRun(["app", "--squirrel-firstrun"])).toBe(true);
    expect(isSquirrelFirstRun(["app", "--squirrel-updated"])).toBe(false);
  });
});
