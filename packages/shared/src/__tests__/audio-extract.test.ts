import { expect, it } from "vitest";
import { Value } from "@sinclair/typebox/value";
import { AudioExtractInputSchema, AudioExtractJobSchema, AUDIO_EXTRACT_MAX_BYTES } from "../audio-extract";
it("accepts exact options and rejects duplicate tracks, coercion, path input and excessive selections", () => {
  const input = { sourceId: "a".repeat(21), trackIndices: [1, 3], format: "original", bitrate: 192 };
  expect(Value.Check(AudioExtractInputSchema, input)).toBe(true);
  for (const changed of [
    { bitrate: "192" },
    { trackIndices: [1, 1] },
    { trackIndices: Array.from({ length: 33 }, (_, i) => i) },
    { sourceId: "../../x" },
    { format: "wav" },
    { path: "C:\\private.mp4" }
  ])
    expect(Value.Check(AudioExtractInputSchema, { ...input, ...changed })).toBe(false);
  expect(AUDIO_EXTRACT_MAX_BYTES).toBe(2 * 1024 ** 3);
});
it("stores portable metadata and never accepts source/output filesystem paths", () => {
  expect(AudioExtractJobSchema.additionalProperties).toBe(false);
  expect(Object.keys(AudioExtractJobSchema.properties)).not.toContain("path");
  expect(Object.keys(AudioExtractJobSchema.properties)).not.toContain("sourceId");
});
