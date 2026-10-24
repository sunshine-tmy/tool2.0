import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ChatterboxDevice } from "@toolbox/shared";
import { getConfig, type AppConfig } from "../config";
import { ToolboxDatabase } from "../database/toolbox-database";
import { createTaskStore } from "../tasks/task-store";
import { ChatterboxTaskStore, type ChatterboxCreateInput } from "../domains/speech/chatterbox/task-store";
import { ChatterboxBatchStore, ChatterboxVoiceStore, type BatchCreateInput } from "../domains/speech/chatterbox/stores";
import { registerChatterboxRoutes } from "../domains/speech/chatterbox/routes";
import { createIsolatedAppFixture } from "./helpers/isolated-app";

let fixture: Awaited<ReturnType<typeof createIsolatedAppFixture>>;
let config: AppConfig;
let database: ToolboxDatabase;
let tasks: ChatterboxTaskStore;
let batches: ChatterboxBatchStore;
let voices: ChatterboxVoiceStore;

beforeEach(async () => {
  fixture = await createIsolatedAppFixture();
  config = getConfig({ layout: fixture.layout, dotenvPath: false, environment: { NODE_ENV: "test" } });
  database = new ToolboxDatabase(":memory:");
  const unified = createTaskStore(1000, database);
  tasks = new ChatterboxTaskStore(config.chatterboxTasksDir, database, unified);
  batches = new ChatterboxBatchStore(path.join(config.chatterboxDir, "batches"), database, unified);
  voices = new ChatterboxVoiceStore(path.join(config.chatterboxDir, "voices"), database);
});
afterEach(async () => {
  vi.restoreAllMocks();
  database.close();
  await fixture.dispose();
});

function taskInput(device: ChatterboxDevice): ChatterboxCreateInput {
  return {
    text: "Synthetic fixture",
    language: "ms",
    device,
    referenceFileName: "reference.wav",
    referenceDurationSeconds: 1,
    authorization: "self",
    consentConfirmed: true,
    exaggeration: 0.5,
    cfgWeight: 0.5,
    temperature: 0.8,
    seed: 1,
    includeSubtitles: true
  };
}
function batchInput(referenceRetained: boolean): BatchCreateInput {
  return {
    name: "Synthetic batch",
    language: "ms",
    device: "cpu",
    referenceFileName: "reference.wav",
    referenceDurationSeconds: 1,
    referenceRetained,
    authorization: "self",
    consentConfirmed: true,
    exaggeration: 0.5,
    cfgWeight: 0.5,
    temperature: 0.8,
    seed: 1,
    includeSubtitles: true,
    subtitleMode: "sentences",
    segments: [
      { text: "First fixture", referenceTranslation: "第一句" },
      { text: "Second fixture", referenceTranslation: "第二句" }
    ]
  };
}

it("keeps fixed task, batch/item and permanent voice paths under explicit Chinese/spaced roots", () => {
  const root = path.join(fixture.root, "中文 空格", "配音数据");
  const unified = createTaskStore(1000, database);
  const task = new ChatterboxTaskStore(path.join(root, "tasks"), database, unified);
  const batch = new ChatterboxBatchStore(path.join(root, "batches"), database, unified);
  const voice = new ChatterboxVoiceStore(path.join(root, "voices"), database);
  const taskDir = path.join(root, "tasks", "task-001"),
    batchDir = path.join(root, "batches", "batch-001"),
    voiceDir = path.join(root, "voices", "voice-001");
  expect(task.paths("task-001")).toEqual({
    dir: taskDir,
    meta: path.join(taskDir, "meta.json"),
    referenceUpload: path.join(taskDir, "reference-upload"),
    reference: path.join(taskDir, "reference.wav"),
    outputWav: path.join(taskDir, "output.wav"),
    audio: path.join(taskDir, "audio.mp3"),
    subtitle: path.join(taskDir, "subtitle.srt")
  });
  expect(batch.paths("batch-001")).toEqual({
    dir: batchDir,
    meta: path.join(batchDir, "meta.json"),
    referenceUpload: path.join(batchDir, "reference-upload"),
    reference: path.join(batchDir, "reference.wav"),
    combinedAudio: path.join(batchDir, "combined.mp3"),
    subtitle: path.join(batchDir, "subtitle.srt"),
    translationSubtitle: path.join(batchDir, "subtitle.zh-CN.srt"),
    bilingualSubtitle: path.join(batchDir, "subtitle.bilingual.srt")
  });
  const itemDir = path.join(batchDir, "items", "item-001");
  expect(batch.itemPaths("batch-001", "item-001")).toEqual({
    dir: itemDir,
    outputWav: path.join(itemDir, "output.wav"),
    candidateAudio: path.join(itemDir, "candidate.mp3"),
    audio: path.join(itemDir, "audio.mp3"),
    timing: path.join(itemDir, "timing.json")
  });
  expect(voice.paths("voice-001")).toEqual({
    dir: voiceDir,
    meta: path.join(voiceDir, "meta.json"),
    upload: path.join(voiceDir, "reference-upload"),
    audio: path.join(voiceDir, "reference.wav")
  });
});

