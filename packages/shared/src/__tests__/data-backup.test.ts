import { expect, expectTypeOf, it } from "vitest";
import type { Static } from "@sinclair/typebox";
import { BackupSelectionSchema, type BackupSelection } from "../system/data-backup";
import { backupModules, isBackupSelection, isBackupPreviewRequest, cleanBackupPreferences } from "../system/index";
it("has six business modules and requires a bounded unique selection without filesystem capabilities", () => {
  expect(backupModules).toHaveLength(6);
  expectTypeOf<Static<typeof BackupSelectionSchema>>().toEqualTypeOf<BackupSelection>();
  expect(isBackupSelection({ modules: backupModules.map((m) => m.id) })).toBe(true);
  for (const value of [
    { modules: [] },
    { modules: ["speech", "speech"] },
    { modules: ["other"] },
    { modules: ["speech"], path: "C:/data" }
  ])
    expect(isBackupSelection(value)).toBe(false);
  expect(
    isBackupPreviewRequest({
      selectionId: "12345678-1234-1234-1234-123456789012",
      modules: ["speech"],
      mode: "replace"
    })
  ).toBe(true);
  expect(isBackupPreviewRequest({ selectionId: "../file", modules: ["speech"], mode: "merge" })).toBe(false);
});
it("exports only supported client preferences and restores bounded paused queue data", () => {
  expect(
    cleanBackupPreferences({
      ADMIN_PIN: "secret",
      "archive.view": "bad",
      "audio.lastGroup": "../group",
      "audio.recentGroups": "not json"
    })
  ).toEqual({});
  const prefs = cleanBackupPreferences({
    "archive.view": "card",
    "audio.recentGroups": JSON.stringify(["group123"]),
    "audio.player": JSON.stringify({
      queue: [{ itemId: "item123", entryId: "entry123" }],
      volume: 100,
      gap: -1,
      mode: "bad",
      position: -1,
      playing: true,
      token: "secret"
    })
  });
  expect(JSON.parse(prefs["audio.player"])).toEqual({
    queue: [{ itemId: "item123", entryId: "entry123" }],
    currentId: "",
    position: 0,
    volume: 1,
    gap: 0,
    mode: "sequence"
  });
  expect(JSON.stringify(prefs)).not.toContain("secret");
});
