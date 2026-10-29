import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { getConfig } from "../config";
import { createDevelopmentRuntimeLayout } from "../runtime/runtime-layout";
import { TikTokRuntime } from "../domains/content-archive/providers/tiktok/runtime";
import { ArchiveTaskError } from "../domains/content-archive/core/provider";
import { TikTokProfileReader, type ProfileDiscovery } from "../domains/content-archive/providers/tiktok/profile-reader";
const base = "/api/v1/tools/media-archive/tiktok-profiles";
let app: Awaited<ReturnType<typeof createApp>> | undefined, root: string;
const discovery: ProfileDiscovery = {
  complete: true,
  waitingUser: false,
  message: "已确认分页结束",
  declaredCount: 1,
  works: [{ id: "12345", url: "https://www.tiktok.com/@shop/video/12345", title: "商品" }]
};
async function setup(lan = false) {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-tiktok-profile-api-"));
  const config = getConfig({
    layout: createDevelopmentRuntimeLayout({ storageRoot: root, runtimeRoot: path.join(root, "runtime") }),
    dotenvPath: false,
    environment: {
      NODE_ENV: "test",
      STORAGE_ROOT: root,
      DATABASE_PATH: path.join(root, "toolbox.db"),
      TIKTOK_HTTPS_PROXY: "direct"
    }
  });
  config.desktopManagedCapabilities = true;
  if (lan) {
    config.deploymentMode = "lan";
    config.adminPin = "2468";
    config.corsOrigins = ["http://localhost:5173"];
  }
  vi.spyOn(TikTokProfileReader.prototype, "read").mockResolvedValue(discovery);
  vi.spyOn(TikTokRuntime.prototype, "extract").mockResolvedValue({
    platform: "tiktok",
    contentId: "12345",
    canonicalUrl: discovery.works[0]!.url,
    type: "image",
    title: "商品",
    topics: [],
    media: [{ kind: "image", index: 0, urls: ["https://p16.tiktokcdn-us.com/image.png"] }]
  });
  const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: "red" } })
    .png()
    .toBuffer();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(new Uint8Array(png), { headers: { "content-type": "image/png" } }))
  );
  app = await createApp({ config, remoteAddressResolver: async () => [{ address: "93.184.216.34", family: 4 }] });
  return app;
}
afterEach(async () => {
  await app?.close();
  app = undefined;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (root) {
    if (path.dirname(root) !== os.tmpdir() || !path.basename(root).startsWith("toolbox-tiktok-profile-api-"))
      throw new Error("Unsafe fixture path");
    await fs.rm(root, { recursive: true, force: true });
  }
});
async function create(server: NonNullable<typeof app>) {
  const response = await server.inject({
    method: "POST",
    url: base,
    payload: { url: "https://www.tiktok.com/@shop?_t=share" }
  });
  expect(response.statusCode).toBe(200);
  const id = response.json().data.id as string;
  await vi.waitFor(async () => expect((await server.inject(`${base}/${id}`)).json().data.phase).toBe("ready"));
  return id;
}
it("discovers, archives and cleans profile/batch metadata while preserving stored media and groups", async () => {
  const server = await setup(),
    id = await create(server);
  expect((await server.inject("/api/v1/tools/media-archive/items")).json().data.total).toBe(0);
  expect((await server.inject(`${base}/${id}/works`)).json().data.items[0].id).toBe("12345");
  expect((await server.inject(base)).json().data).toHaveLength(1);
  const group = (
    await server.inject({ method: "POST", url: "/api/v1/tools/media-archive/groups", payload: { name: "主页素材" } })
  ).json().data;
  const started = await server.inject({
    method: "POST",
    url: `${base}/${id}/archive`,
    payload: { selection: "all", existing: "skip", groupId: group.id, allowPartial: false }
  });
  expect(started.statusCode).toBe(200);
  await vi.waitFor(async () => expect((await server.inject(`${base}/${id}`)).json().data.phase).toBe("completed"), {
    timeout: 8000,
    interval: 100
  });
  const snapshot = (await server.inject(`${base}/${id}`)).json().data;
  expect(snapshot).toMatchObject({ archivedCount: 1, batchCount: 1 });
  const archives = (await server.inject(`/api/v1/tools/media-archive/items?groupId=${group.id}`)).json().data;
  expect(archives.total).toBe(1);
  const csv = await server.inject(`${base}/${id}/results.csv`);
  expect(csv.body).toContain("12345");
  expect(csv.body).toContain("成功");
  expect(csv.headers["content-disposition"]).toContain("attachment");
  const itemBefore = (await server.inject(`/api/v1/tools/media-archive/items/${archives.items[0].id}`)).json().data;
  const mediaBefore = await server.inject(itemBefore.media[0].downloadUrl);
  expect(mediaBefore.statusCode).toBe(200);
  const batches = (await server.inject("/api/v1/tools/media-archive/import/batches")).json().data;
  expect(batches).toHaveLength(1);
  expect((await server.inject({ method: "DELETE", url: `${base}/${id}` })).json().data.releasedBytes).toBe(0);
  expect((await server.inject(`${base}/${id}`)).statusCode).toBe(404);
  expect((await server.inject(`/api/v1/tools/media-archive/items/${archives.items[0].id}`)).json().data).toEqual(
    itemBefore
  );
  const mediaAfter = await server.inject(itemBefore.media[0].downloadUrl);
  expect(mediaAfter.statusCode).toBe(200);
  expect(mediaAfter.rawPayload).toEqual(mediaBefore.rawPayload);
  expect((await server.inject("/api/v1/tools/media-archive/import/batches")).json().data).toHaveLength(0);
  expect((await server.inject(`/api/v1/tools/media-archive/import/batches/${batches[0].id}`)).statusCode).toBe(404);
  expect(
    (await server.inject("/api/v1/tools/media-archive/groups"))
      .json()
      .data.some((value: { id: string }) => value.id === group.id)
  ).toBe(true);
  expect((await server.inject(`/api/v1/tools/media-archive/items?groupId=${group.id}`)).json().data.total).toBe(1);
}, 15000);
it("rejects credentials and invalid selections before AJV stripping, and requires partial confirmation", async () => {
  const server = await setup();
  for (const payload of [
    { url: "https://www.tiktok.com/@shop", cookie: "forbidden" },
    { url: "https://www.tiktok.com.evil.test/@shop" },
    { url: "http://127.0.0.1/@shop" }
  ])
    expect((await server.inject({ method: "POST", url: base, payload })).statusCode).toBe(400);
  vi.mocked(TikTokProfileReader.prototype.read).mockResolvedValueOnce({ ...discovery, complete: false });
  const id = await create(server);
  expect(
    (
      await server.inject({
        method: "POST",
        url: `${base}/${id}/archive`,
        payload: { selection: "all", existing: "skip", allowPartial: false }
      })
    ).json().error.code
  ).toBe("TIKTOK_PROFILE_LIST_PARTIAL");
  for (const payload of [
    { selection: "all", existing: "skip", allowPartial: true, cookie: "forbidden" },
    { selection: "selected", itemIds: ["12345", "12345"], existing: "skip", allowPartial: true },
    { selection: "selected", itemIds: ["99999"], existing: "skip", allowPartial: true }
  ])
    expect((await server.inject({ method: "POST", url: `${base}/${id}/archive`, payload })).statusCode).toBe(400);
  expect((await server.inject(`${base}/${id}/works?page=201`)).statusCode).toBe(400);
  for (const payload of [
    { itemId: "bad" },
    { itemId: "12345", cookie: "forbidden" },
    { url: discovery.works[0]!.url },
    { itemId: ["12345"] }
  ])
    expect((await server.inject({ method: "POST", url: `${base}/${id}/retry`, payload })).statusCode).toBe(400);
  expect(
    (await server.inject({ method: "POST", url: `${base}/${id}/retry`, payload: { itemId: "99999" } })).json().error
      .code
  ).toBe("TIKTOK_PROFILE_NO_RETRY");
  expect((await server.inject({ method: "POST", url: `${base}/missing_id/retry` })).statusCode).toBe(404);
});
it("holds maintenance protection during discovery, preserves stopped progress and rejects LAN guest writes", async () => {
  const server = await setup();
  vi.mocked(TikTokProfileReader.prototype.read).mockImplementationOnce(async (_url, signal, update) => {
    update({ ...discovery, complete: false, waitingUser: true });
    return new Promise<ProfileDiscovery>((_done, reject) =>
      signal.addEventListener("abort", () => reject(signal.reason), { once: true })
    );
  });
  const response = await server.inject({ method: "POST", url: base, payload: { url: "https://www.tiktok.com/@shop" } }),
    id = response.json().data.id;
  await vi.waitFor(async () => expect((await server.inject(`${base}/${id}`)).json().data.phase).toBe("waiting-user"));
  expect(
    (
      await server.inject({
        method: "POST",
        url: "/api/v1/diagnostics/runs",
        payload: { depth: "deep", targets: ["image-ai"], confirmed: true }
      })
    ).json().error.code
  ).toBe("DIAGNOSTICS_BUSY");
  await server.inject({ method: "POST", url: `${base}/${id}/cancel` });
  await vi.waitFor(async () => expect((await server.inject(`${base}/${id}`)).json().data.phase).toBe("ready"));
  expect((await server.inject(`${base}/${id}/works`)).json().data.total).toBe(1);
});
it("keeps every new write behind existing LAN administrator authentication", async () => {
  const server = await setup(true);
  for (const [method, url, payload] of [
    ["POST", base, { url: "https://www.tiktok.com/@shop" }],
    ["POST", `${base}/profile_123/cancel`, undefined],
    ["POST", `${base}/profile_123/retry`, { itemId: "12345" }],
    ["POST", `${base}/profile_123/archive`, { selection: "all", existing: "skip", allowPartial: true }],
    ["DELETE", `${base}/profile_123`, undefined]
  ] as const)
    expect([401, 403]).toContain(
      (await server.inject({ method, url, ...(payload ? { payload } : {}), remoteAddress: "192.168.1.50" })).statusCode
    );
  expect(TikTokProfileReader.prototype.read).not.toHaveBeenCalled();
});
it("retries a failed row and matches an ordinary single-work success back into profile summary, page and CSV", async () => {
  const server = await setup(),
    id = await create(server);
  const extract = vi.mocked(TikTokRuntime.prototype.extract);
  extract.mockRejectedValueOnce(new ArchiveTaskError("TIKTOK_MEDIA_UNAVAILABLE", "模拟媒体不可用"));
  extract.mockRejectedValueOnce(new ArchiveTaskError("TIKTOK_MEDIA_UNAVAILABLE", "模拟再次失败"));
  await server.inject({
    method: "POST",
    url: `${base}/${id}/archive`,
    payload: { selection: "all", existing: "skip", allowPartial: false }
  });
  const finished = async () =>
    vi.waitFor(
      async () => {
        expect((await server.inject(`${base}/${id}`)).json().data).toMatchObject({
          phase: "completed",
          failedCount: 1
        });
      },
      { timeout: 9000, interval: 80 }
    );
  await finished();
  const retry = await server.inject({ method: "POST", url: `${base}/${id}/retry`, payload: { itemId: "12345" } });
  expect(retry.statusCode).toBe(200);
  expect(retry.json().data).toMatchObject({ phase: "archiving", pendingCount: 1 });
  await finished();
  const single = await server.inject({
    method: "POST",
    url: "/api/v1/tools/media-archive/items",
    payload: { platform: "tiktok", url: discovery.works[0]!.url }
  });
  expect(single.statusCode).toBe(202);
  const taskId = single.json().data.id;
  let archiveId = "";
  await vi.waitFor(
    async () => {
      const task = (await server.inject(`/api/v1/tools/media-archive/tasks/${taskId}`)).json().data;
      expect(task.status).toBe("completed");
      archiveId = task.archiveId;
    },
    { timeout: 5000, interval: 80 }
  );
  expect((await server.inject(`${base}/${id}`)).json().data).toMatchObject({ archivedCount: 1, failedCount: 0 });
  expect((await server.inject(`${base}/${id}/works`)).json().data.items[0].outcome).toEqual({
    status: "completed",
    progress: 100,
    message: "已匹配单条成功归档",
    archiveId
  });
  const csv = await server.inject(`${base}/${id}/results.csv`);
  expect(csv.body).toContain(archiveId);
  expect(csv.body).not.toContain("TIKTOK_MEDIA_UNAVAILABLE");
  expect(extract).toHaveBeenCalledTimes(3);
}, 25000);
