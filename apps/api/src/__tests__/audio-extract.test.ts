import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AudioExtractionService } from "../domains/audio-extract/service";
import * as media from "../domains/audio-extract/media";
import { AudioLibraryStore } from "../domains/audio-library/store";
import { hashAudio } from "../domains/audio-library/media";
import { ToolboxDatabase } from "../database/toolbox-database";
import { createTaskStore } from "../tasks/task-store";
import { createIsolatedAppFixture } from "./helpers/isolated-app";
import { resolveFfmpegTools } from "../core/media/runtime";
import { runMediaCommand } from "../core/media/process";
import * as gateway from "../storage/file-commit-gateway";
const tools = { ffmpeg: process.env.TEST_FFMPEG ?? "ffmpeg", ffprobe: process.env.TEST_FFPROBE ?? "ffprobe" };
const available = Object.values(tools).every((exe) => spawnSync(exe, ["-version"], { windowsHide: true }).status === 0);
const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const close of cleanup.splice(0).reverse()) await close();
});
function command(exe: string, args: string[]) {
  const r = spawnSync(exe, args, { windowsHide: true, encoding: "utf8", maxBuffer: 4 * 1024 ** 2 });
  expect(r.status, r.stderr).toBe(0);
  return r.stdout;
}
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-audio-extract-"));
  const db = new ToolboxDatabase(path.join(root, "data.db")),
    tasks = createTaskStore(1000, db),
    errors = vi.fn();
  const service = new AudioExtractionService(root, db, tasks, async () => tools, errors);
  await service.initialize();
  cleanup.push(async () => {
    await service.close();
    db.close();
    expect(path.dirname(root)).toBe(path.resolve(os.tmpdir()));
    expect(path.basename(root)).toMatch(/^toolbox-audio-extract-/);
    await fs.rm(root, { recursive: true, force: true });
  });
  return { root, db, tasks, service, errors };
}
async function video(root: string, ext = "mp4", codec = "aac", multi = false, silent = false) {
  const file = path.join(root, `合成 测试-${codec}${multi ? "multi" : ""}${silent ? "silent" : ""}.${ext}`);
  command(tools.ffmpeg, [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=blue:s=96x64:d=1",
    ...(silent ? [] : ["-f", "lavfi", "-i", "sine=frequency=440:duration=1"]),
    ...(multi ? ["-f", "lavfi", "-i", "sine=frequency=880:duration=1"] : []),
    "-map",
    "0:v",
    ...(silent ? [] : ["-map", "1:a"]),
    ...(multi ? ["-map", "2:a"] : []),
    "-c:v",
    ext === "webm" ? "libvpx-vp9" : "mpeg4",
    ...(silent ? [] : ["-c:a", codec, "-metadata:s:a:0", "language=zho"]),
    ...(codec === "dca" ? ["-strict", "-2", "-ac", "2"] : []),
    ...(multi ? ["-metadata:s:a:1", "language=eng", "-disposition:a:0", "0", "-disposition:a:1", "default"] : []),
    "-y",
    file
  ]);
  return file;
}
async function source(service: AudioExtractionService, file: string) {
  const s = await service.reserve(path.basename(file));
  await fs.copyFile(file, s.file);
  return service.inspect(s.id, await hashAudio(file), (await fs.stat(file)).size);
}
async function submit(
  service: AudioExtractionService,
  file: string,
  format: "mp3" | "original" = "mp3",
  all = false,
  bitrate: 128 | 192 | 256 | 320 = 192
) {
  const s = await source(service, file);
  return service.create({
    sourceId: s.id,
    trackIndices: all ? s.tracks.map((t) => t.index) : [s.tracks[0].index],
    format,
    bitrate
  });
}
async function done(service: AudioExtractionService, id: string) {
  await vi.waitFor(() => expect(["completed", "failed", "canceled"]).toContain(service.get(id).status), {
    timeout: 20000,
    interval: 30
  });
  return service.get(id);
}
it("resolves installed media tools first and never uses a system fallback in managed desktop mode", async () => {
  const asset = vi.fn(async (p: string) => `/installed/${p}`);
  expect((await resolveFfmpegTools({ managed: true, fallback: { ffmpeg: "wrong" }, asset })).ffmpeg).toContain(
    "/installed/bin/ffmpeg"
  );
  const unavailable = async () => {
    throw Error("missing");
  };
  expect(await resolveFfmpegTools({ managed: false, fallback: tools, asset: unavailable })).toEqual(tools);
  await expect(resolveFfmpegTools({ managed: true, fallback: tools, asset: unavailable })).rejects.toThrow(
    "FFMPEG_UNAVAILABLE"
  );
});
it("bounds subprocess output, timeout and abort while waiting for the owned child to close", async () => {
  const error = (reason: string) => new Error(reason);
  await expect(
    runMediaCommand(
      process.execPath,
      ["-e", "process.stdout.write('x'.repeat(1100000));setInterval(()=>{},1000)"],
      new AbortController().signal,
      { error }
    )
  ).rejects.toThrow("output");
  await expect(
    runMediaCommand(process.execPath, ["-e", "setInterval(()=>{},1000)"], new AbortController().signal, {
      error,
      timeoutMs: 50
    })
  ).rejects.toThrow("timeout");
  const controller = new AbortController();
  const work = runMediaCommand(process.execPath, ["-e", "setInterval(()=>{},1000)"], controller.signal, { error });
  controller.abort();
  await expect(work).rejects.toThrow("canceled");
  await expect(runMediaCommand("/does-not-exist", [], new AbortController().signal, { error })).rejects.toThrow(
    "unavailable"
  );
  let progressBytes = 0;
  expect(
    await runMediaCommand(
      process.execPath,
      ["-e", "process.stdout.write('x'.repeat(1500000))"],
      new AbortController().signal,
      {
        error,
        captureOutput: false,
        onOutput: (value) => {
          progressBytes += value.length;
        }
      }
    )
  ).toBe("");
  expect(progressBytes).toBe(1500000);
});
describe.skipIf(!available)("isolated FFmpeg video audio extraction", () => {
  it.each([
    ["mp4", "aac"],
    ["mov", "aac"],
    ["mkv", "flac"],
    ["avi", "libmp3lame"],
    ["webm", "libopus"]
  ])(
    "extracts %s with %s to MP3 without changing the source",
    async (ext, codec) => {
      const { root, service, db } = await fixture(),
        file = await video(root, ext, codec),
        before = await hashAudio(file);
      const {
        items: [job]
      } = await submit(service, file);
      const result = await done(service, job.id);
      expect(result.status, result.error).toBe("completed");
      expect(result.bytes).toBeGreaterThan(0);
      expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(await hashAudio(file)).toBe(before);
      expect(await media.probeTracks(service.file(result), tools, new AbortController().signal, false)).toHaveLength(1);
      expect(db.get("task", job.id)?.status).toBe("completed");
      expect(db.listFiles().some((f) => f.entityId === job.id)).toBe(true);
      await vi.waitFor(async () => expect(await fs.readdir(path.join(service.root, "staging"))).toEqual([]));
    },
    30000
  );
  it("selects independent language tracks and streamcopies the original packet payload unchanged", async () => {
    const { root, service } = await fixture(),
      file = await video(root, "mkv", "flac", true),
      info = await source(service, file);
    expect(info.tracks.map((t) => t.language)).toEqual(["zho", "eng"]);
    expect(info.tracks[1].default).toBe(true);
    const jobs = await service.create({
      sourceId: info.id,
      trackIndices: info.tracks.map((t) => t.index),
      format: "original",
      bitrate: 192
    });
    for (const job of jobs.items) {
      const result = await done(service, job.id);
      expect(result.status, result.error).toBe("completed");
      const hashes = (f: string, selector: string) =>
        JSON.parse(
          command(tools.ffprobe, [
            "-v",
            "error",
            "-select_streams",
            selector,
            "-show_packets",
            "-show_entries",
            "packet=data_hash",
            "-show_data_hash",
            "sha256",
            "-of",
            "json",
            f
          ])
        ).packets.map((p: { data_hash: string }) => p.data_hash);
      expect(hashes(service.file(result), "a:0")).toEqual(hashes(file, String(job.track.index)));
    }
    expect(jobs.items[0].id).not.toBe(jobs.items[1].id);
  }, 30000);
  it.each([
    ["mp4", "aac", "m4a"],
    ["webm", "libopus", "ogg"],
    ["avi", "pcm_s16le", "wav"],
    ["mkv", "ac3", "mka"],
    ["mkv", "eac3", "mka"],
    ["mkv", "mp2", "mka"],
    ["mkv", "dca", "mka"],
    ["mkv", "alac", "m4a"],
    ["webm", "libvorbis", "ogg"]
  ])(
    "keeps original %s audio in compatible %s output (%s)",
    async (ext, codec, expected) => {
      const { root, service } = await fixture();
      const {
        items: [job]
      } = await submit(service, await video(root, ext, codec), "original");
      const result = await done(service, job.id);
      expect(result.status, result.error).toBe("completed");
      expect(result.extension).toBe(expected);
    },
    30000
  );
  it("deduplicates valid outputs, separates bitrate/track settings, and replaces missing outputs", async () => {
    const { root, service } = await fixture(),
      file = await video(root);
    const first = (await submit(service, file)).items[0];
    await done(service, first.id);
    const duplicate = (await submit(service, file)).items[0];
    expect(duplicate.id).toBe(first.id);
    const other = (await submit(service, file, "mp3", false, 128)).items[0];
    expect(other.id).not.toBe(first.id);
    await done(service, other.id);
    await fs.unlink(service.file(service.get(first.id)));
    const replacement = (await submit(service, file)).items[0];
    expect(replacement.id).not.toBe(first.id);
    expect((await done(service, replacement.id)).status).toBe("completed");
  }, 30000);
  it("limits staged sources, expires unused input, and marks interrupted jobs without resuming", async () => {
    const { root, service, db, tasks } = await fixture(),
      file = await video(root),
      a = await source(service, file),
      b = await source(service, file);
    await expect(service.reserve("third.mp4")).rejects.toMatchObject({ status: 429 });
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 3 * 3600000);
    await expect(
      service.create({ sourceId: a.id, trackIndices: [1], format: "mp3", bitrate: 192 })
    ).rejects.toMatchObject({ status: 410 });
    const next = await service.reserve("next.mp4");
    expect(next.id).not.toBe(a.id);
    await service.discard(next.id);
    expect(tasks.get(b.id)).toBeUndefined();
    vi.restoreAllMocks();
    const started = (await submit(service, file)).items[0];
    await done(service, started.id);
    await service.close();
    const row = db.get("audio-extract-job", started.id)!;
    db.upsert({ ...row, status: "running", payload: { ...(row.payload as object), status: "running" } });
    const restarted = new AudioExtractionService(root, db, tasks, async () => tools);
    await restarted.initialize();
    try {
      expect(restarted.get(started.id).errorCode).toBe("AUDIO_EXTRACT_INTERRUPTED");
      await expect(fs.stat(restarted.file(restarted.get(started.id)))).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await restarted.close();
    }
  }, 30000);
  it("cancels an active task before publishing and releases its source", async () => {
    const { root, service } = await fixture();
    const file = await video(root);
    const called = vi.fn();
    vi.spyOn(media, "extractTrack").mockImplementationOnce(async (_i, _o, _track, _format, _b, _tools, signal) => {
      called();
      await new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(Error("aborted")), { once: true });
      });
      return { bytes: 1, duration: 1 };
    });
    const {
      items: [job]
    } = await submit(service, file);
    await vi.waitFor(() => expect(called).toHaveBeenCalled());
    await expect(service.remove(job.id)).rejects.toMatchObject({ status: 409 });
    await service.cancel(job.id);
    expect((await done(service, job.id)).status).toBe("canceled");
    await vi.waitFor(async () => expect(await fs.readdir(path.join(service.root, "staging"))).toEqual([]));
  });
  it("never publishes success when durable file commit fails", async () => {
    const { root, service, db } = await fixture();
    vi.spyOn(gateway, "commitStagedFile").mockRejectedValueOnce(Error("disk failure"));
    const {
      items: [job]
    } = await submit(service, await video(root));
    expect((await done(service, job.id)).status).toBe("failed");
    expect(db.listFiles().some((f) => f.entityId === job.id)).toBe(false);
  });
  it("unwinds partial multi-track admission without leaving orphan jobs or starting extraction", async () => {
    const { root, service, db, tasks } = await fixture(),
      file = await video(root, "mkv", "flac", true);
    const original = db.upsert.bind(db);
    let writes = 0;
    vi.spyOn(db, "upsert").mockImplementation((row) => {
      if (row.kind === "audio-extract-job" && ++writes === 2) throw Error("second admission failed");
      return original(row);
    });
    const extracted = vi.spyOn(media, "extractTrack");
    await expect(submit(service, file, "mp3", true)).rejects.toThrow("second admission failed");
    expect(db.list("audio-extract-job")).toEqual([]);
    expect(extracted).not.toHaveBeenCalled();
    expect(tasks.list().filter((t) => t.toolId === "audio-extract")).toHaveLength(1);
  });
  it("pins downloads and copies original or explicitly converted audio into an independent library group", async () => {
    const { root, service, db } = await fixture(),
      library = new AudioLibraryStore(root, db, 1024 ** 3);
    await library.initialize();
    const group = await library.group({ name: "提取配乐", parentId: null });
    const {
      items: [job]
    } = await submit(service, await video(root, "webm", "libopus"), "original");
    await done(service, job.id);
    const held = await service.acquire(job.id);
    await expect(service.remove(job.id)).rejects.toMatchObject({ status: 409 });
    held.release();
    held.release();
    await expect(service.addToLibrary(job.id, library, group.id, "music", false)).rejects.toMatchObject({
      code: "AUDIO_EXTRACT_LIBRARY_FORMAT"
    });
    const added = await service.addToLibrary(job.id, library, group.id, "music", true);
    expect(added.item).toMatchObject({ groupId: group.id, purpose: "music", fileName: "audio.mp3" });
    await service.remove(job.id);
    expect((await fs.stat(library.file(added.item))).size).toBe(added.item.bytes);
  }, 30000);
  it("validates multipart and stream IDs through HTTP, and serves Range and one-use ZIP", async () => {
    const f = await createIsolatedAppFixture();
    cleanup.push(() => f.dispose());
    const app = await f.start({
      environment: { CHATTERBOX_FFMPEG_PATH: tools.ffmpeg, CHATTERBOX_FFPROBE_PATH: tools.ffprobe }
    });
    const file = await video(f.root),
      bytes = await fs.readFile(file),
      root = "/api/v1/tools/audio-extract";
    const upload = (name: string, data: Buffer, tail = "") =>
      app.inject({
        method: "POST",
        url: `${root}/sources`,
        headers: { "content-type": "multipart/form-data; boundary=extracttest" },
        payload: Buffer.concat([
          Buffer.from(
            `--extracttest\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: video/mp4\r\n\r\n`
          ),
          data,
          Buffer.from(`\r\n${tail}--extracttest--\r\n`)
        ])
      });
    expect((await upload("fake.mp4", Buffer.from("garbage"))).statusCode).toBe(415);
    expect(
      (await upload("x.mp4", bytes, '--extracttest\r\nContent-Disposition: form-data; name="extra"\r\n\r\nno\r\n'))
        .statusCode
    ).toBe(400);
    const s = await upload("测试.mp4", bytes);
    expect(s.statusCode, s.body).toBe(200);
    const info = s.json().data;
    const input = { sourceId: info.id, trackIndices: [info.tracks[0].index], format: "mp3", bitrate: 192 };
    expect(
      (await app.inject({ method: "POST", url: `${root}/jobs`, payload: { ...input, trackIndices: [999] } })).statusCode
    ).toBe(400);
    expect(
      (await app.inject({ method: "POST", url: `${root}/jobs`, payload: { ...input, bitrate: "192" } })).statusCode
    ).toBe(400);
    const created = await app.inject({ method: "POST", url: `${root}/jobs`, payload: input });
    expect(created.statusCode, created.body).toBe(200);
    const id = created.json().data.items[0].id;
    await vi.waitFor(
      async () => expect((await app.inject({ url: `${root}/jobs/${id}` })).json().data.status).toBe("completed"),
      { timeout: 20000 }
    );
    const range = await app.inject({ url: `${root}/jobs/${id}/audio`, headers: { range: "bytes=0-7" } });
    expect(range.statusCode).toBe(206);
    expect(range.rawPayload.length).toBe(8);
    expect(
      (await app.inject({ url: `${root}/jobs/${id}/audio`, headers: { range: "bytes=99999999-" } })).statusCode
    ).toBe(416);
    const ticket = await app.inject({ method: "POST", url: `${root}/downloads`, payload: { ids: [id] } });
    const zip = await app.inject({ url: ticket.json().data.url });
    expect(zip.statusCode).toBe(200);
    expect(zip.rawPayload.subarray(0, 2).toString()).toBe("PK");
    expect((await app.inject({ url: ticket.json().data.url })).statusCode).toBe(404);
    expect((await app.inject({ method: "DELETE", url: `${root}/jobs/${id}` })).statusCode).toBe(200);
    const silent = await video(f.root, "mp4", "aac", false, true);
    expect((await upload("silent.mp4", await fs.readFile(silent))).json().error.code).toBe("AUDIO_EXTRACT_NO_AUDIO");
  }, 30000);
});
