import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ZipArchive } from "archiver";
import type { FastifyInstance } from "fastify";
import sharp from "sharp";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { normalizeImageOptions } from "@toolbox/shared/image";
import { FileMetadataRepository } from "../database/file-metadata";
import { parseImageOptions } from "../domains/image-compress/input";
import { createIsolatedAppFixture } from "./helpers/isolated-app";
import { readArchiveZip } from "./helpers/archive-zip";

let fixture: Awaited<ReturnType<typeof createIsolatedAppFixture>>;
beforeEach(async () => {
  fixture = await createIsolatedAppFixture();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fixture.dispose();
});

function multipart(content?: Buffer, fields: Record<string, string> = {}, mimeType = "image/png") {
  const boundary = "----compression-compat";
  const chunks: Buffer[] = Object.entries(fields).map(([name, value]) =>
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`)
  );
  if (content) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="fixture.png"\r\nContent-Type: ${mimeType}\r\n\r\n`
      ),
      content,
      Buffer.from("\r\n")
    );
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { headers: { "content-type": `multipart/form-data; boundary=${boundary}` }, payload: Buffer.concat(chunks) };
}
function image() {
  return sharp({ create: { width: 64, height: 48, channels: 3, background: "#2563eb" } })
    .png()
    .toBuffer();
}
function upload(app: FastifyInstance, content: Buffer, fields: Record<string, string> = {}) {
  return app.inject({ method: "POST", url: "/api/v1/tools/image-compress", ...multipart(content, fields) });
}

it.each([
  [{}, { quality: 78, outputFormat: "png", width: undefined }],
  [
    { quality: "1", width: "0" },
    { quality: 30, outputFormat: "png", width: undefined }
  ],
  [
    { quality: "999", width: "31.6" },
    { quality: 95, outputFormat: "png", width: 32 }
  ],
  [
    { quality: "bad", width: "-1" },
    { quality: 78, outputFormat: "png", width: undefined }
  ],
  [
    { quality: "60.6", outputFormat: "webp", width: "128" },
    { quality: 61, outputFormat: "webp", width: 128 }
  ],
  [
    { quality: null, outputFormat: null, width: "Infinity" },
    { quality: 78, outputFormat: "png", width: undefined }
  ]
])("keeps multipart option parsing and normalization: %j", (fields, expected) => {
  expect(normalizeImageOptions(parseImageOptions(fields))).toEqual(expected);
});

it("does not silently normalize an explicit unsupported output format", () => {
  expect(() => normalizeImageOptions(parseImageOptions({ outputFormat: "gif" }))).toThrow("Unsupported image format");
});

it("retains a larger PNG result and truthful negative savings rather than silently changing formats", async () => {
  const app = await fixture.start();
  const pixels = Buffer.alloc(128 * 96 * 3);
  let state = 123456789;
  for (let index = 0; index < pixels.length; index++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    pixels[index] = state >>> 24;
  }
  const input = await sharp(pixels, { raw: { width: 128, height: 96, channels: 3 } })
    .jpeg({ quality: 25 })
    .toBuffer();
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/tools/image-compress",
    ...multipart(input, {}, "image/jpeg")
  });
  expect(response.statusCode).toBe(200);
  const result = response.json().data;
  expect(result.outputFormat).toBe("png");
  expect(result.outputSize).toBeGreaterThan(input.length);
  expect(result.savedBytes).toBe(input.length - result.outputSize);
  expect(result.savedBytes).toBeLessThan(0);
  expect(result.compressionRatio).toBeGreaterThan(1);
  const downloaded = await app.inject({ method: "GET", url: result.downloadUrl });
  const expected = await sharp(input).rotate().png({ quality: 78 }).toBuffer();
  expect(downloaded.rawPayload).toEqual(expected);
});

