import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { createIsolatedAppFixture } from "./helpers/isolated-app";
let fixture: Awaited<ReturnType<typeof createIsolatedAppFixture>> | undefined;
afterEach(async () => {
  await fixture?.dispose();
  fixture = undefined;
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
