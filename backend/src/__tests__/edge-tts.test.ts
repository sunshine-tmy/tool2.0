import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app";

let testRoot = "";
let helperPath = "";

beforeEach(async () => {
  testRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "toolbox-edge-tts-"));
  helperPath = path.join(testRoot, "edge-tts-helper.cjs");
  await fsp.writeFile(helperPath, helperSource(), "utf8");
  process.env.STORAGE_ROOT = path.join(testRoot, "storage");
  process.env.EDGE_TTS_PYTHON = process.execPath;
  process.env.EDGE_TTS_SCRIPT = helperPath;
  process.env.EDGE_TTS_TIMEOUT_MS = "10000";
  process.env.EDGE_TTS_CONCURRENCY = "1";
});

afterEach(async () => {
  delete process.env.STORAGE_ROOT;
  delete process.env.EDGE_TTS_PYTHON;
  delete process.env.EDGE_TTS_SCRIPT;
  delete process.env.EDGE_TTS_TIMEOUT_MS;
  delete process.env.EDGE_TTS_CONCURRENCY;
  await fsp.rm(testRoot, { recursive: true, force: true });
});

describe("edge tts module", () => {
  it("reports health and filters the live voice list", async () => {
    const app = await createApp();
    const health = await app.inject({ method: "GET", url: "/api/tools/edge-tts/health" });
    const voices = await app.inject({ method: "GET", url: "/api/tools/edge-tts/voices?language=ms-MY" });

    expect(health.statusCode).toBe(200);
    expect(health.json().data).toMatchObject({ available: true, version: "test-1.0", retentionDays: 3 });
    expect(voices.json().data).toMatchObject({
      source: "live",
      voices: [expect.objectContaining({ shortName: "ms-MY-YasminNeural", locale: "ms-MY" })]
    });
    await app.close();
  });

  it.each([
    { language: "ms-MY", voice: "ms-MY-YasminNeural", text: "Selamat datang ke kedai kami." },
    { language: "pt-BR", voice: "pt-BR-FranciscaNeural", text: "Olá! Confira nossas promoções e novidades." },
    { language: "pt-BR", voice: "pt-BR-AntonioNeural", text: "Bem-vindo à nossa loja. Obrigado pela preferência!" }
  ])("generates, persists, serves and deletes MP3 and SRT files for $voice", async (sample) => {
    const app = await createApp();
    await app.inject({ method: "GET", url: "/api/tools/edge-tts/voices?language=ms-MY" });
    const created = await app.inject({
      method: "POST",
      url: "/api/tools/edge-tts/tasks",
      payload: {
        ...sample,
        rate: 10,
        volume: 5,
        pitch: 0,
        includeSubtitles: true,
        fileName: "produk-baharu"
      }
    });

    expect(created.statusCode).toBe(202);
    const taskId = created.json().data.id as string;
    const completed = await waitForTask(app, taskId);
    expect(completed).toMatchObject({ status: "completed", audioBytes: 13 });

    const audio = await app.inject({ method: "GET", url: `/api/tools/edge-tts/tasks/${taskId}/audio` });
    const download = await app.inject({ method: "GET", url: `/api/tools/edge-tts/tasks/${taskId}/download` });
    const subtitle = await app.inject({ method: "GET", url: `/api/tools/edge-tts/tasks/${taskId}/subtitle` });
    expect(audio.statusCode).toBe(200);
    expect(audio.headers["content-type"]).toContain("audio/mpeg");
    expect(download.headers["content-disposition"]).toContain("produk-baharu.mp3");
    expect(subtitle.body).toContain(sample.text);

    const list = await app.inject({ method: "GET", url: "/api/tools/edge-tts/tasks" });
    expect(list.json().data.tasks[0]).toMatchObject({ id: taskId, status: "completed" });
    expect(list.json().data.tasks[0].text).toBeUndefined();
    await app.close();

    const restarted = await createApp();
    const restored = await restarted.inject({ method: "GET", url: `/api/tools/edge-tts/tasks/${taskId}` });
    expect(restored.json().data).toMatchObject({ id: taskId, status: "completed", ...sample });
    const removed = await restarted.inject({ method: "DELETE", url: `/api/tools/edge-tts/tasks/${taskId}` });
    expect(removed.json().data).toEqual({ removed: true });
    expect(
      await fsp.stat(path.join(process.env.STORAGE_ROOT!, "edge-tts", "tasks", taskId)).catch(() => undefined)
    ).toBeUndefined();
    await restarted.close();
  });

  it("rejects unsupported voices before creating a task", async () => {
    const app = await createApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/tools/edge-tts/tasks",
      payload: {
        text: "Hello",
        language: "en-US",
        voice: "en-US-NotARealVoice",
        rate: 0,
        volume: 0,
        pitch: 0,
        includeSubtitles: false
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("EDGE_TTS_VOICE_INVALID");
    await app.close();
  });

  it("filters Brazilian voices and rejects a voice from another locale", async () => {
    const app = await createApp();
    try {
      const voices = await app.inject({ method: "GET", url: "/api/tools/edge-tts/voices?language=pt-BR" });
      expect(voices.statusCode).toBe(200);
      expect(voices.json().data.voices).toHaveLength(2);
      expect(voices.json().data.voices.every((voice: { locale: string }) => voice.locale === "pt-BR")).toBe(true);
      const result = await app.inject({
        method: "POST",
        url: "/api/tools/edge-tts/tasks",
        payload: {
          text: "Olá!",
          language: "pt-BR",
          voice: "en-US-JennyNeural",
          rate: 0,
          volume: 0,
          pitch: 0,
          includeSubtitles: true
        }
      });
      expect(result.statusCode).toBe(400);
      expect(result.json().error.code).toBe("EDGE_TTS_VOICE_INVALID");
    } finally {
      await app.close();
    }
  });

  it("cancels the Python process before deleting an active task directory", async () => {
    const app = await createApp();
    const created = await app.inject({
      method: "POST",
      url: "/api/tools/edge-tts/tasks",
      payload: {
        text: "slow generation",
        language: "en-US",
        voice: "en-US-JennyNeural",
        rate: 0,
        volume: 0,
        pitch: 0,
        includeSubtitles: false
      }
    });
    const taskId = created.json().data.id as string;

    const removed = await app.inject({ method: "DELETE", url: `/api/tools/edge-tts/tasks/${taskId}` });

    expect(removed.statusCode).toBe(200);
    expect(
      await fsp.stat(path.join(process.env.STORAGE_ROOT!, "edge-tts", "tasks", taskId)).catch(() => undefined)
    ).toBeUndefined();
    await app.close();
  });
});

async function waitForTask(app: Awaited<ReturnType<typeof createApp>>, taskId: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const response = await app.inject({ method: "GET", url: `/api/tools/edge-tts/tasks/${taskId}` });
    const task = response.json().data;
    if (task.status === "completed" || task.status === "failed") return task;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Timed out waiting for Edge-TTS task");
}

function helperSource() {
  return String.raw`
const fs = require("node:fs");
const command = process.argv[2];
if (command === "check") {
  process.stdout.write(JSON.stringify({ available: true, version: "test-1.0" }));
} else if (command === "voices") {
  process.stdout.write(JSON.stringify({ voices: [
    { name: "Yasmin", shortName: "ms-MY-YasminNeural", locale: "ms-MY", gender: "Female" },
    { name: "Jenny", shortName: "en-US-JennyNeural", locale: "en-US", gender: "Female" },
    { name: "Francisca", shortName: "pt-BR-FranciscaNeural", locale: "pt-BR", gender: "Female" },
    { name: "Antonio", shortName: "pt-BR-AntonioNeural", locale: "pt-BR", gender: "Male" }
  ] }));
} else if (command === "generate") {
  const value = (name) => process.argv[process.argv.indexOf(name) + 1];
  const input = JSON.parse(fs.readFileSync(value("--input"), "utf8"));
  if (input.text.includes("slow")) {
    const handle = fs.openSync(value("--audio"), "w");
    fs.writeSync(handle, Buffer.from("ID3"));
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5000);
    fs.closeSync(handle);
  }
  fs.writeFileSync(value("--audio"), Buffer.concat([Buffer.from("ID3"), Buffer.from("fake-audio")]));
  if (process.argv.includes("--subtitle")) {
    fs.writeFileSync(value("--subtitle"), "1\n00:00:00,000 --> 00:00:01,000\n" + input.text + "\n", "utf8");
  }
  process.stdout.write(JSON.stringify({ audioBytes: 13 }));
} else {
  process.stderr.write("unknown command");
  process.exit(1);
}
`;
}
