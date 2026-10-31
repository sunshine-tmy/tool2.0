import { describe, expect, expectTypeOf, it } from "vitest";
import { Value } from "@sinclair/typebox/value";
import * as root from "../index";
import * as system from "../system/index";
import * as capabilities from "../system/component-packages";
import * as diagnostics from "../system/diagnostics";
import * as cleanup from "../system/cleanup";
import * as backup from "../system/data-backup";
import * as backupPreferences from "../system/backup-preferences";

describe("system contract entry", () => {
  it("reuses exactly the existing capability and diagnostic exports", () => {
    const existing = { ...capabilities, ...diagnostics, ...cleanup };
    const expected = { ...existing, ...backup, ...backupPreferences };
    expect(Object.keys(system).sort()).toEqual(Object.keys(expected).sort());
    for (const [key, value] of Object.entries(expected)) expect(Reflect.get(system, key)).toBe(value);
    for (const [key, value] of Object.entries(existing)) {
      expect(Reflect.get(system, key)).toBe(value);
      expect(Reflect.get(root, key)).toBe(value);
    }
    expect(system).not.toHaveProperty("ImageCompressResultSchema");
  });
  it("preserves job, platform and diagnostic types", () => {
    expectTypeOf<system.ComponentJob>().toEqualTypeOf<root.ComponentJob>();
    expectTypeOf<system.ComponentPlatform>().toEqualTypeOf<"win32-x64" | "darwin-arm64">();
    expectTypeOf<system.DiagnosticRun>().toEqualTypeOf<root.DiagnosticRun>();
    expectTypeOf<system.CleanupInspection>().toEqualTypeOf<root.CleanupInspection>();
    expectTypeOf<system.CleanupResult>().toEqualTypeOf<root.CleanupResult>();
  });
  it("preserves platform, job-state and confirmed-action validation", () => {
    expect(Value.Check(system.ComponentPlatformSchema, "win32-x64")).toBe(true);
    expect(Value.Check(system.ComponentPlatformSchema, "linux-x64")).toBe(false);
    expect(Value.Check(system.ComponentJobStateSchema, "queued")).toBe(true);
    expect(Value.Check(system.ComponentJobStateSchema, "success")).toBe(false);
    for (const sample of [
      { action: "restart-worker", componentId: "image-ai", confirmed: true },
      { action: "restart-worker", componentId: "image-ai", confirmed: false },
      { action: "restart-worker", componentId: "image-ai", confirmed: true, path: "untrusted" }
    ]) {
      expect(Value.Check(system.DiagnosticActionSchema, sample)).toBe(Value.Check(root.DiagnosticActionSchema, sample));
      expect([...Value.Errors(system.DiagnosticActionSchema, sample)]).toEqual([
        ...Value.Errors(root.DiagnosticActionSchema, sample)
      ]);
    }
  });
  it("preserves diagnostic error mapping without exposing raw unknown error text", () => {
    for (const error of [new Error("untrusted-detail"), { code: "WORKER_PROTOCOL_MISMATCH" }, null]) {
      expect(system.diagnosticFailure(error)).toEqual(root.diagnosticFailure(error));
    }
    expect(system.diagnosticFailure(new Error("untrusted-detail")).message).not.toContain("untrusted-detail");
  });
});
