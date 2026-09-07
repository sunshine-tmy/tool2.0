import { createServer, type Server } from "node:http";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app";

let testRoot = "";
let workerServer: Server | undefined;
let workerUrl = "";
let generateRequests: Array<Record<string, unknown>> = [];

beforeEach(async () => {
  generateRequests = [];
  testRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "toolbox-chatterbox-"));
  workerServer = createServer(async (request, response) => {
    response.setHeader("content-type", "application/json");
    if (request.url === "/health") {
      response.end(
        JSON.stringify({
          success: true,
          data: {
            available: true,
            packageVersion: "0.1.7-test",
            model: "multilingual-v3",
            modelLoaded: true,
            device: "cuda",
            gpuName: "Test GPU",
            watermarked: true
          }
        })
      );
      return;
    }
    if (request.url === "/generate" && request.method === "POST") {
      const input = JSON.parse((await readRequest(request)) || "{}") as {
        output_path: string;
        text: string;
        [key: string]: unknown;
      };
      generateRequests.push(input);
      const parts = input.text
        .match(/[^.!?]+[.!?]?/g)
        ?.map((value) => value.trim())
        .filter(Boolean) ?? [input.text];
      const segments =
        parts.length > 1
          ? [
              { text: parts[0], startSeconds: 0, endSeconds: 0.4 },
              { text: parts.slice(1).join(" "), startSeconds: 0.58, endSeconds: 1 }
            ]
          : [{ text: input.text, startSeconds: 0, endSeconds: 1 }];
      await fsp.writeFile(input.output_path, createPcmWav(1));
      response.end(
        JSON.stringify({
          success: true,
          data: {
            sampleRate: 24000,
            samples: 24000,
            durationSeconds: 1,
            chunks: segments.length,
            segments,
            device: "cuda",
            watermarked: true
          }
        })
      );
      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ success: false }));
  });
  await new Promise<void>((resolve) => workerServer!.listen(0, "127.0.0.1", resolve));
  const address = workerServer.address();
  if (!address || typeof address === "string") throw new Error("Failed to start mock Chatterbox worker");
  workerUrl = `http://127.0.0.1:${address.port}`;
  process.env.STORAGE_ROOT = path.join(testRoot, "storage");
  process.env.CHATTERBOX_WORKER_URL = workerUrl;
  process.env.CHATTERBOX_WORKER_TIMEOUT_MS = "10000";
});

afterEach(async () => {
  delete process.env.STORAGE_ROOT;
  delete process.env.CHATTERBOX_WORKER_URL;
  delete process.env.CHATTERBOX_WORKER_TIMEOUT_MS;
  await new Promise<void>((resolve) => workerServer?.close(() => resolve()));
  workerServer = undefined;
  await fsp.rm(testRoot, { recursive: true, force: true });
});

