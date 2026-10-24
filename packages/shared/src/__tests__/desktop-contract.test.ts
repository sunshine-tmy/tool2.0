import { expectTypeOf, it } from "vitest";
import type { DesktopBridge, DesktopSettingsUpdate, ShutdownInspection, ShutdownPreparation } from "../desktop/types";
import type { DesktopBridge as RootDesktopBridge } from "../index";

it("preserves desktop field optionality and root/subpath contract identity", () => {
  expectTypeOf<DesktopBridge>().toEqualTypeOf<RootDesktopBridge>();
  expectTypeOf<DesktopSettingsUpdate>().toEqualTypeOf<{ startAtLogin?: boolean; automaticUpdateChecks?: boolean }>();
  expectTypeOf<DesktopBridge["saveDiagnosticReport"]>().toEqualTypeOf<
    ((content: string) => Promise<void>) | undefined
  >();
  expectTypeOf<DesktopBridge["setAudioPlaybackActive"]>().toEqualTypeOf<
    ((active: boolean) => Promise<void>) | undefined
  >();
});

it("keeps the parent-process shutdown wire fields unchanged", () => {
  expectTypeOf<ShutdownInspection>().toEqualTypeOf<{ busy: boolean; blocked: boolean; reason?: string }>();
  expectTypeOf<ShutdownPreparation>().toEqualTypeOf<ShutdownInspection & { prepared: boolean }>();
});
