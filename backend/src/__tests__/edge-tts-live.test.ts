import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";

const live = process.env.EDGE_TTS_LIVE === "1";
let storageRoot = "";

describe.skipIf(!live)("edge tts live service", () => {
  beforeAll(async () => {
    storageRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "toolbox-edge-tts-live-"));
    process.env.STORAGE_ROOT = storageRoot;
  });

  afterAll(async () => {
    delete process.env.STORAGE_ROOT;
    await fsp.rm(storageRoot, { recursive: true, force: true });
  });

  it("generates real Malay and English audio with subtitles", async () => {
    const app = await createApp();
    try {
      const health = await app.inject({ method: "GET", url: "/api/tools/edge-tts/health" });
      expect(health.json().data).toMatchObject({ available: true, version: "7.2.8" });
      const voices = await app.inject({ method: "GET", url: "/api/tools/edge-tts/voices" });
      const voiceNames = voices.json().data.voices.map((voice: { shortName: string }) => voice.shortName);
      expect(voiceNames).toEqual(expect.arrayContaining(["ms-MY-YasminNeural", "en-US-JennyNeural"]));

      for (const sample of [
        {
          text: "Selamat datang ke kedai kami. Terima kasih kerana memilih produk ini.",
          language: "ms-MY",
          voice: "ms-MY-YasminNeural"
        },
        {
          text: "Welcome to our store. Thank you for choosing this product.",
          language: "en-US",
          voice: "en-US-JennyNeural"
        }
      ] as const) {
        const created = await app.inject({
          method: "POST",
          url: "/api/tools/edge-tts/tasks",
          payload: { ...sample, rate: 0, volume: 0, pitch: 0, includeSubtitles: true }
        });
        expect(created.statusCode).toBe(202);
        const task = await waitForTask(app, created.json().data.id);
        expect(task.status, task.error).toBe("completed");
        expect(task.audioBytes).toBeGreaterThan(1000);

        const audio = await app.inject({ method: "GET", url: task.audioUrl });
        const subtitle = await app.inject({ method: "GET", url: task.subtitleUrl });
        expect(audio.statusCode).toBe(200);
        expect(isMp3(audio.rawPayload)).toBe(true);
        expect(subtitle.statusCode).toBe(200);
        expect(subtitle.body).toContain("-->");
      }
    } finally {
      await app.close();
    }
  }, 240_000);
});

async function waitForTask(app: Awaited<ReturnType<typeof createApp>>, taskId: string) {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    const response = await app.inject({ method: "GET", url: `/api/tools/edge-tts/tasks/${taskId}` });
    const task = response.json().data;
    if (task.status === "completed" || task.status === "failed") return task;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Timed out waiting for live Edge-TTS generation");
}

function isMp3(value: Buffer) {
  return value.subarray(0, 3).toString("ascii") === "ID3" || (value[0] === 0xff && (value[1] & 0xe0) === 0xe0);
}
