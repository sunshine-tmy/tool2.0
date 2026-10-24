/** Deterministic browser-only responses. No text is sent to an external speech service. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  EdgeTtsBatchCreateSchema,
  EdgeTtsBatchSchema,
  type EdgeTtsBatch,
  type EdgeTtsBatchCreate
} from "../../packages/shared/src/speech/edge-tts-batch";

// Resolve the shared package's declared validator, without a duplicate root dependency.
const requireShared = createRequire(new URL("../../packages/shared/package.json", import.meta.url));
const { Value } = requireShared("@sinclair/typebox/value") as {
  Value: { Check(schema: unknown, value: unknown): boolean };
};
const { FormatRegistry } = requireShared("@sinclair/typebox") as {
  FormatRegistry: { Has(name: string): boolean; Set(name: string, check: (value: string) => boolean): void };
};
// Same format predicate as api-schema.ts; register in the validator's CJS module instance.
if (!FormatRegistry.Has("date-time")) FormatRegistry.Set("date-time", (value) => !Number.isNaN(Date.parse(value)));

export function assertOnlineSpeechInput(input: unknown): asserts input is EdgeTtsBatchCreate {
  assert.ok(Value.Check(EdgeTtsBatchCreateSchema, input), "Browser submitted an invalid online batch");
}

export function onlineSpeechBatch(input: EdgeTtsBatchCreate, completed: boolean): EdgeTtsBatch {
  const root = "/api/v1/tools/edge-tts/batches/e2e-online-batch";
  const { segments, ...settings } = input;
  const timestamp = "2026-10-22T00:00:00.000Z";
  const batch: EdgeTtsBatch = {
    ...settings,
    id: "e2e-online-batch",
    status: completed ? "completed" : "queued",
    progress: completed ? 100 : 0,
    completedItems: completed ? segments.length : 0,
    failedItems: 0,
    totalCharacters: segments.reduce((sum, segment) => sum + segment.text.length, 0),
    totalAudioBytes: completed ? segments.length * 1000 : 0,
    totalAudioDurationSeconds: completed ? segments.length : 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    expiresAt: "2030-01-01T00:00:00.000Z",
    items: segments.map((segment, index) => ({
      ...segment,
      language: settings.language,
      voice: settings.voice,
      rate: settings.rate,
      volume: settings.volume,
      pitch: settings.pitch,
      includeSubtitles: settings.includeSubtitles,
      id: `e2e-online-item-${index + 1}`,
      status: completed ? "completed" : "queued",
      progress: completed ? 100 : 0,
      order: index + 1,
      attempt: 1,
      characterCount: segment.text.length,
      createdAt: timestamp,
      updatedAt: timestamp,
      expiresAt: "2030-01-01T00:00:00.000Z"
    })),
    ...(completed
      ? {
          archiveUrl: `${root}/download.zip`,
          combinedAudioUrl: `${root}/combined-audio`,
          subtitleUrl: `${root}/subtitle`,
          translationSubtitleUrl: `${root}/subtitle.zh-CN`,
          bilingualSubtitleUrl: `${root}/subtitle.bilingual`
        }
      : {})
  };
  // Fixtures must obey the real response contract, not a parallel UI-only DTO.
  assert.ok(Value.Check(EdgeTtsBatchSchema, batch), "Invalid online speech response fixture");
  return batch;
}
