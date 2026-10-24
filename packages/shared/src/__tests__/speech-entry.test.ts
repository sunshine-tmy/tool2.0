import { describe, expect, expectTypeOf, it } from "vitest";
import { Value } from "@sinclair/typebox/value";
import * as root from "../index";
import * as speech from "../speech/index";
import * as edge from "../speech/edge-tts";
import * as batches from "../speech/edge-tts-batch";
import * as chatterbox from "../speech/chatterbox";

describe("speech domain entry", () => {
  it("reuses exactly both existing engine contracts and ordered batch contracts", () => {
    const existing = { ...edge, ...batches, ...chatterbox };
    expect(Object.keys(speech).sort()).toEqual(Object.keys(existing).sort());
    for (const [key, value] of Object.entries(existing)) {
      expect(Reflect.get(speech, key)).toBe(value);
      expect(Reflect.get(root, key)).toBe(value);
    }
    expect(speech).not.toHaveProperty("ImageAiTaskSchema");
  });
  it("preserves task, engine, batch and saved-voice types", () => {
    expectTypeOf<speech.EdgeTtsCreateTaskInput>().toEqualTypeOf<root.EdgeTtsCreateTaskInput>();
    expectTypeOf<speech.EdgeTtsBatchCreate>().toEqualTypeOf<root.EdgeTtsBatchCreate>();
    expectTypeOf<speech.ChatterboxDevice>().toEqualTypeOf<"cpu" | "cuda">();
    expectTypeOf<speech.ChatterboxSavedVoice>().toEqualTypeOf<root.ChatterboxSavedVoice>();
  });
  it("does not change language lists or engine-specific limits", () => {
    expect(speech.EDGE_TTS_LANGUAGES).toEqual(root.EDGE_TTS_LANGUAGES);
    expect(speech.CHATTERBOX_LANGUAGES).toEqual(root.CHATTERBOX_LANGUAGES);
    expect(speech.CHATTERBOX_MAX_REFERENCE_BYTES).toBe(root.CHATTERBOX_MAX_REFERENCE_BYTES);
    expect(speech.EDGE_TTS_MAX_BATCH_SEGMENTS).toBe(root.EDGE_TTS_MAX_BATCH_SEGMENTS);
  });
  it("preserves accepted and rejected engine queries without cross-engine normalization", () => {
    for (const sample of [
      { language: "pt-BR" },
      { language: "invalid" },
      { language: 123 },
      { language: "en-US", extra: true }
    ]) {
      expect(Value.Check(speech.EdgeTtsVoiceQuerySchema, sample)).toBe(
        Value.Check(root.EdgeTtsVoiceQuerySchema, sample)
      );
      expect([...Value.Errors(speech.EdgeTtsVoiceQuerySchema, sample)]).toEqual([
        ...Value.Errors(root.EdgeTtsVoiceQuerySchema, sample)
      ]);
    }
    expect(Value.Check(speech.EdgeTtsVoiceQuerySchema, { language: "pt-BR" })).toBe(true);
    // The existing query schema accepts strings; engine support is checked by its business adapter.
    expect(Value.Check(speech.EdgeTtsVoiceQuerySchema, { language: "invalid" })).toBe(true);
    expect(Value.Check(speech.EdgeTtsVoiceQuerySchema, { language: 123 })).toBe(false);
  });
});
