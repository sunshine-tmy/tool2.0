import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WORKER_PROTOCOL_VERSION, type EdgeTtsCreateTaskInput } from "@toolbox/shared";
import { getConfig, type AppConfig } from "../config";
import { ToolboxDatabase } from "../database/toolbox-database";
import { createTaskStore } from "../tasks/task-store";
import { EdgeTtsTaskRepository } from "../domains/speech/edge-tts/task-repository";
import { EdgeTtsTaskService } from "../domains/speech/edge-tts/task-service";
import { EdgeTtsWorkerGateway } from "../domains/speech/edge-tts/worker-gateway";
import { registerEdgeTtsRoutes } from "../domains/speech/edge-tts";
import { createIsolatedAppFixture } from "./helpers/isolated-app";

let fixture: Awaited<ReturnType<typeof createIsolatedAppFixture>>;
let config: AppConfig;
let database: ToolboxDatabase;
let repository: EdgeTtsTaskRepository;
const input: EdgeTtsCreateTaskInput = {
  text: "Synthetic relocation fixture",
  language: "en-US",
  voice: "en-US-JennyNeural",
  rate: 0,
  volume: 0,
  pitch: 0,
  includeSubtitles: true
};

beforeEach(async () => {
  fixture = await createIsolatedAppFixture();
  config = getConfig({ layout: fixture.layout, dotenvPath: false, environment: { NODE_ENV: "test" } });
  database = new ToolboxDatabase(":memory:");
  repository = new EdgeTtsTaskRepository(config.edgeTtsTasksDir, database, createTaskStore(1000, database));
});
afterEach(async () => {
  vi.restoreAllMocks();
  database.close();
  await fixture.dispose();
});

it("keeps all task filenames under the configured storage root, independent of the source directory", () => {
  const root = path.join(fixture.root, "中文 空格", "自定义任务");
  const store = new EdgeTtsTaskRepository(root, database, createTaskStore(1000, database));
  const dir = path.join(root, "task-001");
  expect(store.paths("task-001")).toEqual({
    dir,
    meta: path.join(dir, "meta.json"),
    request: path.join(dir, "request.json"),
    audio: path.join(dir, "audio.mp3"),
    audioTemp: path.join(dir, "audio.tmp.mp3"),
    subtitle: path.join(dir, "subtitle.srt"),
    subtitleTemp: path.join(dir, "subtitle.tmp.srt")
  });
});

it.each(["../outside", "bad!id", "short"])("rejects invalid task identity %j before filesystem access", (id) => {
  const mkdir = vi.spyOn(fs, "mkdir");
  expect(() => repository.paths(id)).toThrow("Invalid Edge-TTS task id");
  expect(mkdir).not.toHaveBeenCalled();
});

it("keeps request protocol, domain kind, batch ownership, expiry and cloned task records", async () => {
  await repository.initialize();
  const task = await repository.create(input, 3, "batch-001");
  const paths = repository.paths(task.id);
  expect(JSON.parse(await fs.readFile(paths.request, "utf8"))).toEqual({
    protocolVersion: WORKER_PROTOCOL_VERSION,
    ...input
  });
  expect(database.get("edge-tts-task", task.id)?.payload).toMatchObject({ status: "queued", batchId: "batch-001" });
  expect(Date.parse(task.expiresAt) - Date.parse(task.createdAt)).toBe(3 * 24 * 60 * 60 * 1000);
  task.text = "caller mutation";
  expect(repository.get(task.id)?.text).toBe(input.text);
});

it("uses the original config object for a worker in a Chinese/spaced directory and commits fixed output names", async () => {
  const gateway = new EdgeTtsWorkerGateway(config);
  const directory = path.join(fixture.root, "中文 空格 Worker");
  await fs.mkdir(directory, { recursive: true });
  const helper = path.join(directory, "worker.cjs");
  await fs.writeFile(
    helper,
    String.raw`
const fs = require("node:fs");
const command = process.argv[2];
if (command === "check") console.log(JSON.stringify({protocolVersion: 1, available: true, version: "synthetic"}));
else if (command === "voices") console.log(JSON.stringify({protocolVersion: 1, voices: [{name:"Jenny",shortName:"en-US-JennyNeural",locale:"en-US",gender:"Female"}]}));
else {
  const arg = name => process.argv[process.argv.indexOf(name)+1];
  const request = JSON.parse(fs.readFileSync(arg("--input"), "utf8"));
  if (request.protocolVersion !== 1) process.exit(2);
  fs.writeFileSync(arg("--audio"), "ID3synthetic");
  if (process.argv.includes("--subtitle")) fs.writeFileSync(arg("--subtitle"), "synthetic subtitle");
  console.log(JSON.stringify({protocolVersion: 1, audioBytes: 12}));
}
`,
    "utf8"
  );
  config.edgeTtsPythonPath = process.execPath;
  config.edgeTtsScriptPath = helper;
  expect(await gateway.check()).toMatchObject({ available: true, version: "synthetic" });
  expect(await gateway.listVoices()).toMatchObject([{ shortName: "en-US-JennyNeural", suggested: false }]);
  await repository.initialize();
  const task = await repository.create(input, 3);
  await gateway.generate(task, repository.paths(task.id), new AbortController().signal);
  expect((await fs.readdir(repository.paths(task.id).dir)).sort()).toEqual([
    "audio.mp3",
    "meta.json",
    "request.json",
    "subtitle.srt"
  ]);
  expect(await fs.readFile(repository.paths(task.id).audio, "utf8")).toBe("ID3synthetic");
  expect(await fs.readFile(repository.paths(task.id).subtitle, "utf8")).toBe("synthetic subtitle");
});

it.each([false, true])("keeps missing-worker guidance for desktopManagedCapabilities=%s", async (managed) => {
  config.desktopManagedCapabilities = managed;
  config.edgeTtsPythonPath = path.join(fixture.root, "uninstalled-python.exe");
  config.edgeTtsScriptPath = path.join(fixture.root, "uninstalled-worker.py");
  expect(await new EdgeTtsWorkerGateway(config).check()).toEqual({
    available: false,
    message: managed
      ? "Edge-TTS 尚未安装，请前往设置 → 能力管理安装。"
      : "Edge-TTS 尚未安装，请运行 scripts/setup-edge-tts.ps1"
  });
});

it("keeps the route export and service construction side-effect-free before initialize", () => {
  const mkdir = vi.spyOn(fs, "mkdir");
  const service = new EdgeTtsTaskService(config, database, createTaskStore(1000, database));
  expect(registerEdgeTtsRoutes).toBeTypeOf("function");
  expect(service.queue.stats()).toEqual({ active: 0, queued: 0 });
  expect(mkdir).not.toHaveBeenCalled();
  expect(database.list("edge-tts-task")).toEqual([]);
});
