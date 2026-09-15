import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import "../api-schema";
import { ChatterboxBatchListSchema, ChatterboxBatchSchema, ChatterboxSavedVoiceSchema } from "../chatterbox";

const now = "2026-09-14T10:00:00.000Z";

describe("chatterbox response schemas", () => {
  it("validates saved voices without accepting undeclared fields", () => {
    const voice = {
      id: "voice_123456",
      name: "sample",
      language: "ms",
      originalFileName: "sample.wav",
      durationSeconds: 8.2,
      audioBytes: 1024,
      authorization: "self",
      consentConfirmed: true,
      createdAt: now,
      updatedAt: now,
      audioUrl: "/api/v1/tools/edge-tts/chatterbox/voices/voice_123456/audio"
    };
    expect(Value.Check(ChatterboxSavedVoiceSchema, voice)).toBe(true);
    expect(Value.Check(ChatterboxSavedVoiceSchema, { ...voice, localPath: "C:/private/sample.wav" })).toBe(false);
  });

  it("validates full batches and paginated summaries", () => {
    const item = {
      id: "item_123456",
      order: 1,
      text: "Selamat datang.",
      status: "completed",
      progress: 100,
      attempt: 1,
      characterCount: 15,
      audioBytes: 2048,
      audioDurationSeconds: 1.8,
      createdAt: now,
      updatedAt: now,
      audioUrl: "/audio",
      downloadUrl: "/download"
    };
    const batch = {
      id: "batch_123456",
      engine: "chatterbox-multilingual-v3",
      status: "completed",
      progress: 100,
      language: "ms",
      referenceFileName: "sample.wav",
      referenceDurationSeconds: 8.2,
      referenceRetained: false,
      referenceAvailable: false,
      authorization: "self",
      consentConfirmed: true,
      exaggeration: 0.5,
      cfgWeight: 0.5,
      temperature: 0.8,
      seed: 42,
      includeSubtitles: true,
      subtitleMode: "sentences",
      items: [item],
      totalCharacters: 15,
      totalAudioBytes: 2048,
      totalAudioDurationSeconds: 1.8,
      completedItems: 1,
      failedItems: 0,
      createdAt: now,
      updatedAt: now,
      expiresAt: now,
      archiveUrl: "/archive.zip"
    };
    expect(Value.Check(ChatterboxBatchSchema, batch)).toBe(true);
    expect(Value.Check(ChatterboxBatchSchema, { ...batch, status: "unknown" })).toBe(false);

    const { items: _items, ...summary } = batch;
    const { text: _text, ...itemSummary } = item;
    expect(
      Value.Check(ChatterboxBatchListSchema, {
        batches: [{ ...summary, itemPreviews: [{ ...itemSummary, textPreview: "Selamat datang." }] }],
        pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 }
      })
    ).toBe(true);
  });
});