describe("Chatterbox voice cloning module", () => {
  it.each(["ms", "pt-BR"])("generates ordered batch audio and supports item regeneration in %s", async (language) => {
    const app = await createApp();
    const segments = [
      {
        text: language === "pt-BR" ? "Confira nossas promoções." : "Ini ialah bahagian pertama.",
        referenceTranslation: "这是第一部分。",
        fileName: "bahagian-satu"
      },
      {
        text: language === "pt-BR" ? "Aproveite as ofertas de hoje." : "This is the second complete sentence.",
        referenceTranslation: "这是完整的第二句。",
        fileName: "part-two"
      }
    ];
    const request = multipartRequest(createPcmWav(6), {
      segments: JSON.stringify(segments),
      name: "batch-demo",
      language,
      authorization: "self",
      consentConfirmed: "true",
      exaggeration: "0.5",
      cfgWeight: "0.5",
      temperature: "0.8",
      seed: "9",
      includeSubtitles: "true",
      subtitleMode: "sentences",
      referenceRetained: "true"
    });
    const created = await app.inject({ method: "POST", url: "/api/tools/edge-tts/chatterbox/batches", ...request });
    expect(created.statusCode).toBe(202);
    const batchId = created.json().data.id as string;
    let batch = await waitForBatch(app, batchId);
    expect(batch).toMatchObject({
      status: "completed",
      completedItems: 2,
      failedItems: 0,
      totalAudioDurationSeconds: 2,
      referenceAvailable: true,
      combinedAudioUrl: expect.any(String),
      subtitleUrl: expect.any(String),
      translationSubtitleUrl: expect.any(String),
      bilingualSubtitleUrl: expect.any(String)
    });
    expect(batch.items).toHaveLength(2);
    expect(batch.items.map((item: { referenceTranslation?: string }) => item.referenceTranslation)).toEqual(
      segments.map((item) => item.referenceTranslation)
    );
    expect(JSON.stringify(generateRequests)).not.toContain("这是第一部分");
    const list = await app.inject({ method: "GET", url: "/api/tools/edge-tts/chatterbox/batches" });
    expect(list.json().data.batches[0].itemPreviews[0].referenceTranslation).toBeUndefined();

    const firstAudio = await app.inject({
      method: "GET",
      url: `/api/tools/edge-tts/chatterbox/batches/${batchId}/items/${batch.items[0].id}/download`
    });
    expect(firstAudio.statusCode).toBe(200);
    expect(firstAudio.headers["content-disposition"]).toContain("001-bahagian-satu.mp3");

    const combinedAudio = await app.inject({
      method: "GET",
      url: `/api/tools/edge-tts/chatterbox/batches/${batchId}/combined-audio`
    });
    expect(combinedAudio.statusCode).toBe(200);
    expect(combinedAudio.headers["content-disposition"]).toContain(
      encodeURIComponent(`总音频-${batchId.slice(0, 8)}.mp3`)
    );
    expect(combinedAudio.rawPayload.subarray(0, 3).toString("ascii")).toBe("ID3");

    await fsp.writeFile(
      path.join(testRoot, "storage", "chatterbox", "batches", batchId, "subtitle.srt"),
      "1\n00:00:00,000 --> 00:00:01,000\n旧版字幕没有中文\n",
      "utf8"
    );
    await fsp.rm(path.join(testRoot, "storage", "chatterbox", "batches", batchId, "subtitle.zh-CN.srt"), {
      force: true
    });
    const subtitle = await app.inject({
      method: "GET",
      url: `/api/tools/edge-tts/chatterbox/batches/${batchId}/subtitle`
    });
    const sourceLanguageName = language === "pt-BR" ? "巴西葡语" : "马来语";
    expect(subtitle.headers["content-disposition"]).toContain(
      encodeURIComponent(`${sourceLanguageName}-${batchId.slice(0, 8)}.srt`)
    );
    expect(readSrtCueTexts(subtitle.body)).toEqual(segments.map((item) => item.text));
    expect(subtitle.body).not.toContain(segments[0].referenceTranslation);
    expect(subtitle.body).toContain("00:00:01,000 --> 00:00:02,000");

    const translationSubtitle = await app.inject({
      method: "GET",
      url: `/api/tools/edge-tts/chatterbox/batches/${batchId}/subtitle.zh-CN`
    });
    expect(translationSubtitle.statusCode).toBe(200);
    expect(translationSubtitle.headers["content-disposition"]).toContain(
      encodeURIComponent(`中文字幕-${batchId.slice(0, 8)}.srt`)
    );
    expect(readSrtCueTexts(translationSubtitle.body)).toEqual(segments.map((item) => item.referenceTranslation));

    const bilingualSubtitle = await app.inject({
      method: "GET",
      url: `/api/tools/edge-tts/chatterbox/batches/${batchId}/subtitle.bilingual`
    });
    expect(bilingualSubtitle.statusCode).toBe(200);
    expect(bilingualSubtitle.headers["content-disposition"]).toContain(
      encodeURIComponent(`双语字幕-${batchId.slice(0, 8)}.srt`)
    );
    expect(readSrtCueTexts(bilingualSubtitle.body)).toEqual(
      segments.map((item) => `${item.text} ${item.referenceTranslation}`)
    );
    expect(bilingualSubtitle.body).toContain(`${segments[0].text}\n${segments[0].referenceTranslation}`);

    const archive = await app.inject({
      method: "GET",
      url: `/api/tools/edge-tts/chatterbox/batches/${batchId}/download.zip`
    });
    expect(archive.statusCode).toBe(200);
    expect(archive.headers["content-type"]).toContain("application/zip");
    expect(archive.rawPayload.subarray(0, 2).toString()).toBe("PK");
    expect(archive.rawPayload.toString("utf8")).toContain(`${sourceLanguageName}-${batchId.slice(0, 8)}.srt`);
    expect(archive.rawPayload.toString("utf8")).toContain(`中文字幕-${batchId.slice(0, 8)}.srt`);
    expect(archive.rawPayload.toString("utf8")).toContain(`双语字幕-${batchId.slice(0, 8)}.srt`);
    expect(archive.rawPayload.toString("utf8")).toContain(`总音频-${batchId.slice(0, 8)}.mp3`);

    const reversedIds = [...batch.items].reverse().map((item: { id: string }) => item.id);
    const reordered = await app.inject({
      method: "PATCH",
      url: `/api/tools/edge-tts/chatterbox/batches/${batchId}/order`,
      payload: { itemIds: reversedIds }
    });
    expect(reordered.statusCode).toBe(200);
    const reorderedSubtitle = await app.inject({
      method: "GET",
      url: `/api/tools/edge-tts/chatterbox/batches/${batchId}/subtitle`
    });
    expect(readSrtCueTexts(reorderedSubtitle.body)).toEqual([...segments].reverse().map((item) => item.text));
    const reorderedTranslationSubtitle = await app.inject({
      method: "GET",
      url: `/api/tools/edge-tts/chatterbox/batches/${batchId}/subtitle.zh-CN`
    });
    expect(readSrtCueTexts(reorderedTranslationSubtitle.body)).toEqual(
      [...segments].reverse().map((item) => item.referenceTranslation)
    );
    const reorderedBilingualSubtitle = await app.inject({
      method: "GET",
      url: `/api/tools/edge-tts/chatterbox/batches/${batchId}/subtitle.bilingual`
    });
    expect(readSrtCueTexts(reorderedBilingualSubtitle.body)).toEqual(
      [...segments].reverse().map((item) => `${item.text} ${item.referenceTranslation}`)
    );

    batch = reordered.json().data;
    const itemId = batch.items[0].id as string;
    const regeneratedText =
      language === "pt-BR"
        ? "Esta frase substitui o áudio anterior."
        : "This regenerated sentence replaces the previous audio.";
    const regeneratedTranslation = "这是重新生成后的中文参考翻译。";
    const regenerate = multipartRequest(createPcmWav(6), {
      text: regeneratedText,
      referenceTranslation: regeneratedTranslation,
      fileName: "regenerated",
      seed: "17",
      exaggeration: "0.9",
      cfgWeight: "0.7",
      temperature: "0.4"
    });
    const regeneration = await app.inject({
      method: "POST",
      url: `/api/tools/edge-tts/chatterbox/batches/${batchId}/items/${itemId}/regenerate`,
      ...regenerate
    });
    expect(regeneration.statusCode, regeneration.body).toBe(202);
    batch = await waitForBatch(app, batchId);
    expect(batch.items.find((item: { id: string }) => item.id === itemId)).toMatchObject({
      status: "completed",
      text: regeneratedText,
      referenceTranslation: regeneratedTranslation,
      fileName: "regenerated",
      seed: 17,
      exaggeration: 0.9,
      cfgWeight: 0.7,
      temperature: 0.4,
      attempt: 2
    });
    expect(generateRequests.at(-1)).toMatchObject({
      language,
      text: regeneratedText,
      seed: 17,
      exaggeration: 0.9,
      cfg_weight: 0.7,
      temperature: 0.4
    });
    expect(JSON.stringify(generateRequests.at(-1))).not.toContain(regeneratedTranslation);
    const regeneratedSubtitle = await app.inject({
      method: "GET",
      url: `/api/tools/edge-tts/chatterbox/batches/${batchId}/subtitle`
    });
    expect(readSrtCueTexts(regeneratedSubtitle.body)[0]).toBe(regeneratedText);
    const regeneratedTranslationSubtitle = await app.inject({
      method: "GET",
      url: `/api/tools/edge-tts/chatterbox/batches/${batchId}/subtitle.zh-CN`
    });
    expect(readSrtCueTexts(regeneratedTranslationSubtitle.body)[0]).toBe(regeneratedTranslation);
    const regeneratedBilingualSubtitle = await app.inject({
      method: "GET",
      url: `/api/tools/edge-tts/chatterbox/batches/${batchId}/subtitle.bilingual`
    });
    expect(readSrtCueTexts(regeneratedBilingualSubtitle.body)[0]).toBe(`${regeneratedText} ${regeneratedTranslation}`);

    const removeReference = await app.inject({
      method: "DELETE",
      url: `/api/tools/edge-tts/chatterbox/batches/${batchId}/reference`
    });
    expect(removeReference.statusCode).toBe(200);
    const detail = await app.inject({ method: "GET", url: `/api/tools/edge-tts/chatterbox/batches/${batchId}` });
    expect(detail.json().data.referenceAvailable).toBe(false);
    await app.close();
  });

  it.each(["ms", "pt-BR"])("generates MP3/SRT and removes the reference audio in %s", async (language) => {
    const app = await createApp();
    const subtitleSentences =
      language === "pt-BR"
        ? ["Olá, bem-vindo à nossa loja.", "Aproveite as promoções de hoje!"]
        : [
            "Selamat datang ke kedai kami.",
            "Hari ini kami memperkenalkan produk baharu yang berkualiti tinggi untuk semua pelanggan di seluruh Malaysia."
          ];
    const health = await app.inject({ method: "GET", url: "/api/tools/edge-tts/chatterbox/health" });
    expect(health.json().data).toMatchObject({
      available: true,
      model: "multilingual-v3",
      modelLoaded: true,
      device: "cuda",
      watermarked: true
    });

    const request = multipartRequest(createPcmWav(6), {
      text: subtitleSentences.join(" "),
      language,
      authorization: "self",
      consentConfirmed: "true",
      exaggeration: "0.5",
      cfgWeight: "0.5",
      temperature: "0.8",
      seed: "7",
      includeSubtitles: "true",
      fileName: "suara-demo"
    });
    const created = await app.inject({ method: "POST", url: "/api/tools/edge-tts/chatterbox/tasks", ...request });
    expect(created.statusCode).toBe(202);
    const taskId = created.json().data.id as string;
    const task = await waitForTask(app, taskId);
    expect(task).toMatchObject({
      status: "completed",
      language,
      referenceDurationSeconds: 6,
      audioDurationSeconds: 1
    });

    const audio = await app.inject({ method: "GET", url: `/api/tools/edge-tts/chatterbox/tasks/${taskId}/audio` });
    const download = await app.inject({
      method: "GET",
      url: `/api/tools/edge-tts/chatterbox/tasks/${taskId}/download`
    });
    const subtitle = await app.inject({
      method: "GET",
      url: `/api/tools/edge-tts/chatterbox/tasks/${taskId}/subtitle`
    });
    expect(audio.statusCode).toBe(200);
    expect(audio.headers["content-type"]).toContain("audio/mpeg");
    expect(download.headers["content-disposition"]).toContain("suara-demo.mp3");
    expect(readSrtCueTexts(subtitle.body)).toEqual(subtitleSentences);
    expect(subtitle.body).not.toContain("\n\n3\n");
    expect(subtitle.body).toContain("00:00:00,580 --> 00:00:01,000");
    expect(subtitle.body).toContain("00:00:01,000");

    const taskDir = path.join(process.env.STORAGE_ROOT!, "chatterbox", "tasks", taskId);
    expect(await fsp.stat(path.join(taskDir, "reference.wav")).catch(() => undefined)).toBeUndefined();

    await fsp.writeFile(
      path.join(taskDir, "subtitle.srt"),
      `1\n00:00:00,000 --> 00:00:01,000\n${subtitleSentences.join(" ")}\n`,
      "utf8"
    );
    const repairedSubtitle = await app.inject({
      method: "GET",
      url: `/api/tools/edge-tts/chatterbox/tasks/${taskId}/subtitle`
    });
    expect(readSrtCueTexts(repairedSubtitle.body)).toEqual(subtitleSentences);
    expect(repairedSubtitle.body).not.toContain("\n\n3\n");

    const list = await app.inject({ method: "GET", url: "/api/tools/edge-tts/chatterbox/tasks" });
    expect(list.json().data.tasks[0].text).toBeUndefined();
    expect(list.json().data.tasks[0].textPreview).toContain(subtitleSentences[0]);
    expect(generateRequests.at(-1)).toMatchObject({ language });
    await app.close();
  });

  it("deletes unretained batch references and requires a new upload for regeneration", async () => {
    const app = await createApp();
    const text = "First sentence. Second sentence.";
    const request = multipartRequest(createPcmWav(6), {
      segments: JSON.stringify([
        { text, referenceTranslation: "这是两句原文的合并翻译。" },
        { text: "Third sentence.", referenceTranslation: "这是第三句。" }
      ]),
      language: "en",
      authorization: "self",
      consentConfirmed: "true",
      exaggeration: "0.5",
      cfgWeight: "0.5",
      temperature: "0.8",
      seed: "0",
      includeSubtitles: "true",
      subtitleMode: "sentences",
      referenceRetained: "false"
    });
    const created = await app.inject({ method: "POST", url: "/api/tools/edge-tts/chatterbox/batches", ...request });
    const batchId = created.json().data.id as string;
    const batch = await waitForBatch(app, batchId);
    expect(batch).toMatchObject({ status: "completed", referenceAvailable: false });
    const subtitle = await app.inject({
      method: "GET",
      url: `/api/tools/edge-tts/chatterbox/batches/${batchId}/subtitle`
    });
    expect(subtitle.headers["content-disposition"]).toContain(encodeURIComponent(`英语-${batchId.slice(0, 8)}.srt`));
    expect(readSrtCueTexts(subtitle.body)).toEqual(["First sentence.", "Second sentence.", "Third sentence."]);
    const translationSubtitle = await app.inject({
      method: "GET",
      url: `/api/tools/edge-tts/chatterbox/batches/${batchId}/subtitle.zh-CN`
    });
    expect(translationSubtitle.headers["content-disposition"]).toContain(
      encodeURIComponent(`中文字幕-${batchId.slice(0, 8)}.srt`)
    );
    expect(readSrtCueTexts(translationSubtitle.body)).toEqual(["这是两句原文的合并翻译。", "这是第三句。"]);
    const bilingualSubtitle = await app.inject({
      method: "GET",
      url: `/api/tools/edge-tts/chatterbox/batches/${batchId}/subtitle.bilingual`
    });
    expect(readSrtCueTexts(bilingualSubtitle.body)).toEqual([
      `${text} 这是两句原文的合并翻译。`,
      "Third sentence. 这是第三句。"
    ]);

    const regenerate = multipartFieldsRequest({ text });
    const response = await app.inject({
      method: "POST",
      url: `/api/tools/edge-tts/chatterbox/batches/${batchId}/items/${batch.items[0].id}/regenerate`,
      ...regenerate
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe("CHATTERBOX_REFERENCE_REQUIRED");
    await app.close();
  });

  it.each(["ms", "pt-BR"])("saves, previews, reuses and deletes a reference voice in %s", async (language) => {
    const app = await createApp();
    const saveRequest = multipartRequest(createPcmWav(6), {
      name: "Suara Kekal",
      language,
      authorization: "self",
      consentConfirmed: "true"
    });
    const saved = await app.inject({ method: "POST", url: "/api/tools/edge-tts/chatterbox/voices", ...saveRequest });
    expect(saved.statusCode).toBe(201);
    const voiceId = saved.json().data.id as string;
    expect(saved.json().data).toMatchObject({ name: "Suara Kekal", language, durationSeconds: 6 });

    const voices = await app.inject({ method: "GET", url: "/api/tools/edge-tts/chatterbox/voices" });
    expect(voices.json().data.voices).toHaveLength(1);
    const preview = await app.inject({ method: "GET", url: `/api/tools/edge-tts/chatterbox/voices/${voiceId}/audio` });
    expect(preview.statusCode).toBe(200);
    expect(preview.headers["content-type"]).toContain("audio/wav");

    const createRequest = multipartFieldsRequest({
      voiceId,
      segments: JSON.stringify([{ text: "Ayat menggunakan suara yang disimpan." }]),
      language,
      authorization: "self",
      consentConfirmed: "true",
      exaggeration: "0.5",
      cfgWeight: "0.5",
      temperature: "0.8",
      seed: "0",
      includeSubtitles: "true",
      subtitleMode: "sentences",
      referenceRetained: "false"
    });
    const created = await app.inject({
      method: "POST",
      url: "/api/tools/edge-tts/chatterbox/batches",
      ...createRequest
    });
    expect(created.statusCode, created.body).toBe(202);
    const batch = await waitForBatch(app, created.json().data.id);
    expect(batch.status).toBe("completed");

    const removed = await app.inject({ method: "DELETE", url: `/api/tools/edge-tts/chatterbox/voices/${voiceId}` });
    expect(removed.statusCode).toBe(200);
    const emptyList = await app.inject({ method: "GET", url: "/api/tools/edge-tts/chatterbox/voices" });
    expect(emptyList.json().data.voices).toHaveLength(0);
    const batchAudio = await app.inject({
      method: "GET",
      url: `/api/tools/edge-tts/chatterbox/batches/${batch.id}/items/${batch.items[0].id}/download`
    });
    expect(batchAudio.statusCode).toBe(200);
    await app.close();
  });

  it("requires explicit legal authorization confirmation", async () => {
    const app = await createApp();
    const request = multipartRequest(createPcmWav(6), {
      text: "Authorized test",
      language: "en",
      authorization: "authorized",
      consentConfirmed: "false",
      exaggeration: "0.5",
      cfgWeight: "0.5",
      temperature: "0.8",
      seed: "0",
      includeSubtitles: "false"
    });
    const response = await app.inject({ method: "POST", url: "/api/tools/edge-tts/chatterbox/tasks", ...request });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("CHATTERBOX_CONSENT_REQUIRED");
    await app.close();
  });
});

async function waitForTask(app: Awaited<ReturnType<typeof createApp>>, taskId: string) {
  for (let index = 0; index < 100; index += 1) {
    const response = await app.inject({ method: "GET", url: `/api/tools/edge-tts/chatterbox/tasks/${taskId}` });
    const task = response.json().data;
    if (task.status === "completed" || task.status === "failed") return task;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Timed out waiting for Chatterbox task");
}

async function waitForBatch(app: Awaited<ReturnType<typeof createApp>>, batchId: string) {
  for (let index = 0; index < 150; index += 1) {
    const response = await app.inject({ method: "GET", url: `/api/tools/edge-tts/chatterbox/batches/${batchId}` });
    const batch = response.json().data;
    if (!["queued", "processing"].includes(batch.status)) return batch;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Timed out waiting for Chatterbox batch");
}

function multipartRequest(file: Buffer, fields: Record<string, string>) {
  const boundary = `----toolbox-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const chunks: Buffer[] = [];
  for (const [name, value] of Object.entries(fields)) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  }
  chunks.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="reference"; filename="voice.wav"\r\nContent-Type: audio/wav\r\n\r\n`
    )
  );
  chunks.push(file, Buffer.from(`\r\n--${boundary}--\r\n`));
  return { headers: { "content-type": `multipart/form-data; boundary=${boundary}` }, payload: Buffer.concat(chunks) };
}

function multipartFieldsRequest(fields: Record<string, string>) {
  const boundary = `----toolbox-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const chunks = Object.entries(fields).map(([name, value]) =>
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`)
  );
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { headers: { "content-type": `multipart/form-data; boundary=${boundary}` }, payload: Buffer.concat(chunks) };
}

function createPcmWav(seconds: number, sampleRate = 24000) {
  const sampleCount = Math.floor(seconds * sampleRate);
  const dataLength = sampleCount * 2;
  const output = Buffer.alloc(44 + dataLength);
  output.write("RIFF", 0);
  output.writeUInt32LE(36 + dataLength, 4);
  output.write("WAVEfmt ", 8);
  output.writeUInt32LE(16, 16);
  output.writeUInt16LE(1, 20);
  output.writeUInt16LE(1, 22);
  output.writeUInt32LE(sampleRate, 24);
  output.writeUInt32LE(sampleRate * 2, 28);
  output.writeUInt16LE(2, 32);
  output.writeUInt16LE(16, 34);
  output.write("data", 36);
  output.writeUInt32LE(dataLength, 40);
  for (let index = 0; index < sampleCount; index += 1) {
    const sample = Math.round(Math.sin((2 * Math.PI * 220 * index) / sampleRate) * 2500);
    output.writeInt16LE(sample, 44 + index * 2);
  }
  return output;
}

async function readRequest(request: import("node:http").IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

function readSrtCueTexts(content: string) {
  return content
    .trim()
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.split(/\r?\n/).slice(2).join(" ").trim());
}