it.each(["../outside", "bad!id", "short"])("keeps each store's identity guard for %j", (id) => {
  expect(() => tasks.paths(id)).toThrow("Invalid Chatterbox task id");
  expect(() => batches.paths(id)).toThrow("Invalid Chatterbox batch id");
  expect(() => batches.itemPaths("batch-001", id)).toThrow("Invalid Chatterbox item id");
  expect(() => voices.paths(id)).toThrow("Invalid Chatterbox voice id");
});

it.each(["cpu", "cuda"] as const)(
  "preserves %s task fields, domain identity, expiry and clone semantics without generation",
  async (device) => {
    await tasks.initialize();
    const task = await tasks.create("task-001", taskInput(device), 3);
    expect(task).toMatchObject({ id: "task-001", device, engine: "chatterbox-multilingual-v3", status: "queued" });
    expect(Date.parse(task.expiresAt) - Date.parse(task.createdAt)).toBe(3 * 86_400_000);
    expect(database.get("chatterbox-task", task.id)?.payload).toMatchObject({ device, status: "queued" });
    task.text = "caller mutation";
    expect(tasks.get(task.id)?.text).toBe("Synthetic fixture");
  }
);

it.each([false, true])(
  "keeps stored referenceRetained=%s, bilingual order and independent item clones",
  async (retained) => {
    await batches.initialize();
    const batch = await batches.create("batch-001", batchInput(retained), 3);
    expect(batch).toMatchObject({
      referenceRetained: retained,
      referenceAvailable: true,
      completedItems: 0,
      failedItems: 0
    });
    expect(batch.items.map((item) => [item.order, item.text, item.referenceTranslation, item.attempt])).toEqual([
      [1, "First fixture", "第一句", 1],
      [2, "Second fixture", "第二句", 1]
    ]);
    expect(database.get("chatterbox-batch", batch.id)?.payload).toMatchObject({ referenceRetained: retained });
    batch.items[0].text = "caller mutation";
    expect(batches.get(batch.id)?.items[0].text).toBe("First fixture");
  }
);

it("keeps saved voices permanent across task/batch expiry cleanup and voice-store reload", async () => {
  await Promise.all([tasks.initialize(), batches.initialize(), voices.initialize()]);
  const paths = voices.paths("voice-001");
  await fs.mkdir(paths.dir, { recursive: true });
  await fs.writeFile(paths.audio, "synthetic reference");
  const voice = await voices.create({
    id: "voice-001",
    name: "Synthetic voice",
    language: "ms",
    originalFileName: "reference.wav",
    durationSeconds: 1,
    audioBytes: 19,
    authorization: "self",
    consentConfirmed: true
  });
  await tasks.create("task-001", taskInput("cpu"), 1);
  await batches.create("batch-001", batchInput(true), 1);
  const future = Date.now() + 2 * 86_400_000;
  expect(await tasks.cleanupExpired(() => false, future)).toBe(1);
  expect(await batches.cleanupExpired(() => false, future)).toBe(1);
  expect(voices.get(voice.id)).toEqual(voice);
  expect(voice).not.toHaveProperty("expiresAt");
  expect(await fs.readFile(paths.audio, "utf8")).toBe("synthetic reference");
  const restored = new ChatterboxVoiceStore(path.join(config.chatterboxDir, "voices"), database);
  await restored.initialize();
  expect(restored.get(voice.id)).toEqual(voice);
});

it("keeps route export and store construction free of I/O or worker initialization", () => {
  const mkdir = vi.spyOn(fs, "mkdir");
  const unified = createTaskStore(1000, database);
  new ChatterboxTaskStore(config.chatterboxTasksDir, database, unified);
  new ChatterboxBatchStore(path.join(config.chatterboxDir, "batches"), database, unified);
  new ChatterboxVoiceStore(path.join(config.chatterboxDir, "voices"), database);
  expect(registerChatterboxRoutes).toBeTypeOf("function");
  expect(mkdir).not.toHaveBeenCalled();
  expect(database.list("chatterbox-task")).toEqual([]);
});
