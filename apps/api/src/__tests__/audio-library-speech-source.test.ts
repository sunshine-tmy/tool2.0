import fs from "node:fs/promises";
import path from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { afterEach, beforeEach, expect, expectTypeOf, it } from "vitest";
import { getConfig, type AppConfig } from "../config";
import { ToolboxDatabase } from "../database/toolbox-database";
import type { ChatterboxBatchStore } from "../domains/speech/chatterbox/stores";
import type { EdgeTtsBatchService } from "../domains/speech/edge-tts/batch-service";
import { registerAudioLibraryRoutes } from "../domains/audio-library/routes";
import type {
  AudioLibrarySpeechSource,
  AudioLibrarySpeechBatch,
  AudioLibrarySpeechItem
} from "../domains/audio-library/types";
import { createIsolatedAppFixture } from "./helpers/isolated-app";

let fixture: Awaited<ReturnType<typeof createIsolatedAppFixture>>;
let config: AppConfig;
let database: ToolboxDatabase;
let app: FastifyInstance;

beforeEach(async () => {
  fixture = await createIsolatedAppFixture();
  config = getConfig({ layout: fixture.layout, dotenvPath: false, environment: { NODE_ENV: "test" } });
  database = new ToolboxDatabase(":memory:");
  app = Fastify();
  await app.register(multipart);
});
afterEach(async () => {
  try {
    await app.close();
  } finally {
    database.close();
  }
  await fixture.dispose();
});

it("accepts both existing producers structurally without exposing their store classes to the consumer", () => {
  expectTypeOf<ChatterboxBatchStore>().toMatchTypeOf<AudioLibrarySpeechSource>();
  expectTypeOf<EdgeTtsBatchService>().toMatchTypeOf<AudioLibrarySpeechSource>();
});

it("exposes only the existing read projection, controlled lock and audio path", () => {
  expectTypeOf<keyof AudioLibrarySpeechSource>().toEqualTypeOf<"withArtifact" | "get" | "itemPaths">();
  expectTypeOf<AudioLibrarySpeechBatch["items"]>().toEqualTypeOf<readonly AudioLibrarySpeechItem[]>();
  expectTypeOf<ReturnType<AudioLibrarySpeechSource["itemPaths"]>>().toEqualTypeOf<{ readonly audio: string }>();
});

function syntheticWav() {
  const data = Buffer.alloc(44 + 1600);
  data.write("RIFF");
  data.writeUInt32LE(data.length - 8, 4);
  data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(8000, 24);
  data.writeUInt32LE(16000, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(1600, 40);
  return data;
}

it.each(["chatterbox", "edge-tts"] as const)(
  "imports from a minimal %s source under its original lock and retains an independent copy",
  async (engine) => {
    const directory = path.join(fixture.layout.storageRoot, "synthetic-source");
    await fs.mkdir(directory, { recursive: true });
    const sourceFile = path.join(directory, "fixture.wav"),
      bytes = syntheticWav();
    await fs.writeFile(sourceFile, bytes);
    const batch: AudioLibrarySpeechBatch = Object.freeze({
      id: "batch-001",
      language: "ms-MY",
      items: Object.freeze([
        Object.freeze({
          id: "item-001",
          status: "completed",
          attempt: 1,
          text: "Synthetic text",
          referenceTranslation: "合成文案",
          fileName: "fixture"
        })
      ])
    });
    let locked = false;
    const calls: string[] = [];
    const source: AudioLibrarySpeechSource = {
      async withArtifact(_batchId, operation) {
        expect(locked).toBe(false);
        locked = true;
        calls.push("lock");
        try {
          return await operation();
        } finally {
          locked = false;
          calls.push("unlock");
        }
      },
      get() {
        expect(locked).toBe(true);
        calls.push("get");
        return engine === "edge-tts" ? Promise.resolve(batch) : batch;
      },
      itemPaths() {
        expect(locked).toBe(true);
        calls.push("path");
        return { audio: sourceFile };
      }
    };
    await registerAudioLibraryRoutes(app, config, database, source, source);
    await app.ready();
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/tools/audio-library/imports/${engine}`,
      payload: { batchId: batch.id, itemIds: ["item-001"], attempts: { "item-001": 1 }, groupId: null }
    });
    expect(response.statusCode, response.body).toBe(200);
    const result = response.json().data.results[0];
    expect(result).toMatchObject({
      status: "added",
      item: {
        language: "ms",
        foreignText: "Synthetic text",
        chineseText: "合成文案",
        source: { kind: engine, attempt: 1 }
      }
    });
    expect(calls).toEqual(["lock", "get", "path", "unlock"]);
    expect(locked).toBe(false);
    await fs.rm(sourceFile);
    const audio = await app.inject({ method: "GET", url: `/api/v1/tools/audio-library/items/${result.item.id}/audio` });
    expect(audio.statusCode, audio.body).toBe(200);
    expect(audio.rawPayload).toEqual(bytes);
  }
);