it.each([
  ["800", 64, 48],
  ["32", 32, 24]
])(
  "reports the actual output dimensions for width=%s without enlargement",
  async (width, actualWidth, actualHeight) => {
    const app = await fixture.start();
    const response = await upload(app, await image(), { width });
    expect(response.statusCode).toBe(200);
    const result = response.json().data;
    // B10 explicitly corrects the old response bug; field names and no-enlargement policy stay unchanged.
    expect(result).toMatchObject({ width: actualWidth, height: actualHeight });
    const downloaded = await app.inject({ method: "GET", url: result.downloadUrl });
    expect(await sharp(downloaded.rawPayload).metadata()).toMatchObject({ width: actualWidth, height: actualHeight });
  }
);

it.each([
  ["missing", 400, "FILE_REQUIRED"],
  ["mime", 415, "UNSUPPORTED_IMAGE_TYPE"],
  ["content", 400, "IMAGE_PROCESSING_FAILED"],
  ["format", 400, "IMAGE_PROCESSING_FAILED"]
] as const)("keeps %s upload failures and terminal task state", async (kind, status, code) => {
  const app = await fixture.start();
  const content = kind === "missing" ? undefined : kind === "content" ? Buffer.from("invalid PNG") : await image();
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/tools/image-compress",
    ...multipart(content, kind === "format" ? { outputFormat: "gif" } : {}, kind === "mime" ? "image/gif" : "image/png")
  });
  expect(response.statusCode).toBe(status);
  expect(response.json()).toMatchObject({ success: false, error: { code } });
  const tasks = (await app.inject({ method: "GET", url: "/api/v1/tasks" })).json().data;
  expect(tasks).toHaveLength(1);
  expect(tasks[0]).toMatchObject({ toolId: "image-compress", status: "failed", progress: 100 });
  expect(tasks[0].outputPath).toBeUndefined();
});

it("retains the 20 MiB upload limit and does not commit an oversized result", async () => {
  const app = await fixture.start();
  const response = await upload(app, Buffer.alloc(20 * 1024 * 1024 + 1));
  expect(response.statusCode).toBe(413);
  expect(response.json()).toMatchObject({ error: { code: "IMAGE_TOO_LARGE" } });
  expect(await fs.readdir(path.join(fixture.layout.storageRoot, "outputs"))).toEqual([]);
});

it.each([false, true])(
  "keeps trimmed unique task selection and Unicode ZIP bytes (forced reverse %s)",
  async (reverse) => {
    const app = await fixture.start();
    const first = await upload(app, await image(), { outputFormat: "jpeg" });
    const distinct = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#16a34a" } })
      .png()
      .toBuffer();
    const second = await upload(app, distinct, { outputFormat: "jpeg" });
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    const results = [first.json().data, second.json().data];
    const queued: Array<{ file: string; name: string }> = [];
    const archiveFile = reverse
      ? vi.spyOn(ZipArchive.prototype, "file").mockImplementation(function (this: unknown, ...args: unknown[]) {
          if (
            !(this instanceof ZipArchive) ||
            args.length !== 2 ||
            typeof args[0] !== "string" ||
            !args[1] ||
            typeof args[1] !== "object" ||
            !("name" in args[1]) ||
            typeof args[1].name !== "string"
          )
            throw new Error("Expected an owned fixture file and an explicitly named ZIP entry");
          queued.push({ file: args[0], name: args[1].name });
          if (queued.length === 2) {
            for (const { file, name } of [...queued].reverse()) {
              this.append(readFileSync(file), { name });
            }
          }
          return this;
        })
      : undefined;
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/tools/image-compress/download.zip",
      payload: {
        files: [
          null,
          { taskId: " " },
          { taskId: ` ${results[0].task.id} `, fileName: " 商品图.jpg " },
          { taskId: results[0].task.id, fileName: "ignored.jpg" },
          { taskId: results[1].task.id, fileName: "商品图.jpg" }
        ]
      }
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("application/zip");
    expect(response.headers["content-disposition"]).toMatch(/^attachment; filename="image-compress-\d+\.zip"$/);
    if (reverse) expect(archiveFile).toHaveBeenCalledTimes(2);
    const entries = readArchiveZip(response.rawPayload);
    const names = ["商品图.jpeg", "商品图 (2).jpeg"];
    expect([...entries.keys()].sort()).toEqual([...names].sort());
    if (reverse) expect([...entries.keys()]).toEqual([...names].reverse());
    const originals = await Promise.all(
      results.map(async (result) => (await app.inject({ method: "GET", url: result.downloadUrl })).rawPayload)
    );
    expect(originals[0]).not.toEqual(originals[1]);
    for (const [index, name] of names.entries()) {
      expect(entries.get(name)).toEqual(originals[index]);
    }
  }
);

