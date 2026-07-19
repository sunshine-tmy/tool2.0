import { createServer, type Server } from "node:http";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app";

let testRoot = "";
let workerServer: Server | undefined;
let workerUrl = "";

beforeEach(async () => {
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
      const input = JSON.parse((await readRequest(request)) || "{}") as { output_path: string; text: string };
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
  it("reports local V3 worker, generates MP3/SRT and removes the reference audio", async () => {
    const app = await createApp();
    const subtitleSentences = [
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
      language: "ms",
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
      language: "ms",
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
    expect(list.json().data.tasks[0].textPreview).toContain("Selamat");
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
