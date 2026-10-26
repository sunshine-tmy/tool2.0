import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { getConfig } from "../config";
import { createDevelopmentRuntimeLayout } from "../runtime/runtime-layout";
import { TikTokRuntime } from "../domains/content-archive/providers/tiktok/runtime";
import { ArchiveDownloadGateway } from "../domains/content-archive/core/download-gateway";
import { ArchiveImportService } from "../domains/content-archive/batch/service";
import type { ArchiveImportBatch, ArchiveImportPreview } from "@toolbox/shared";
const base = "/api/v1/tools/media-archive/import";
const url = "https://www.tiktok.com/@shop/video/12345";
const groupBase = "/api/v1/tools/media-archive/groups";
let app: Awaited<ReturnType<typeof createApp>> | undefined, root: string;
async function setup(lan = false) {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-archive-import-api-"));
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
  const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: "red" } })
    .png()
    .toBuffer();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(new Uint8Array(png), { headers: { "content-type": "image/png" } }))
  );
  vi.spyOn(TikTokRuntime.prototype, "extract").mockResolvedValue({
    platform: "tiktok",
    contentId: "12345",
    canonicalUrl: url,
    type: "image",
    title: "作品",
    topics: [],
    media: [{ kind: "image", index: 0, urls: ["https://p16.tiktokcdn-us.com/image.png"] }]
  });
  app = await createApp({ config, remoteAddressResolver: async () => [{ address: "93.184.216.34", family: 4 }] });
  return app;
}
afterEach(async () => {
  await app?.close();
  app = undefined;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (root) {
    if (path.dirname(root) !== os.tmpdir() || !path.basename(root).startsWith("toolbox-archive-import-api-"))
      throw new Error("Unsafe fixture path");
    await fs.rm(root, { recursive: true, force: true });
  }
});
function upload(csv: string, name = "batch.csv") {
  const boundary = "ArchiveImportBoundary";
  return {
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload: Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: text/csv\r\n\r\n${csv}\r\n--${boundary}--\r\n`
    )
  };
}
async function terminal(id: string) {
  let batch!: ArchiveImportBatch;
  await vi.waitFor(
    async () => {
      batch = (await app!.inject(`${base}/batches/${id}`)).json().data;
      expect(["running", "stopping"]).not.toContain(batch.status);
    },
    { timeout: 7000, interval: 100 }
  );
  return batch;
}
it("uploads, previews, confirms and exports per-row results; deleting history leaves archived media intact", async () => {
  const server = await setup();
  const template = await server.inject(`${base}/template.csv`);
  expect(template.headers["content-disposition"]).toContain("attachment");
  expect(template.body.replace(/^\uFEFF/, "").trim()).toBe('"作品链接","平台"');
  const preview = await server.inject({
    method: "POST",
    url: `${base}/preview`,
    ...upload(`作品链接,平台\n${url},TikTok\n${url}?tracking=1,\n=malicious,Other`)
  });
  expect(preview.statusCode).toBe(200);
  const parsed = preview.json().data as ArchiveImportPreview;
  expect(parsed.rows.map((row) => row.status)).toEqual(["ready", "duplicate", "invalid"]);
  const created = await server.inject({
    method: "POST",
    url: `${base}/batches`,
    payload: {
      sourceName: parsed.sourceName,
      rows: parsed.rows.map(({ rowNumber, inputUrl, inputPlatform }) => ({ rowNumber, inputUrl, inputPlatform })),
      existing: "skip"
    }
  });
  expect(created.statusCode).toBe(202);
  const batch = await terminal(created.json().data.id);
  expect(batch.rows.map((row) => row.status)).toEqual(["completed", "duplicate", "invalid"]);
  const archive = batch.rows[0]!.archiveId!;
  expect((await server.inject(`/api/v1/tools/media-archive/items/${archive}`)).statusCode).toBe(200);
  const csv = await server.inject(`${base}/batches/${batch.id}/results.csv`);
  expect(csv.headers["content-type"]).toContain("text/csv");
  expect(csv.body).toContain("'=malicious");
  expect(csv.body).toContain(archive);
  expect((await server.inject(`${base}/batches`)).json().data).toHaveLength(1);
  expect((await server.inject({ method: "DELETE", url: `${base}/batches/${batch.id}` })).json().data).toMatchObject({
    removed: true,
    mediaCount: 0
  });
  expect((await server.inject(`${base}/batches/${batch.id}`)).statusCode).toBe(404);
  expect((await server.inject(`/api/v1/tools/media-archive/items/${archive}`)).statusCode).toBe(200);
});
it("organizes successful imports, filters groups, and deleting a group preserves archives and downloads", async () => {
  const server = await setup();
  const group = (await server.inject({ method: "POST", url: groupBase, payload: { name: " 视频素材 " } })).json().data;
  expect(group.name).toBe("视频素材");
  const created = await server.inject({
    method: "POST",
    url: `${base}/batches`,
    payload: {
      sourceName: "batch.csv",
      existing: "skip",
      groupId: group.id,
      rows: [{ rowNumber: 2, inputUrl: url, inputPlatform: "" }]
    }
  });
  expect(created.statusCode).toBe(202);
  const batch = await terminal(created.json().data.id),
    archiveId = batch.rows[0]!.archiveId!;
  expect(batch.groupId).toBe(group.id);
  expect((await server.inject(`/api/v1/tools/media-archive/items?groupId=${group.id}`)).json().data.items[0].id).toBe(
    archiveId
  );
  expect((await server.inject("/api/v1/tools/media-archive/items?groupId=ungrouped")).json().data.total).toBe(0);
  expect(
    (await server.inject({ method: "PATCH", url: `${groupBase}/${group.id}`, payload: { name: "已整理" } })).json().data
      .name
  ).toBe("已整理");
  expect((await server.inject(groupBase)).json().data).toHaveLength(1);
  expect((await server.inject({ method: "DELETE", url: `${groupBase}/${group.id}` })).json().data).toMatchObject({
    removed: true,
    releasedBytes: 0
  });
  expect((await server.inject("/api/v1/tools/media-archive/items?groupId=ungrouped")).json().data.total).toBe(1);
  const saved = (await server.inject(`/api/v1/tools/media-archive/items/${archiveId}`)).json().data;
  expect((await server.inject(saved.media[0].downloadUrl)).statusCode).toBe(200);
  expect(
    (
      await server.inject({
        method: "POST",
        url: `${groupBase}/assign`,
        payload: { groupId: null, itemIds: [archiveId] }
      })
    ).json().data.updated
  ).toBe(1);
});
it("rejects invalid group operations before stripping undeclared fields, and never starts imports with a missing group", async () => {
  const server = await setup();
  for (const payload of [{ name: " " }, { name: "x", cookie: "forbidden" }, { name: "x\ny" }])
    expect((await server.inject({ method: "POST", url: groupBase, payload })).statusCode).toBe(400);
  const created = (await server.inject({ method: "POST", url: groupBase, payload: { name: "素材" } })).json().data;
  expect((await server.inject({ method: "POST", url: groupBase, payload: { name: "素材" } })).statusCode).toBe(409);
  expect(
    (await server.inject({ method: "PATCH", url: `${groupBase}/missing_id`, payload: { name: "素材2" } })).statusCode
  ).toBe(404);
  expect((await server.inject({ method: "DELETE", url: `${groupBase}/missing_id` })).statusCode).toBe(404);
  for (const payload of [
    { groupId: created.id, itemIds: [] },
    { groupId: created.id, itemIds: ["archive_1"], cookie: "forbidden" },
    { groupId: null, itemIds: ["archive_1", "archive_1"] }
  ])
    expect((await server.inject({ method: "POST", url: `${groupBase}/assign`, payload })).statusCode).toBe(400);
  expect(
    (
      await server.inject({
        method: "POST",
        url: `${groupBase}/assign`,
        payload: { groupId: created.id, itemIds: ["missing_id"] }
      })
    ).statusCode
  ).toBe(404);
  expect(
    (
      await server.inject({
        method: "POST",
        url: `${base}/batches`,
        payload: {
          sourceName: "batch.csv",
          existing: "skip",
          groupId: "missing_group",
          rows: [{ rowNumber: 2, inputUrl: url, inputPlatform: "" }]
        }
      })
    ).statusCode
  ).toBe(404);
  expect((await server.inject(`${base}/batches`)).json().data).toHaveLength(0);
});
it("short-link aliases skip existing works before downloading media and expose the saved outcome", async () => {
  const server = await setup();
  const download = vi.spyOn(ArchiveDownloadGateway.prototype, "download");
  const manual = await server.inject({ method: "POST", url: "/api/v1/tools/media-archive/items", payload: { url } });
  await vi.waitFor(async () =>
    expect((await server.inject(`/api/v1/tools/media-archive/tasks/${manual.json().data.id}`)).json().data.status).toBe(
      "completed"
    )
  );
  expect(download).toHaveBeenCalledTimes(1);
  const created = await server.inject({
    method: "POST",
    url: `${base}/batches`,
    payload: {
      sourceName: "alias.csv",
      existing: "skip",
      rows: [{ rowNumber: 2, inputUrl: "https://vt.tiktok.com/alias123/", inputPlatform: "" }]
    }
  });
  const batch = await terminal(created.json().data.id);
  expect(batch.rows[0]!.status).toBe("skipped");
  expect(download).toHaveBeenCalledTimes(1);
  expect((await server.inject(`/api/v1/tools/media-archive/tasks/${batch.rows[0]!.taskId}`)).json().data.skipped).toBe(
    true
  );
});
it("binds batch refresh to the original archive so deletion cancels it and late results cannot resurrect data", async () => {
  const server = await setup();
  const manual = await server.inject({ method: "POST", url: "/api/v1/tools/media-archive/items", payload: { url } });
  let archiveId!: string;
  await vi.waitFor(async () => {
    const task = (await server.inject(`/api/v1/tools/media-archive/tasks/${manual.json().data.id}`)).json().data;
    expect(task.status).toBe("completed");
    archiveId = task.archiveId;
  });
  const extract = vi.mocked(TikTokRuntime.prototype.extract);
  const savedSource = await extract.mock.results[0]!.value;
  let release!: (value: typeof savedSource) => void;
  extract.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      })
  );
  const created = await server.inject({
    method: "POST",
    url: `${base}/batches`,
    payload: {
      sourceName: "refresh.csv",
      existing: "refresh",
      rows: [{ rowNumber: 2, inputUrl: url, inputPlatform: "tiktok" }]
    }
  });
  await vi.waitFor(() => expect(extract).toHaveBeenCalledTimes(2), { timeout: 4000 });
  expect(
    (await server.inject({ method: "DELETE", url: `/api/v1/tools/media-archive/items/${archiveId}` })).statusCode
  ).toBe(200);
  release(savedSource);
  const batch = await terminal(created.json().data.id);
  expect(batch.rows[0]!.status).toBe("cancelled");
  expect((await server.inject(`/api/v1/tools/media-archive/items/${archiveId}`)).statusCode).toBe(404);
  expect((await server.inject("/api/v1/tools/media-archive/items")).json().data.total).toBe(0);
});
it("rejects malformed bodies, unsupported files and unknown IDs; template is available", async () => {
  const server = await setup();
  expect((await server.inject(`${base}/template.csv`)).body).toContain("作品链接");
  const longName = await server.inject({
    method: "POST",
    url: `${base}/preview`,
    ...upload(`作品链接\n${url}`, "a".repeat(200) + ".csv")
  });
  expect(longName.statusCode).toBe(200);
  expect(longName.json().data.sourceName.length).toBeLessThanOrEqual(180);
  expect(
    (await server.inject({ method: "POST", url: `${base}/preview`, ...upload("invalid", "old.xls") })).statusCode
  ).toBe(400);
  for (const extra of [{ cookie: "secret" }, { rows: [] }, { existing: "overwrite" }]) {
    const response = await server.inject({
      method: "POST",
      url: `${base}/batches`,
      payload: {
        sourceName: "t.csv",
        existing: "skip",
        rows: [{ rowNumber: 2, inputUrl: url, inputPlatform: "" }],
        ...extra
      }
    });
    expect(response.statusCode).toBe(400);
  }
  expect((await server.inject(`${base}/batches/missing_123`)).statusCode).toBe(404);
});
it("blocks environment maintenance in the gap before any child task has been admitted", async () => {
  vi.spyOn(ArchiveImportService.prototype, "tick").mockResolvedValue(undefined);
  const server = await setup();
  const created = await server.inject({
    method: "POST",
    url: `${base}/batches`,
    payload: { sourceName: "pending.csv", existing: "skip", rows: [{ rowNumber: 2, inputUrl: url, inputPlatform: "" }] }
  });
  expect(created.statusCode).toBe(202);
  expect((await server.inject("/api/v1/tasks")).json().data).toEqual([]);
  const blocked = await server.inject({
    method: "POST",
    url: "/api/v1/diagnostics/runs",
    payload: { depth: "deep", targets: ["image-ai"], confirmed: true }
  });
  expect(blocked.statusCode).toBe(409);
  expect(blocked.json().error.code).toBe("DIAGNOSTICS_BUSY");
  expect(TikTokRuntime.prototype.extract).not.toHaveBeenCalled();
  expect(
    (await server.inject({ method: "POST", url: `${base}/batches/${created.json().data.id}/cancel` })).statusCode
  ).toBe(200);
});
it("keeps LAN guest writes behind administrator authentication", async () => {
  const server = await setup(true);
  const response = await server.inject({
    method: "POST",
    url: `${base}/preview`,
    ...upload(`作品链接\n${url}`),
    remoteAddress: "192.168.1.50"
  });
  expect([401, 403]).toContain(response.statusCode);
  // Existing LAN security permits read-only GETs and requires an administrator for writes.
  expect((await server.inject({ method: "GET", url: groupBase, remoteAddress: "192.168.1.50" })).statusCode).toBe(200);
  for (const [method, url, payload] of [
    ["POST", groupBase, { name: "分组" }],
    ["POST", `${groupBase}/assign`, { groupId: null, itemIds: ["archive_1"] }],
    ["DELETE", `${groupBase}/group_123`, undefined]
  ] as const) {
    const denied = await server.inject({ method, url, ...(payload ? { payload } : {}), remoteAddress: "192.168.1.50" });
    expect([401, 403]).toContain(denied.statusCode);
  }
});