it.each([{}, { files: [] }, { files: "invalid" }, { files: [null, {}, { taskId: " " }] }])(
  "does not create a ZIP for an empty normalized selection: %j",
  async (payload) => {
    const app = await fixture.start();
    const response = await app.inject({ method: "POST", url: "/api/v1/tools/image-compress/download.zip", payload });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: "FILES_REQUIRED" } });
  }
);

it.each(["missing-task", "missing-file"] as const)("retains the distinct ZIP %s error", async (kind) => {
  const app = await fixture.start();
  let taskId = "missing-task";
  if (kind === "missing-file") {
    const processed = await upload(app, await image());
    expect(processed.statusCode).toBe(200);
    const result = processed.json().data;
    taskId = result.task.id;
    const file = path.join(fixture.layout.storageRoot, "outputs", result.outputName);
    await fs.rename(file, file + ".held-by-test");
  }
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/tools/image-compress/download.zip",
    payload: { files: [{ taskId, fileName: "fixture.png" }] }
  });
  expect(response.statusCode).toBe(404);
  expect(response.json()).toMatchObject({
    error: { code: kind === "missing-task" ? "RESULT_NOT_FOUND" : "RESULT_FILE_NOT_FOUND" }
  });
});

it("commits the result file and registers metadata before publishing completed task state", async () => {
  const app = await fixture.start();
  const register = FileMetadataRepository.prototype.registerIfExists;
  const observed: Array<{
    input: Parameters<FileMetadataRepository["registerIfExists"]>[0];
    fileExists: boolean;
    task: unknown;
  }> = [];
  const spy = vi.spyOn(FileMetadataRepository.prototype, "registerIfExists").mockImplementation(async function (
    this: FileMetadataRepository,
    input
  ) {
    const fileExists = (await fs.stat(input.filePath)).isFile();
    const task = (await app.inject({ method: "GET", url: `/api/v1/tasks/${input.entityId}` })).json().data;
    observed.push({ input, fileExists, task });
    return register.call(this, input);
  });
  const response = await upload(app, await image());
  expect(spy).toHaveBeenCalledOnce();
  // Assert outside the repository callback: the existing service deliberately catches registration failures.
  expect(observed).toMatchObject([
    {
      input: { entityKind: "image-compress", owner: "local" },
      fileExists: true,
      task: { status: "running", progress: 15 }
    }
  ]);
  expect(response.statusCode).toBe(200);
  expect(response.json().data.task).toMatchObject({ status: "completed", progress: 100 });
});

it("keeps the existing nonfatal metadata-registration failure policy", async () => {
  const app = await fixture.start();
  const register = vi
    .spyOn(FileMetadataRepository.prototype, "registerIfExists")
    .mockRejectedValue(new Error("synthetic metadata failure"));
  const response = await upload(app, await image());
  expect(register).toHaveBeenCalledOnce();
  expect(response.statusCode).toBe(200);
  const result = response.json().data;
  expect(result.task).toMatchObject({ status: "completed", progress: 100 });
  expect((await app.inject({ method: "GET", url: result.downloadUrl })).statusCode).toBe(200);
});
