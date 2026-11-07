import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { saveCapabilityExport } from "./capability-export";

let root: string;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-export-test-"));
});
afterEach(async () => {
  vi.restoreAllMocks();
  if (path.dirname(root) !== os.tmpdir() || !path.basename(root).startsWith("toolbox-export-test-"))
    throw new Error("测试清理越界");
  await fs.rm(root, { recursive: true, force: true });
});
const headers = { "content-type": "application/zip", "x-toolbox-export-max-bytes": "1024" };
const origin = "http://127.0.0.1:43210";
it("preserves the API failure reason before creating any output", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ success: false, message: "Python 缓存恢复失败，请检查网络" }, { status: 422 }));
  await expect(
    saveCapabilityExport(origin, "edge-tts", path.join(root, "failed"), new AbortController().signal, fetcher)
  ).rejects.toThrow("Python 缓存恢复失败");
  expect(await fs.readdir(root)).toEqual([]);
});
it("streams to a native destination, passes the local Origin, and commits only after the full response", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("verified-zip", { headers }));
  const controller = new AbortController();
  const file = path.join(root, "test.toolbox-capabilities.zip");
  await fs.writeFile(file, "previous");
  await expect(saveCapabilityExport(origin, "edge-tts", file, controller.signal, fetcher)).resolves.toEqual({
    fileName: path.basename(file),
    bytes: 12
  });
  expect(await fs.readFile(file, "utf8")).toBe("verified-zip");
  expect(await fs.readdir(root)).toEqual([path.basename(file)]);
  expect(fetcher).toHaveBeenCalledWith(
    new URL(origin + "/api/v1/components/edge-tts/offline-export"),
    expect.objectContaining({ method: "POST", redirect: "error", headers: { origin }, signal: controller.signal })
  );
});
it.each(["oversize", "broken", "empty", "space", "cancelled", "http", "metadata"])(
  "%s preserves an existing destination and removes partial output",
  async (mode) => {
    const file = path.join(root, "test.toolbox-capabilities.zip");
    await fs.writeFile(file, "previous");
    const controller = new AbortController();
    let response = new Response(mode === "empty" ? "" : "zip", { headers });
    if (mode === "oversize")
      response = new Response("zip", { headers: { ...headers, "x-toolbox-export-max-bytes": "1" } });
    if (mode === "http") response = new Response("error", { status: 422 });
    if (mode === "metadata") response = new Response("zip", { headers: { "content-type": "application/zip" } });
    if (mode === "broken" || mode === "cancelled")
      response = new Response(
        new ReadableStream({
          pull(c) {
            c.enqueue(new Uint8Array([1]));
            if (mode === "cancelled") controller.abort();
            else c.error(new Error("stream failed"));
          }
        }),
        { headers }
      );
    if (mode === "space")
      vi.spyOn(fs, "statfs").mockResolvedValue({ bavail: 0, bsize: 4096 } as Awaited<ReturnType<typeof fs.statfs>>);
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response);
    await expect(saveCapabilityExport(origin, "edge-tts", file, controller.signal, fetcher)).rejects.toBeDefined();
    expect(await fs.readFile(file, "utf8")).toBe("previous");
    expect(await fs.readdir(root)).toEqual([path.basename(file)]);
  }
);
it.each(["https://evil.test", "http://localhost:1234", "http://127.0.0.1:1234/path", "http://user@127.0.0.1:1234"])(
  "rejects %s before any network or file operation",
  async (url) => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      saveCapabilityExport(url, "edge-tts", path.join(root, "unused"), new AbortController().signal, fetcher)
    ).rejects.toThrow("地址无效");
    expect(fetcher).not.toHaveBeenCalled();
  }
);
