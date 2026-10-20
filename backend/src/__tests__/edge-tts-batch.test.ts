import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { EdgeTtsBatch } from "@toolbox/shared";
import { createApp } from "../app";

let root = "",
  app: FastifyInstance | undefined;
const prefix = "/api/v1/tools/edge-tts/batches";
const input = (texts = ["Hello there.", "Thank you."]) => ({
  name: "在线双语批次",
  language: "en-US",
  voice: "en-US-JennyNeural",
  rate: 0,
  volume: 0,
  pitch: 0,
  includeSubtitles: true,
  subtitleMode: "sentences",
  segments: texts.map((text, index) => ({
    text,
    referenceTranslation: ["你好。", "谢谢。"][index] || "中文",
    fileName: `part-${index + 1}`
  }))
});
beforeEach(async () => {
  root = await fsp.mkdtemp(path.join(os.tmpdir(), "toolbox-online-batch-"));
  const mp3 = path.join(root, "sample.mp3"),
    helper = path.join(root, "worker.cjs");
  execFileSync(
    "ffmpeg",
    ["-y", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=0.3", "-codec:a", "libmp3lame", mp3],
    { windowsHide: true }
  );
  await fsp.writeFile(
    helper,
    `
const fs = require('node:fs');
const command = process.argv[2];
if (command === 'check') console.log(JSON.stringify({protocolVersion:1,available:true,version:'7.3.1-test'}));
else if (command === 'voices') console.log(JSON.stringify({protocolVersion:1,voices:[]}));
else {
  const arg = (key) => process.argv[process.argv.indexOf(key)+1];
  const request = JSON.parse(fs.readFileSync(arg('--input'),'utf8'));
  fs.appendFileSync(${JSON.stringify(path.join(root, "calls.jsonl"))}, JSON.stringify(request)+'\\n');
  if (request.text.startsWith('slow')) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,1200);
  if (request.text === 'FAIL') { process.stderr.write('test generation failure'); process.exit(1); }
  fs.copyFileSync(${JSON.stringify(mp3)},arg('--audio'));
  if(process.argv.includes('--subtitle')) fs.writeFileSync(arg('--subtitle'),'1\\n00:00:00,000 --> 00:00:00,300\\n'+request.text+'\\n');
  console.log(JSON.stringify({protocolVersion:1,audioBytes:fs.statSync(arg('--audio')).size}));
}`,
    "utf8"
  );
  process.env.STORAGE_ROOT = path.join(root, "storage");
  process.env.DATABASE_PATH = path.join(root, "storage", "toolbox.db");
  process.env.EDGE_TTS_PYTHON = process.execPath;
  process.env.EDGE_TTS_SCRIPT = helper;
  process.env.EDGE_TTS_CONCURRENCY = "1";
  process.env.EDGE_TTS_QUEUE_LIMIT = "20";
  process.env.EDGE_TTS_TIMEOUT_MS = "10000";
});
afterEach(async () => {
  await app?.close();
  app = undefined;
  for (const key of [
    "STORAGE_ROOT",
    "DATABASE_PATH",
    "EDGE_TTS_PYTHON",
    "EDGE_TTS_SCRIPT",
    "EDGE_TTS_CONCURRENCY",
    "EDGE_TTS_QUEUE_LIMIT",
    "EDGE_TTS_TIMEOUT_MS"
  ])
    delete process.env[key];
  await fsp.rm(root, { recursive: true, force: true });
});
async function create(texts?: string[]) {
  const result = await app!.inject({ method: "POST", url: prefix, payload: input(texts) });
  expect(result.statusCode, result.body).toBe(202);
  return result.json().data as EdgeTtsBatch;
}
async function wait(id: string) {
  for (let attempt = 0; attempt < 150; attempt++) {
    const response = await app!.inject({ method: "GET", url: `${prefix}/${id}` });
    expect(response.statusCode, response.body).toBe(200);
    const batch = response.json().data as EdgeTtsBatch;
    if (!["queued", "processing"].includes(batch.status)) return batch;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  throw new Error("Batch did not settle");
}
describe("Online speech ordered batches", () => {
  it("generates ordered independent audio, combined MP3, bilingual SRT and ZIP while keeping Chinese local", async () => {
    app = await createApp();
    const queued = await create(),
      batch = await wait(queued.id);
    expect(batch).toMatchObject({
      status: "completed",
      completedItems: 2,
      failedItems: 0,
      items: [
        { text: "Hello there.", referenceTranslation: "你好。", order: 1, attempt: 1 },
        { text: "Thank you.", referenceTranslation: "谢谢。", order: 2, attempt: 1 }
      ]
    });
    expect(batch.totalAudioDurationSeconds).toBeGreaterThan(0.5);
    const audio = await app.inject({ method: "GET", url: batch.items[0].downloadUrl! });
    expect(audio.statusCode).toBe(200);
    expect(audio.headers["content-disposition"]).toContain("001-part-1.mp3");
    for (const url of [
      batch.combinedAudioUrl!,
      batch.subtitleUrl!,
      batch.translationSubtitleUrl!,
      batch.bilingualSubtitleUrl!,
      batch.archiveUrl!
    ]) {
      const response = await app.inject({ method: "GET", url });
      expect(response.statusCode, response.body).toBe(200);
      if (url.endsWith("subtitle.zh-CN")) {
        expect(response.body).toContain("你好。");
        expect(response.body.indexOf("你好。")).toBeLessThan(response.body.indexOf("谢谢。"));
      }
      if (url.endsWith("subtitle.bilingual")) {
        expect(response.body).toContain("Hello there.");
        expect(response.body).toContain("你好。");
      }
      if (url.endsWith("download.zip")) expect(response.rawPayload.subarray(0, 2).toString()).toBe("PK");
    }
    const calls = await fsp.readFile(path.join(root, "calls.jsonl"), "utf8");
    expect(calls).not.toContain("你好");
    expect(calls).not.toContain("referenceTranslation");
    expect((await app.inject({ method: "GET", url: "/api/v1/tools/edge-tts/tasks" })).json().data.tasks).toHaveLength(
      0
    );
  }, 20000);

  it("reorders and regenerates one segment, archives immutable versions to ungrouped, and preserves library copies after source deletion", async () => {
    app = await createApp();
    let batch = await wait((await create()).id);
    const sourceId = batch.items[0].id;
    const archive = async (attempt: number) =>
      app!.inject({
        method: "POST",
        url: "/api/v1/tools/audio-library/imports/edge-tts",
        payload: { batchId: batch.id, itemIds: [sourceId], attempts: { [sourceId]: attempt }, groupId: null }
      });
    const first = (await archive(1)).json().data.results[0];
    expect(first).toMatchObject({
      status: "added",
      item: {
        groupId: null,
        language: "en",
        foreignText: "Hello there.",
        chineseText: "你好。",
        source: { kind: "edge-tts", attempt: 1 }
      }
    });
    expect((await archive(1)).json().data.results[0].status).toBe("existing");
    const ordered = await app.inject({
      method: "PATCH",
      url: `${prefix}/${batch.id}/order`,
      payload: { itemIds: batch.items.map((item) => item.id).reverse() }
    });
    expect(ordered.statusCode).toBe(200);
    batch = ordered.json().data;
    const translated = await app.inject({ method: "GET", url: batch.translationSubtitleUrl! });
    expect(translated.body.indexOf("谢谢。")).toBeLessThan(translated.body.indexOf("你好。"));
    const regenerated = await app.inject({
      method: "POST",
      url: `${prefix}/${batch.id}/items/${sourceId}/regenerate`,
      payload: {
        text: "Updated text.",
        referenceTranslation: "更新中文。",
        fileName: "updated",
        rate: 10,
        volume: 5,
        pitch: 1
      }
    });
    expect(regenerated.statusCode, regenerated.body).toBe(200);
    batch = await wait(batch.id);
    expect(batch.items.find((item) => item.id === sourceId)).toMatchObject({
      attempt: 2,
      text: "Updated text.",
      rate: 10
    });
    expect((await archive(1)).json().data.results[0].status).toBe("failed");
    const second = (await archive(2)).json().data.results[0];
    expect(second).toMatchObject({ status: "added", item: { chineseText: "更新中文。", source: { attempt: 2 } } });
    expect(second.item.id).not.toBe(first.item.id);
    expect((await app.inject({ method: "DELETE", url: `${prefix}/${batch.id}` })).statusCode).toBe(200);
    const library = (await app.inject({ method: "GET", url: "/api/v1/tools/audio-library/items" })).json().data;
    expect(library.total).toBe(2);
    expect(library.items.every((item: { available: boolean }) => item.available)).toBe(true);
  }, 20000);

  it("accepts another batch while running and cancels only not-started segments", async () => {
    app = await createApp();
    const first = await create(["slow first", "never started", "never started either"]);
    const second = await create(["Next batch"]);
    const cancel = await app.inject({ method: "POST", url: `${prefix}/${first.id}/cancel` });
    expect(cancel.statusCode).toBe(200);
    const done = await wait(first.id);
    expect(done.items.map((item) => item.status)).toEqual(["completed", "cancelled", "cancelled"]);
    expect((await wait(second.id)).status).toBe("completed");
  }, 20000);

  it("rejects invalid voices, overlong batches and capacity overflow without partially submitting", async () => {
    process.env.EDGE_TTS_QUEUE_LIMIT = "2";
    app = await createApp();
    const badVoice = await app.inject({
      method: "POST",
      url: prefix,
      payload: { ...input(), voice: "ms-MY-YasminNeural" }
    });
    expect(badVoice.statusCode).toBe(400);
    const tooLong = await app.inject({
      method: "POST",
      url: prefix,
      payload: input(["a".repeat(15000), "b".repeat(15000)])
    });
    expect(tooLong.statusCode).toBe(413);
    await create(["slow first", "second"]);
    const full = await app.inject({ method: "POST", url: prefix, payload: input(["not enqueued"]) });
    expect(full.statusCode).toBe(429);
    expect((await app.inject({ method: "GET", url: prefix })).json().data.pagination.total).toBe(1);
  });

  it("retains bilingual batches after restart and permits retry of failed segments", async () => {
    app = await createApp();
    let batch = await wait((await create(["FAIL", "good"])).id);
    expect(batch.status).toBe("partial_failed");
    await app.close();
    app = await createApp();
    const restored = await app.inject({ method: "GET", url: `${prefix}/${batch.id}` });
    expect(restored.statusCode, restored.body).toBe(200);
    batch = restored.json().data;
    expect(batch.items[0].referenceTranslation).toBe("你好。");
    const retry = await app.inject({
      method: "POST",
      url: `${prefix}/${batch.id}/items/${batch.items[0].id}/regenerate`,
      payload: { text: "Recovered.", referenceTranslation: "恢复。", rate: 0, volume: 0, pitch: 0 }
    });
    expect(retry.statusCode, retry.body).toBe(200);
    expect((await wait(batch.id)).status).toBe("completed");
  }, 20000);
});
