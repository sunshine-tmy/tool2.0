import { expect, it } from "vitest";
import { Value } from "@sinclair/typebox/value";
import * as entry from "../audio-convert";
import * as root from "../index";
it("exports one conversion contract through the dedicated and root entries", () => {
  for (const [key, value] of Object.entries(entry)) expect(Reflect.get(root, key)).toBe(value);
  expect(entry.AUDIO_CONVERT_MAX_FILES).toBe(1000);
  expect(entry.AUDIO_CONVERT_MAX_BYTES).toBe(100 * 1024 * 1024);
});
it("rejects persisted keys, source paths, unknown states and unsupported bitrates", () => {
  const job = {
    id: "conversion123",
    name: "音频.flac",
    bitrate: 192,
    status: "pending",
    progress: 0,
    createdAt: "2026-11-01",
    updatedAt: "2026-11-01"
  };
  expect(Value.Check(entry.AudioConvertJobSchema, job)).toBe(true);
  expect(Value.Check(entry.AudioConvertJobSchema, { ...job, sourceSha256: "a".repeat(64) })).toBe(true);
  for (const patch of [
    { ekey: "private" },
    { path: "C:/secret" },
    { status: "unknown" },
    { bitrate: 100 },
    { progress: 101 }
  ])
    expect(Value.Check(entry.AudioConvertJobSchema, { ...job, ...patch })).toBe(false);
  expect(Value.Check(entry.AudioConvertJobSchema, { ...job, sourceSha256: "invalid" })).toBe(false);
});
it("bounds all-result selections and rejects duplicate or unsafe IDs", () => {
  const check = (ids: string[], total = ids.length) => Value.Check(entry.AudioConvertSelectionSchema, { ids, total });
  expect(check([])).toBe(true);
  expect(
    check(
      Array.from({ length: 1000 }, (_, i) => `result${i}`),
      2000
    )
  ).toBe(true);
  expect(check(Array.from({ length: 1001 }, (_, i) => `result${i}`))).toBe(false);
  expect(check(["result", "result"])).toBe(false);
  expect(check(["../result"])).toBe(false);
});
