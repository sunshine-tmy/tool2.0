import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToolboxDatabase } from "../database/toolbox-database";
import { createTaskStore } from "../tasks/task-store";
import { AudioConversionService } from "../domains/audio-convert/service";
import { AudioLibraryStore } from "../domains/audio-library/store";
import * as media from "../domains/audio-convert/media";
import { createIsolatedAppFixture } from "./helpers/isolated-app";
import { getConfig } from "../config";
import { reconcileFileMetadataStorage } from "../database/file-consistency";
const ffmpeg = process.env.TEST_FFMPEG ?? "ffmpeg",
  ffprobe = process.env.TEST_FFPROBE ?? "ffprobe";
const installed =
  spawnSync(ffmpeg, ["-version"], { windowsHide: true }).status === 0 &&
  spawnSync(ffprobe, ["-version"], { windowsHide: true }).status === 0;
const disposers: Array<() => Promise<void>> = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const dispose of disposers.splice(0).reverse()) await dispose();
});
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-audio-convert-"));
  const db = new ToolboxDatabase(path.join(root, "data.db")),
    tasks = createTaskStore(1000, db);
  const service = new AudioConversionService(root, db, tasks, async () => ({ ffmpeg, ffprobe }));
  await service.initialize();
  disposers.push(async () => {
    await service.close();
    db.close();
    if (path.dirname(root) !== os.tmpdir() || !path.basename(root).startsWith("toolbox-audio-convert-"))
      throw new Error("unsafe cleanup");
    await fs.rm(root, { recursive: true, force: true });
  });
  return { root, db, tasks, service };
}
async function source(root: string, codec: string, extension: string) {
  const file = path.join(root, `source-${codec}.${extension}`);
  const result = spawnSync(
    ffmpeg,
    [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=880:duration=0.5",
      "-metadata",
      "title=合成测试",
      "-c:a",
      codec,
      "-y",
      file
    ],
    { windowsHide: true }
  );
  expect(result.status, result.stderr?.toString()).toBe(0);
  return file;
}
async function submit(
  service: AudioConversionService,
  file: string,
  name = path.basename(file),
  ekey?: string,
  bitrate = 192
) {
  const s = await service.staging();
  await fs.copyFile(file, path.join(s.directory, "source"));
  return service.enqueue(s.id, name, bitrate, ekey);
}
async function done(service: AudioConversionService, id: string) {
  await vi.waitFor(() => expect(["completed", "failed", "canceled"]).toContain(service.get(id).status), {
    timeout: 15000,
    interval: 30
  });
  return service.get(id);
}
describe.skipIf(!installed)("real FFmpeg conversion with isolated synthetic audio", () => {
  it("supports upload, native MP3 download, one-use streaming ZIP and permanent deletion through HTTP", async () => {
    const fixture = await createIsolatedAppFixture();
    disposers.push(() => fixture.dispose());
    const app = await fixture.start({
      environment: { CHATTERBOX_FFMPEG_PATH: ffmpeg, CHATTERBOX_FFPROBE_PATH: ffprobe }
    });
    const file = await source(fixture.root, "libvorbis", "ogg"),
      bytes = await fs.readFile(file),
      prefix = "/api/v1/tools/audio-convert";
    const payload = Buffer.concat([
      Buffer.from(
        '--boundary\r\nContent-Disposition: form-data; name="bitrate"\r\n\r\n256\r\n--boundary\r\nContent-Disposition: form-data; name="file"; filename="test.ogg"\r\nContent-Type: audio/ogg\r\n\r\n'
      ),
      bytes,
      Buffer.from("\r\n--boundary--\r\n")
    ]);
    const accepted = await app.inject({
      method: "POST",
      url: `${prefix}/uploads`,
      headers: { "content-type": "multipart/form-data; boundary=boundary" },
      payload
    });
    expect(accepted.statusCode).toBe(200);
    const id = accepted.json().data.id;
    await vi.waitFor(
      async () => expect((await app.inject(`${prefix}/jobs/${id}`)).json().data.status).toBe("completed"),
      { timeout: 15000, interval: 50 }
    );
    expect((await app.inject(`${prefix}/completed-selection`)).json().data).toEqual({ ids: [id], total: 1 });
    for (let i = 0; i < 31; i++) {
      const added = await app.inject({
        method: "POST",
        url: `${prefix}/jobs/${id}/library`,
        payload: { groupId: null, purpose: "music" }
      });
      expect(added.statusCode, added.body).toBe(200);
      expect(added.json().data.existing).toBe(i > 0);
    }
    const download = await app.inject(`${prefix}/jobs/${id}/audio`);
    expect(download.statusCode).toBe(200);
    expect(download.headers["content-type"]).toContain("audio/mpeg");
    expect(download.rawPayload.length).toBeGreaterThan(0);
    const ticket = (await app.inject({ method: "POST", url: `${prefix}/downloads`, payload: { ids: [id] } })).json()
      .data;
    const zip = await app.inject(ticket.url);
    expect(zip.statusCode).toBe(200);
    expect(zip.rawPayload.subarray(0, 2).toString()).toBe("PK");
    expect((await app.inject(ticket.url)).statusCode).toBe(404);
    expect((await app.inject({ method: "DELETE", url: `${prefix}/jobs/${id}` })).statusCode).toBe(200);
    expect((await app.inject(`${prefix}/jobs`)).json().data).toEqual({ items: [], total: 0 });
  }, 30000);
  it.each([
    ["flac", "flac"],
    ["libvorbis", "ogg"],
    ["libopus", "ogg"]
  ])(
    "converts %s, validates output and cleans uploaded copies",
    async (codec, extension) => {
      const { root, service, db } = await fixture(),
        file = await source(root, codec, extension),
        original = await fs.readFile(file);
      const job = await submit(service, file);
      const result = await done(service, job.id);
      expect(result.status, result.error).toBe("completed");
      expect(result.bytes).toBeGreaterThan(0);
      expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect((db.get("task", job.id)!.payload as { status: string }).status).toBe("completed");
      expect(await fs.readdir(path.join(service.root, "staging"))).toEqual([]);
      expect(await fs.readFile(file)).toEqual(original);
      const held = await service.acquire(job.id);
      await expect(service.remove(job.id)).rejects.toMatchObject({ code: "AUDIO_CONVERT_IN_USE" });
      held.release();
      held.release();
      await service.remove(job.id);
      expect(db.get("audio-convert-job", job.id)).toBeUndefined();
      expect(db.listFiles().some((f) => f.entityId === job.id)).toBe(false);
      await expect(fs.stat(service.file(job.id))).rejects.toMatchObject({ code: "ENOENT" });
    },
    30000
  );
  it("decodes a synthetic musicex file with a manual per-file key and never persists the key", async () => {
    const { root, service, db } = await fixture(),
      file = await source(root, "flac", "flac"),
      bytes = await fs.readFile(file),
      key = Buffer.alloc(32, 17);
    const { qmcTransform } = await import("../domains/audio-convert/qmc");
    qmcTransform(bytes, key);
    const footer = Buffer.alloc(192);
    footer.writeUInt32LE(192, 176);
    footer.writeUInt32LE(1, 180);
    footer.write("musicex\0", 184);
    const encrypted = path.join(root, "加密.mflac");
    await fs.writeFile(encrypted, Buffer.concat([bytes, footer]));
    const absent = await submit(service, encrypted);
    expect((await done(service, absent.id)).errorCode).toBe("AUDIO_CONVERT_KEY_REQUIRED");
    const wrong = await submit(service, encrypted, "加密.mflac", Buffer.alloc(32, 22).toString("base64"));
    expect((await done(service, wrong.id)).errorCode).toBe("AUDIO_CONVERT_KEY_MISMATCH");
    const converted = await submit(service, encrypted, "加密.mflac", key.toString("base64"));
    expect((await done(service, converted.id)).status).toBe("completed");
    expect(JSON.stringify(db.list("audio-convert-job"))).not.toContain(key.toString("base64"));
  }, 30000);
  it("keeps the independent library copy after conversion deletion, with explicit purpose/group", async () => {
    const { root, db, service } = await fixture();
    const library = new AudioLibraryStore(root, db, 1024 ** 3);
    await library.initialize();
    const group = await library.group({ name: "转换配乐", parentId: null });
    const job = await submit(service, await source(root, "flac", "flac"));
    expect((await done(service, job.id)).status).toBe("completed");
    const added = await service.addToLibrary(job.id, library, group.id, "music");
    expect(added.item).toMatchObject({ purpose: "music", groupId: group.id, fileName: "audio.mp3" });
    await service.remove(job.id);
    expect((await fs.stat(library.file(added.item))).size).toBe(added.item.bytes);
  }, 30000);
  it("cancels an active conversion and releases the serial queue", async () => {
    const { root, service } = await fixture(),
      original = media.convertAudio;
    const started = vi.fn();
    vi.spyOn(media, "convertAudio")
      .mockImplementationOnce(async (_i, _o, _t, _p, _b, signal) => {
        started();
        await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
        signal.throwIfAborted();
      })
      .mockImplementation(original);
    const file = await source(root, "flac", "flac"),
      first = await submit(service, file),
      second = await submit(service, await source(root, "libvorbis", "ogg"));
    await vi.waitFor(() => expect(started).toHaveBeenCalled());
    await service.cancel(first.id);
    expect((await done(service, first.id)).status).toBe("canceled");
    expect((await done(service, second.id)).status).toBe("completed");
    expect(await fs.readdir(path.join(service.root, "staging"))).toEqual([]);
  }, 30000);
  it("reuses concurrent identical inputs and admits a new task after cancellation", async () => {
    const { root, service, db } = await fixture(),
      original = media.convertAudio;
    const started = vi.fn();
    vi.spyOn(media, "convertAudio")
      .mockImplementationOnce(async (_i, _o, _t, _p, _b, signal) => {
        started();
        await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
        signal.throwIfAborted();
      })
      .mockImplementation(original);
    const file = await source(root, "flac", "flac");
    const [first, duplicate] = await Promise.all([submit(service, file), submit(service, file, "改名.flac")]);
    expect(duplicate.id).toBe(first.id);
    expect(db.list("audio-convert-job")).toHaveLength(1);
    await vi.waitFor(() => expect(started).toHaveBeenCalled());
    await service.cancel(first.id);
    expect((await done(service, first.id)).status).toBe("canceled");
    const retried = await submit(service, file);
    expect(retried.id).not.toBe(first.id);
    expect((await done(service, retried.id)).status).toBe("completed");
    expect(await fs.readdir(path.join(service.root, "staging"))).toEqual([]);
  }, 30000);
  it("deduplicates by content and bitrate rather than filename, and validates completed files", async () => {
    const { root, service, db } = await fixture();
    const convert = vi.spyOn(media, "convertAudio"),
      file = await source(root, "flac", "flac");
    const first = await submit(service, file);
    expect((await done(service, first.id)).status).toBe("completed");
    expect(service.get(first.id).sourceSha256).toMatch(/^[a-f0-9]{64}$/);
    const reused = await submit(service, file, "另一文件名.flac");
    expect(reused.id).toBe(first.id);
    expect(convert).toHaveBeenCalledTimes(1);
    const higher = await submit(service, file, "同名.flac", undefined, 320);
    expect(higher.id).not.toBe(first.id);
    expect((await done(service, higher.id)).status).toBe("completed");
    const other = await submit(service, await source(root, "libvorbis", "ogg"), first.name);
    expect(other.id).not.toBe(first.id);
    expect((await done(service, other.id)).status).toBe("completed");
    const originalBytes = await fs.readFile(service.file(first.id));
    const corrupt = Buffer.from(originalBytes);
    corrupt[0] ^= 1;
    await fs.writeFile(service.file(first.id), corrupt);
    const repaired = await submit(service, file);
    expect(repaired.id).not.toBe(first.id);
    expect((await done(service, repaired.id)).status).toBe("completed");
    expect(await fs.readFile(service.file(first.id))).toEqual(corrupt);
    await fs.unlink(service.file(repaired.id));
    const missing = await submit(service, file);
    expect(missing.id).not.toBe(repaired.id);
    expect((await done(service, missing.id)).status).toBe("completed");
    expect(db.list("audio-convert-job")).toHaveLength(5);
  }, 30000);
  it("waits for a pending deduplication check on shutdown without admitting work after close", async () => {
    const { root, service, db } = await fixture();
    const file = await source(root, "flac", "flac"),
      first = await submit(service, file);
    expect((await done(service, first.id)).status).toBe("completed");
    let finish!: () => void;
    const started = vi.fn();
    vi.spyOn(service, "acquire").mockImplementationOnce(async () => {
      started();
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      throw new Error("output disappeared");
    });
    const duplicate = submit(service, file);
    await vi.waitFor(() => expect(started).toHaveBeenCalled());
    let closed = false;
    const closing = service.close().then(() => {
      closed = true;
    });
    await Promise.resolve();
    expect(closed).toBe(false);
    const rejected = expect(duplicate).rejects.toMatchObject({ code: "AUDIO_CONVERT_STOPPING" });
    finish();
    await rejected;
    await closing;
    expect(db.list("audio-convert-job")).toHaveLength(1);
  }, 30000);
  it("does not expose a success if committing the final domain record fails", async () => {
    const { root, service, db } = await fixture(),
      write = db.upsert.bind(db);
    let failed = false;
    vi.spyOn(db, "upsert").mockImplementation((row) => {
      if (row.kind === "audio-convert-job" && row.status === "completed" && !failed) {
        failed = true;
        throw new Error("injected commit fault");
      }
      return write(row);
    });
    const job = await submit(service, await source(root, "flac", "flac"));
    expect((await done(service, job.id)).status).toBe("failed");
    await expect(service.acquire(job.id)).rejects.toMatchObject({ code: "AUDIO_CONVERT_NOT_READY" });
    await vi.waitFor(async () => {
      await expect(fs.stat(service.file(job.id))).rejects.toMatchObject({ code: "ENOENT" });
    });
  }, 30000);
});
it("recovers interrupted history without automatically reusing temporary inputs", async () => {
  const { db, service } = await fixture(),
    now = new Date().toISOString();
  db.upsert({
    kind: "audio-convert-job",
    id: "interrupted",
    status: "running",
    createdAt: now,
    updatedAt: now,
    payload: {
      id: "interrupted",
      name: "old.ogg",
      bitrate: 192,
      status: "running",
      progress: 20,
      createdAt: now,
      updatedAt: now
    }
  });
  await fs.mkdir(path.dirname(service.file("interrupted")), { recursive: true });
  await fs.writeFile(service.file("interrupted"), "uncommitted output");
  await service.initialize();
  expect(service.get("interrupted")).toMatchObject({ status: "failed", errorCode: "AUDIO_CONVERT_INTERRUPTED" });
  await expect(fs.stat(service.file("interrupted"))).rejects.toMatchObject({ code: "ENOENT" });
});
it.skipIf(!installed)(
  "reports corruption without deleting the permanent conversion file",
  async () => {
    const { root, service, db } = await fixture(),
      job = await submit(service, await source(root, "flac", "flac"));
    expect((await done(service, job.id)).status).toBe("completed");
    const file = service.file(job.id),
      data = await fs.readFile(file);
    data[0] ^= 1;
    await fs.writeFile(file, data);
    await expect(service.acquire(job.id)).rejects.toMatchObject({ code: "AUDIO_CONVERT_OUTPUT_MISSING" });
    expect((await fs.stat(file)).size).toBe(data.length);
    expect(service.get(job.id).status).toBe("completed");
    const config = getConfig({ dotenvPath: false, environment: { STORAGE_ROOT: root, DATABASE_PATH: db.path } });
    await reconcileFileMetadataStorage(config, db);
    expect((await fs.stat(file)).size).toBe(data.length);
  },
  30000
);
it("validates multipart inputs, paging and traversal through real app routes", async () => {
  const f = await createIsolatedAppFixture();
  disposers.push(() => f.dispose());
  const app = await f.start();
  expect((await app.inject({ method: "GET", url: "/api/v1/tools/audio-convert/jobs" })).json().data).toEqual({
    items: [],
    total: 0
  });
  expect((await app.inject({ method: "GET", url: "/api/v1/tools/audio-convert/jobs?page=0" })).statusCode).toBe(400);
  const payload = Buffer.from(
    '--boundary\r\nContent-Disposition: form-data; name="file"; filename="bad.txt"\r\nContent-Type: application/octet-stream\r\n\r\nnot audio\r\n--boundary--\r\n'
  );
  const result = await app.inject({
    method: "POST",
    url: "/api/v1/tools/audio-convert/uploads",
    headers: { "content-type": "multipart/form-data; boundary=boundary" },
    payload
  });
  expect(result.statusCode).toBe(400);
  expect(result.json().error.code).toBe("AUDIO_CONVERT_INPUT_INVALID");
  expect(
    (await app.inject({ method: "GET", url: "/api/v1/tools/audio-convert/jobs/%2e%2e/audio" })).statusCode
  ).not.toBe(200);
});
it("selects only completed records across pages with a bounded deterministic order", async () => {
  const { service, db } = await fixture();
  for (let i = 0; i < 1003; i++) {
    const id = `selection${String(i).padStart(4, "0")}`,
      now = "2026-11-01T00:00:00.000Z";
    const status = i < 1001 ? "completed" : i === 1001 ? "running" : "failed";
    db.upsert({
      kind: "audio-convert-job",
      id,
      status,
      createdAt: now,
      updatedAt: now,
      payload: {
        id,
        name: "合成.flac",
        bitrate: 192,
        status,
        progress: status === "completed" ? 100 : 0,
        createdAt: now,
        updatedAt: now
      }
    });
  }
  const selection = service.completedSelection();
  expect(selection.total).toBe(1001);
  expect(selection.ids).toHaveLength(1000);
  expect(selection.ids[0]).toBe("selection1000");
  expect(selection.ids.at(-1)).toBe("selection0001");
});
it("rejects disk-starved uploads before admitting work or writing source files", async () => {
  const { root, service, db } = await fixture();
  const disk = await fs.statfs(root);
  vi.spyOn(fs, "statfs").mockResolvedValue({ ...disk, bavail: 1, bsize: 1 });
  await expect(service.staging()).rejects.toMatchObject({ code: "AUDIO_CONVERT_DISK_FULL" });
  expect(db.list("audio-convert-job")).toEqual([]);
  expect(await fs.readdir(path.join(service.root, "staging"))).toEqual([]);
});
