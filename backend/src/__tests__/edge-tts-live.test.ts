/**
 * 中文模块说明：测试 backend/src/__tests__/edge-tts-live.test.ts 中的稳定行为、边界条件和回归场景
 */
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
    process.env.DATABASE_PATH = path.join(storageRoot, "toolbox.db");
  });

  afterAll(async () => {
    delete process.env.STORAGE_ROOT;
    delete process.env.DATABASE_PATH;
    await fsp.rm(storageRoot, { recursive: true, force: true });
  });

  it("generates real Malay, English and Brazilian Portuguese audio with subtitles", async () => {
    const app = await createApp();
    try {
      const health = await app.inject({ method: "GET", url: "/api/v1/tools/edge-tts/health" });
      expect(health.json().data).toMatchObject({ available: true, version: "7.3.1" });
      const voices = await app.inject({ method: "GET", url: "/api/v1/tools/edge-tts/voices" });
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
        },
        {
          text: "Olá! Bem-vindo à nossa loja. Confira nossas promoções.",
          language: "pt-BR",
          voice: "pt-BR-FranciscaNeural"
        },
        {
          text: "Obrigado pela preferência. Aproveite as novidades!",
          language: "pt-BR",
          voice: "pt-BR-AntonioNeural"
        }
      ] as const) {
        const created = await app.inject({
          method: "POST",
          url: "/api/v1/tools/edge-tts/tasks",
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
  it("generates real ordered bilingual batches and merged downloads in all supported languages", async () => {
    const app = await createApp();
    try {
      for (const sample of [
        { language: "ms-MY", voice: "ms-MY-YasminNeural", texts: ["Selamat datang.", "Terima kasih."] },
        { language: "en-US", voice: "en-US-JennyNeural", texts: ["Welcome to our store.", "Thank you."] },
        { language: "pt-BR", voice: "pt-BR-FranciscaNeural", texts: ["Bem-vindo.", "Obrigado."] }
      ]) {
        const created = await app.inject({
          method: "POST",
          url: "/api/v1/tools/edge-tts/batches",
          payload: {
            language: sample.language,
            voice: sample.voice,
            rate: 0,
            volume: 0,
            pitch: 0,
            includeSubtitles: true,
            subtitleMode: "sentences",
            segments: sample.texts.map((text, index) => ({
              text,
              referenceTranslation: index === 0 ? "欢迎。" : "谢谢。"
            }))
          }
        });
        expect(created.statusCode, created.body).toBe(202);
        const id = created.json().data.id;
        let batch = created.json().data;
        for (let count = 0; count < 180 && ["queued", "processing"].includes(batch.status); count++) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          batch = (await app.inject({ method: "GET", url: `/api/v1/tools/edge-tts/batches/${id}` })).json().data;
        }
        expect(batch.status, JSON.stringify(batch.items)).toBe("completed");
        expect(batch.items.map((item: { text: string }) => item.text)).toEqual(sample.texts);
        const audio = await app.inject({ method: "GET", url: batch.combinedAudioUrl });
        expect(audio.statusCode, audio.body).toBe(200);
        expect(isMp3(audio.rawPayload)).toBe(true);
        const chinese = await app.inject({ method: "GET", url: batch.translationSubtitleUrl });
        expect(chinese.statusCode).toBe(200);
        expect(chinese.body).toContain("欢迎。");
        expect(chinese.body).toContain("谢谢。");
        const zip = await app.inject({ method: "GET", url: batch.archiveUrl });
        expect(zip.statusCode).toBe(200);
        expect(zip.rawPayload.subarray(0, 2).toString()).toBe("PK");
      }
    } finally {
      await app.close();
    }
  }, 240_000);
});

async function waitForTask(app: Awaited<ReturnType<typeof createApp>>, taskId: string) {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    const response = await app.inject({ method: "GET", url: `/api/v1/tools/edge-tts/tasks/${taskId}` });
    const task = response.json().data;
    if (task.status === "completed" || task.status === "failed") return task;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Timed out waiting for live Edge-TTS generation");
}

function isMp3(value: Buffer) {
  return value.subarray(0, 3).toString("ascii") === "ID3" || (value[0] === 0xff && (value[1] & 0xe0) === 0xe0);
}
