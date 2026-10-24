/** LAN layout guards: isolated files and in-memory state only, never real cleanup roots. */
import fs from "node:fs/promises";
import path from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createIsolatedAppFixture } from "./helpers/isolated-app";
import { getConfig, type AppConfig } from "../config";
import { ToolboxDatabase } from "../database/toolbox-database";
import { createLanAccessController } from "../domains/lan-transfer/access";
import { ensureJsonIndex, readJsonIndex } from "../domains/lan-transfer/repository-io";
import { createLanUploadStore, getMissingChunks, mergeChunks, toUploadStatus } from "../domains/lan-transfer/uploads";
import { registerLanTransferRoutes } from "../domains/lan-transfer/routes";

let fixture: Awaited<ReturnType<typeof createIsolatedAppFixture>>;
let config: AppConfig;
let database: ToolboxDatabase;
let app: FastifyInstance | undefined;
beforeEach(async () => {
  fixture = await createIsolatedAppFixture();
  config = getConfig({ layout: fixture.layout, dotenvPath: false, environment: { NODE_ENV: "test" } });
  database = new ToolboxDatabase(":memory:");
});
afterEach(async () => {
  await app?.close();
  app = undefined;
  vi.restoreAllMocks();
  database?.close();
  await fixture?.dispose();
});
async function permissions(mode: AppConfig["lanTransferGuestMode"], deployment: AppConfig["deploymentMode"] = "local") {
  config.lanTransferPin = "synthetic-pin";
  config.lanTransferGuestMode = mode;
  config.deploymentMode = deployment;
  const access = createLanAccessController(config);
  app = Fastify();
  app.get("/permissions", async (request) => ({
    read: access.can(request, "read"),
    upload: access.can(request, "upload"),
    manage: access.can(request, "manage")
  }));
  app.post("/logout", async (request) => {
    access.logout(request);
    return { authenticated: access.isAuthenticated(request) };
  });
  return { access, app };
}
it.each([
  { mode: "full" as const, read: true, upload: true },
  { mode: "upload-only" as const, read: false, upload: true },
  { mode: "download-only" as const, read: true, upload: false },
  { mode: "disabled" as const, read: false, upload: false }
])("keeps local guest mode $mode separate from management", async ({ mode, read, upload }) => {
  const { app } = await permissions(mode);
  expect((await app.inject("/permissions")).json()).toEqual({ read, upload, manage: false });
});
it("keeps global-LAN management authorization separate from local PIN guest permissions", async () => {
  const { app } = await permissions("disabled", "lan");
  expect((await app.inject("/permissions")).json()).toEqual({ read: false, upload: false, manage: true });
});
it("keeps cookie scope, explicit logout and the original twelve-hour expiry", async () => {
  const { app, access } = await permissions("disabled");
  const now = Date.now();
  const clock = vi.spyOn(Date, "now").mockReturnValue(now);
  expect(access.login("incorrect")).toBeUndefined();
  const token = access.login("synthetic-pin");
  expect(token).toEqual(expect.any(String));
  if (!token) throw new Error("Expected synthetic login token");
  const cookie = access.sessionCookie(token);
  expect(cookie).toBe(
    `toolbox_lan_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=43200`
  );
  const headers = { cookie };
  expect((await app.inject({ url: "/permissions", headers })).json()).toEqual({
    read: true,
    upload: true,
    manage: true
  });
  clock.mockReturnValue(now + 12 * 60 * 60 * 1000);
  expect((await app.inject({ url: "/permissions", headers })).json()).toEqual({
    read: false,
    upload: false,
    manage: false
  });
  const next = access.login("synthetic-pin");
  if (!next) throw new Error("Expected another synthetic login token");
  const nextHeaders = { cookie: access.sessionCookie(next) };
  expect((await app.inject({ method: "POST", url: "/logout", headers: nextHeaders })).json()).toEqual({
    authenticated: false
  });
  expect((await app.inject({ url: "/permissions", headers: nextHeaders })).json()).toEqual({
    read: false,
    upload: false,
    manage: false
  });
  expect(access.expiredSessionCookie()).toBe("toolbox_lan_session=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0");
});
it("restores a missing index from its exact backup bytes without changing the backup", async () => {
  const target = path.join(fixture.root, "中文 index.json");
  const backup = '[  {"synthetic": true} ]\n';
  await fs.writeFile(`${target}.bak`, backup);
  await ensureJsonIndex(target);
  expect(await readJsonIndex(target)).toBe(backup);
  expect(await fs.readFile(`${target}.bak`, "utf8")).toBe(backup);
});
it("does not rewrite an existing malformed index or its backup at the generic IO boundary", async () => {
  const target = path.join(fixture.root, "index.json");
  await fs.writeFile(target, "{broken");
  await fs.writeFile(`${target}.bak`, "[]");
  expect(await readJsonIndex(target)).toBe("{broken");
  expect(await fs.readFile(`${target}.bak`, "utf8")).toBe("[]");
});
const uploadInput = { originalName: "商品.txt", mimeType: "text/plain", size: 5, chunkSize: 2, totalChunks: 3 };
it("retains out-of-order deduplication, exact last-chunk bytes and SQLite resume state", async () => {
  const uploads = createLanUploadStore(config, database);
  const session = await uploads.create(uploadInput);
  await Promise.all([2, 0, 2].map((index) => uploads.markChunkUploaded(session.uploadId, index)));
  const resumed = await createLanUploadStore(config, database).get(session.uploadId);
  expect(resumed?.uploadedChunks).toEqual([0, 2]);
  if (!resumed) throw new Error("Expected persisted upload");
  expect(getMissingChunks(resumed)).toEqual([1]);
  expect(toUploadStatus(resumed).uploadedBytes).toBe(3);
  expect(await uploads.totalDeclaredSize()).toBe(5);
});
it("keeps a finalizing upload's state and bytes while cleaning only the stale unreferenced session", async () => {
  const uploads = createLanUploadStore(config, database);
  const keep = await uploads.create(uploadInput);
  const stale = await uploads.create(uploadInput);
  await fs.writeFile(uploads.chunkPath(keep.uploadId, 0), "synthetic kept chunk");
  await fs.writeFile(uploads.chunkPath(stale.uploadId, 0), "synthetic stale chunk");
  const later = Math.max(Date.parse(keep.updatedAt), Date.parse(stale.updatedAt)) + 2 * 60 * 60 * 1000;
  vi.spyOn(Date, "now").mockReturnValue(later);
  expect(await uploads.cleanupStale(1, new Set([keep.uploadId]))).toEqual({ removed: 1 });
  expect(await uploads.get(keep.uploadId)).toBeDefined();
  expect(await fs.readFile(uploads.chunkPath(keep.uploadId, 0), "utf8")).toBe("synthetic kept chunk");
  expect(await uploads.get(stale.uploadId)).toBeUndefined();
  await expect(fs.stat(uploads.chunkPath(stale.uploadId, 0))).rejects.toMatchObject({ code: "ENOENT" });
});
it("removes only its partial merge when a chunk is missing and preserves an existing target and resume state", async () => {
  const uploads = createLanUploadStore(config, database);
  const session = await uploads.create(uploadInput);
  await fs.writeFile(uploads.chunkPath(session.uploadId, 0), "ab");
  const target = path.join(fixture.root, "old-target.txt");
  await fs.writeFile(target, "original synthetic bytes");
  await expect(mergeChunks(session, uploads, target)).rejects.toMatchObject({ code: "ENOENT" });
  expect(await fs.readFile(target, "utf8")).toBe("original synthetic bytes");
  expect((await fs.readdir(fixture.root)).some((name) => name.includes(".partial-"))).toBe(false);
  expect(await uploads.get(session.uploadId)).toBeDefined();
});
it("clears the exact unref'ed cleanup timer on application close", async () => {
  const intervals = vi.spyOn(globalThis, "setInterval");
  const cleared = vi.spyOn(globalThis, "clearInterval");
  app = Fastify();
  await registerLanTransferRoutes({ app, config, database });
  expect(intervals).toHaveBeenCalledExactlyOnceWith(
    expect.any(Function),
    config.lanTransferCleanupIntervalMinutes * 60 * 1000
  );
  const timer = intervals.mock.results[0].value as ReturnType<typeof setInterval>;
  expect(timer.hasRef()).toBe(false);
  await app.close();
  expect(cleared).toHaveBeenCalledWith(timer);
});
