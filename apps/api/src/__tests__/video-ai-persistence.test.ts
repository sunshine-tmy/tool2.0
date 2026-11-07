import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { createIsolatedAppFixture } from "./helpers/isolated-app";
import { VIDEO_AI_MAX_STORAGE_BYTES } from "@toolbox/shared";
let fixture: Awaited<ReturnType<typeof createIsolatedAppFixture>> | undefined;
afterEach(async () => {
  await fixture?.dispose();
  fixture = undefined;
});

it("counts retained originals towards the storage quota before accepting another video", async () => {
  fixture = await createIsolatedAppFixture();
  const root = path.join(fixture.layout.storageRoot, "video-ai");
  await fs.mkdir(path.join(root, "tasks"), { recursive: true });
  const id = "large_saved1";
  // Synthetic metadata exercises quota arithmetic without allocating a 20 GiB file.
  await fs.writeFile(
    path.join(root, "tasks", `${id}.json`),
    JSON.stringify({
      id,
      mode: "delogo",
      status: "completed",
      progress: 100,
      queuePosition: null,
      inputName: "large.mp4",
      inputBytes: VIDEO_AI_MAX_STORAGE_BYTES - 10,
      inputRetained: true,
      inputPath: path.join(root, "inputs", id, "input.bin"),
      outputPath: path.join(root, "outputs", `${id}.mp4`),
      outputBytes: 10,
      outputWidth: 64,
      outputHeight: 48,
      segments: [],
      warnings: [],
      createdAt: "2026-11-07T00:00:00Z",
      updatedAt: "2026-11-07T00:00:00Z",
      expiresAt: null
    })
  );
  const app = await fixture.start();
  const response = await app.inject({ method: "POST", url: "/api/v1/tools/video-ai/tasks", payload: {} });
  expect(response.statusCode).toBe(409);
  expect(response.json().error.code).toBe("VIDEO_AI_STORAGE_FULL");
});
it("keeps completed legacy results permanently and ignores unowned persisted paths without deleting them", async () => {
  fixture = await createIsolatedAppFixture();
  const root = path.join(fixture.layout.storageRoot, "video-ai"),
    tasks = path.join(root, "tasks"),
    outputs = path.join(root, "outputs");
  await fs.mkdir(tasks, { recursive: true });
  await fs.mkdir(outputs, { recursive: true });
  const outside = path.join(fixture.root, "preserve.mp4");
  await fs.writeFile(outside, "user-owned");
  for (const id of ["valid_task1", "unsafe_task1"]) {
    const payload = {
      id,
      mode: "delogo",
      status: "completed",
      progress: 100,
      queuePosition: null,
      inputName: "original.mp4",
      inputBytes: 10,
      inputPath: path.join(root, "inputs", id, "input.bin"),
      segments: [],
      warnings: [],
      createdAt: "2020-01-01T00:00:00Z",
      updatedAt: "2020-01-01T00:00:00Z",
      expiresAt: "2020-01-02T00:00:00Z",
      outputPath: id.startsWith("unsafe") ? outside : path.join(outputs, `${id}.mp4`),
      outputBytes: 10,
      outputWidth: 64,
      outputHeight: 48
    };
    await fs.writeFile(path.join(tasks, `${id}.json`), JSON.stringify(payload));
  }
  await fs.writeFile(path.join(outputs, "valid_task1.mp4"), "saved output");
  const app = await fixture.start();
  const good = await app.inject({ method: "GET", url: "/api/v1/tools/video-ai/tasks/valid_task1" });
  expect(good.json().data).toMatchObject({ status: "completed", expiresAt: null, output: { width: 64, height: 48 } });
  expect(good.json().data.inputRetained).toBe(false);
  expect((await app.inject({ method: "GET", url: "/api/v1/tools/video-ai/tasks/valid_task1/input" })).statusCode).toBe(
    404
  );
  const boundary = "----legacy-source";
  const missingOriginal = await app.inject({
    method: "POST",
    url: "/api/v1/tools/video-ai/tasks",
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload: `--${boundary}\r\nContent-Disposition: form-data; name="sourceTaskId"\r\n\r\nvalid_task1\r\n--${boundary}\r\nContent-Disposition: form-data; name="sourceVersion"\r\n\r\noriginal\r\n--${boundary}--\r\n`
  });
  expect(missingOriginal.statusCode).toBe(422);
  expect(missingOriginal.json().error.code).toBe("INPUT_NOT_FOUND");
  const history = await app.inject({ method: "GET", url: "/api/v1/tools/video-ai/history" });
  expect(history.json().data.total).toBe(1);
  expect((await app.inject({ method: "DELETE", url: "/api/v1/tools/video-ai/tasks/unsafe_task1" })).statusCode).toBe(
    404
  );
  expect(await fs.readFile(outside, "utf8")).toBe("user-owned");
  expect(await fs.readFile(path.join(tasks, "unsafe_task1.json"), "utf8")).toContain("unsafe_task1");
  expect((await app.inject({ method: "DELETE", url: "/api/v1/tools/video-ai/tasks/valid_task1" })).statusCode).toBe(
    200
  );
  await expect(fs.access(path.join(tasks, "valid_task1.json"))).rejects.toThrow();
  await expect(fs.access(path.join(outputs, "valid_task1.mp4"))).rejects.toThrow();
});
