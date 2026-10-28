import { createServer } from "node:http";
import { once } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import {
  connectProfileProxy,
  resolveProfileBrowser
} from "../domains/content-archive/providers/tiktok/profile-browser";
import type { ComponentManager } from "../modules/components/component-manager";
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((close) => close()));
});
async function proxy(status: number) {
  const server = createServer(),
    connect = vi.fn();
  server.on("connect", (request, socket) => {
    connect(request.url, request.headers);
    socket.on("error", () => undefined);
    if (status === 0) return;
    socket.write(`HTTP/1.1 ${status} Result\r\n\r\n`);
    if (status === 200) socket.pipe(socket);
    else socket.end();
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture");
  cleanups.push(() => new Promise<void>((done) => server.close(() => done())));
  return { url: `http://127.0.0.1:${address.port}`, connect };
}
it("CONNECTs the validated public IP through the configured proxy and never forwards browser proxy credentials", async () => {
  const gateway = await proxy(200),
    socket = await connectProfileProxy(
      gateway.url,
      { address: "93.184.216.34", family: 4 },
      new AbortController().signal
    );
  expect(gateway.connect).toHaveBeenCalledWith(
    "93.184.216.34:443",
    expect.not.objectContaining({ "proxy-authorization": expect.anything() })
  );
  const data = once(socket, "data");
  socket.write("tunnel");
  expect((await data)[0].toString()).toBe("tunnel");
  socket.destroy();
});
it("rejects proxy errors and aborts pending CONNECT requests", async () => {
  const rejected = await proxy(407);
  await expect(
    connectProfileProxy(rejected.url, { address: "93.184.216.34", family: 4 }, new AbortController().signal)
  ).rejects.toThrow("TUNNEL_FAILED");
  const pending = await proxy(0),
    controller = new AbortController();
  const promise = connectProfileProxy(pending.url, { address: "93.184.216.34", family: 4 }, controller.signal);
  const failure = expect(promise).rejects.toMatchObject({ name: "AbortError" });
  controller.abort();
  await failure;
});
it("resolves only the installed signed browser and refuses mutations, incompatible versions and unsupported platforms", async () => {
  const components = {
    list: vi.fn(async () => []),
    resolveInstalledAsset: vi.fn(async () => ({
      path: "signed/chrome.exe",
      manifest: { version: "1.63.0-chromium-1243" }
    }))
  };
  const source = components as unknown as Pick<ComponentManager, "list" | "resolveInstalledAsset">;
  expect(await resolveProfileBrowser(source, "win32")).toBe("signed/chrome.exe");
  expect(components.resolveInstalledAsset).toHaveBeenCalledWith("xhs-browser", "browser/chrome.exe");
  components.resolveInstalledAsset.mockResolvedValueOnce({ path: "signed/chrome.exe", manifest: { version: "old" } });
  await expect(resolveProfileBrowser(source, "win32")).rejects.toMatchObject({
    code: "TIKTOK_PROFILE_BROWSER_UNAVAILABLE"
  });
  await expect(resolveProfileBrowser(source, "linux")).rejects.toMatchObject({
    code: "TIKTOK_PROFILE_BROWSER_UNAVAILABLE"
  });
  await expect(
    resolveProfileBrowser(
      { ...source, list: async () => [{ id: "xhs-browser", activeJobId: "installing" }] } as unknown as typeof source,
      "win32"
    )
  ).rejects.toMatchObject({ code: "TIKTOK_PROFILE_BROWSER_BUSY" });
});
it("uses the signed macOS launcher descriptor and refuses escaping or malformed asset paths", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-profile-browser-")),
    descriptor = path.join(directory, "browser-launcher.json");
  cleanups.push(() => fs.rm(directory, { recursive: true, force: true }));
  const executableAssetPath = "browser/Chromium.app/Contents/MacOS/Chromium";
  const resolveInstalledAsset = vi.fn(async (_id: string, asset: string) => ({
    path: asset.endsWith(".json") ? descriptor : path.join(directory, "Chromium"),
    manifest: { version: "1.63.0-chromium-1243" }
  }));
  const source = { list: async () => [], resolveInstalledAsset } as unknown as Pick<
    ComponentManager,
    "list" | "resolveInstalledAsset"
  >;
  await fs.writeFile(descriptor, JSON.stringify({ executableAssetPath }));
  expect(await resolveProfileBrowser(source, "darwin")).toBe(path.join(directory, "Chromium"));
  expect(resolveInstalledAsset).toHaveBeenLastCalledWith("xhs-browser", executableAssetPath);
  for (const value of [
    { executableAssetPath: "browser/../escape" },
    { executableAssetPath: "browser/C:\\escape" },
    { executableAssetPath, extra: "untrusted" },
    { executableAssetPath: `browser/${"a".repeat(4096)}` }
  ]) {
    await fs.writeFile(descriptor, JSON.stringify(value));
    resolveInstalledAsset.mockClear();
    await expect(resolveProfileBrowser(source, "darwin")).rejects.toMatchObject({
      code: "TIKTOK_PROFILE_BROWSER_UNAVAILABLE"
    });
    expect(resolveInstalledAsset).toHaveBeenCalledOnce();
  }
});
