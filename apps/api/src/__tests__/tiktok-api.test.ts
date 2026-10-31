/** Public-page fixtures exercise the real TikTok provider, file gateway, SQLite and HTTP routes. */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { getConfig } from "../config";
import { createDevelopmentRuntimeLayout } from "../runtime/runtime-layout";
import { archiveTranslationSourceHash } from "../domains/content-archive/core/text";
import { readArchiveZip } from "./helpers/archive-zip";
import { XhsTranslationRuntime } from "../domains/content-archive/core/translation-runtime";

const base = "/api/v1/tools/media-archive";
const contentId = "7700596613189963029";
const url = `https://www.tiktok.com/@shop/video/${contentId}`;
let root: string;
let png: Buffer;
let app: Awaited<ReturnType<typeof createApp>> | undefined;
let gallery: boolean;
let failMedia: boolean;
let videoShape: "standard" | "structured" | "mobile" | "empty" | "shop";
let failFallback: boolean;
let gate: (() => void) | undefined;
const video = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(40)]);
function box(kind: string, body: Buffer) {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(body.length + 8);
  header.write(kind, 4);
  return Buffer.concat([header, body]);
}
const shopVideo = Buffer.concat([
  box("ftyp", Buffer.from("isom0000")),
  box("mdat", Buffer.from("video fixture")),
  box("moov", box("trak", box("mdia", box("hdlr", Buffer.concat([Buffer.alloc(8), Buffer.from("vide")])))))
]);
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-tiktok-api-"));
  png = await sharp({ create: { width: 32, height: 48, channels: 3, background: "red" } })
    .png()
    .toBuffer();
  gallery = false;
  failMedia = false;
  videoShape = "standard";
  failFallback = false;
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
  vi.spyOn(XhsTranslationRuntime.prototype, "ensureReady").mockResolvedValue("https://translation.test");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown, init?: RequestInit) => {
      const target = String(input);
      if (target === "https://translation.test/translate")
        return new Response(
          JSON.stringify({ translations: JSON.parse(String(init?.body)).texts.map((text: string) => `EN:${text}`) }),
          { headers: { "content-type": "application/json" } }
        );
      if (target.startsWith("https://www.tiktok.com/@shop/")) {
        if (gate)
          await new Promise<void>((resolve) => {
            gate = resolve;
          });
        const item = {
          id: contentId,
          desc: "商品说明 #展示",
          author: { uniqueId: "shop", nickname: "Shop" },
          ...(videoShape === "shop" ? { isECVideo: 1, isAd: false } : {}),
          ...(gallery
            ? {
                imagePost: {
                  title: "图集",
                  images: [1, 2, 3].map((n) => ({ imageURL: { urlList: [`https://p16.tiktokcdn-us.com/${n}.png`] } }))
                }
              }
            : {
                video: {
                  playAddr: ["structured", "empty", "shop"].includes(videoShape)
                    ? ""
                    : "https://v16.tiktok.com/video.mp4",
                  ...(videoShape === "structured"
                    ? { PlayAddrStruct: { UrlList: ["https://v16.tiktok.com/video.mp4"] } }
                    : {}),
                  cover: "https://p16.tiktokcdn-us.com/cover.png",
                  duration: 5
                }
              })
        };
        const html = `<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">${JSON.stringify({ __DEFAULT_SCOPE__: { [videoShape === "mobile" ? "webapp.reflow.video.detail" : "webapp.video-detail"]: { statusCode: 0, itemInfo: { itemStruct: item } } } })}</script>`;
        return Object.defineProperty(new Response(html), "url", { value: target });
      }
      if (target.startsWith("https://p16.tiktokcdn-us.com/"))
        return new Response(new Uint8Array(png), {
          status: failMedia ? 403 : 200,
          headers: { "content-type": "image/png" }
        });
      if (target === "https://v16.tiktok.com/video.mp4")
        return new Response(new Uint8Array(video), { headers: { "content-type": "video/mp4" } });
      if (target.startsWith("https://www.tikwm.com/api/?")) {
        expect(new URL(target).searchParams.get("url")).toBe(url);
        const value = failFallback
          ? { code: -1 }
          : { code: 0, data: { id: contentId, title: "不应采用第三方标题", play: "https://v16.tiktok.com/shop.mp4" } };
        return Object.defineProperty(new Response(JSON.stringify(value)), "url", { value: target });
      }
      if (target === "https://v16.tiktok.com/shop.mp4") return new Response(new Uint8Array(shopVideo));
      throw new Error("Unexpected real network request");
    })
  );
  app = await createApp({ config, remoteAddressResolver: async () => [{ address: "93.184.216.34", family: 4 }] });
});
afterEach(async () => {
  gate?.();
  gate = undefined;
  await app?.close();
  app = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (path.dirname(root) !== os.tmpdir() || !path.basename(root).startsWith("toolbox-tiktok-api-"))
    throw new Error("Unsafe fixture path");
  await fs.rm(root, { recursive: true, force: true });
});
async function terminal(id: string) {
  let state;
  await vi.waitFor(async () => {
    state = (await app!.inject(`${base}/tasks/${id}`)).json().data;
    expect(["completed", "failed"]).toContain(state.status);
  });
  return state! as { status: string; archiveId?: string; errorCode?: string };
}
async function create() {
  const response = await app!.inject({ method: "POST", url: `${base}/items`, payload: { url, platform: "tiktok" } });
  expect(response.statusCode).toBe(202);
  return terminal(response.json().data.id);
}
it("archives video, serves Range/ZIP, saves translations/frames, refreshes stable identity and deletes selected data", async () => {
  const state = await create();
  expect(state.status).toBe("completed");
  const endpoint = `${base}/items/${state.archiveId}`;
  const item = (await app!.inject(endpoint)).json().data;
  expect(item).toMatchObject({
    platform: "tiktok",
    contentId,
    type: "video",
    rawText: "商品说明 #展示",
    media: [{ kind: "video" }, { kind: "cover" }]
  });
  expect((await app!.inject(`${base}/items?platform=tiktok`)).json().data.total).toBe(1);
  expect((await app!.inject(`${base}/items?platform=douyin`)).json().data.total).toBe(0);
  expect((await app!.inject(`/api/v1/tools/xhs-archive/items/${item.id}`)).statusCode).toBe(404);
  const range = await app!.inject({ url: item.media[0].previewUrl, headers: { range: "bytes=4-7" } });
  expect(range.statusCode).toBe(206);
  expect(range.rawPayload.toString()).toBe("ftyp");
  const translationJob = await app!.inject({
    method: "POST",
    url: `${endpoint}/translation`,
    payload: { force: false }
  });
  expect(translationJob.statusCode).toBe(202);
  await vi.waitFor(async () =>
    expect((await app!.inject(`${base}/translation/tasks/${translationJob.json().data.id}`)).json().data.status).toBe(
      "completed"
    )
  );
  const translated = await app!.inject({
    method: "PATCH",
    url: `${endpoint}/translation`,
    payload: {
      sourceHash: archiveTranslationSourceHash(item),
      title: { edited: "Product" },
      topics: []
    }
  });
  expect(translated.statusCode).toBe(200);
  const boundary = "TikTokFrameBoundary";
  const upload = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="sourceMediaId"\r\n\r\n${item.media[0].id}\r\n--${boundary}\r\nContent-Disposition: form-data; name="timestampMs"\r\n\r\n1000\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="frame.png"\r\nContent-Type: image/png\r\n\r\n`
    ),
    png,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);
  expect(
    (
      await app!.inject({
        method: "POST",
        url: `${endpoint}/frames`,
        headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
        payload: upload
      })
    ).statusCode
  ).toBe(200);
  const zip = await app!.inject(`${endpoint}/download.zip`);
  expect(zip.statusCode).toBe(200);
  const entries = [...readArchiveZip(zip.rawPayload).values()];
  expect(entries.some((bytes) => bytes.equals(video))).toBe(true);
  expect(entries.some((bytes) => bytes.equals(png))).toBe(true);
  expect(entries.some((bytes) => bytes.toString().includes("平台：TikTok"))).toBe(true);
  const refresh = await app!.inject({ method: "POST", url: `${endpoint}/refresh` });
  expect((await terminal(refresh.json().data.id)).archiveId).toBe(item.id);
  const refreshed = (await app!.inject(endpoint)).json().data;
  expect(refreshed.translation.title.edited).toBe("Product");
  expect(refreshed.media.some((m: { frameSourceMediaId?: string }) => m.frameSourceMediaId === item.media[0].id)).toBe(
    true
  );
  expect((await app!.inject({ method: "DELETE", url: endpoint })).statusCode).toBe(200);
  expect((await app!.inject(endpoint)).statusCode).toBe(404);
});
it("preserves all gallery images and the old archive when a refresh cannot download complete media", async () => {
  gallery = true;
  const state = await create();
  expect(state.status).toBe("completed");
  const endpoint = `${base}/items/${state.archiveId}`;
  const previous = (await app!.inject(endpoint)).json().data;
  expect(previous.type).toBe("image");
  expect(previous.media).toHaveLength(3);
  expect(previous.media.map((m: { index: number }) => m.index)).toEqual([0, 1, 2]);
  failMedia = true;
  const refresh = await app!.inject({ method: "POST", url: `${endpoint}/refresh` });
  expect(await terminal(refresh.json().data.id)).toMatchObject({
    status: "failed",
    errorCode: "ARCHIVE_MEDIA_DOWNLOAD_FAILED"
  });
  expect((await app!.inject(endpoint)).json().data.media).toEqual(previous.media);
});
it("archives shop fallback bytes through the real API/store and keeps the old archive after fallback refresh failure", async () => {
  videoShape = "shop";
  const state = await create();
  expect(state.status).toBe("completed");
  const endpoint = `${base}/items/${state.archiveId}`;
  const item = (await app!.inject(endpoint)).json().data;
  expect(item).toMatchObject({
    platform: "tiktok",
    contentId,
    title: "商品说明 #展示",
    media: [{ kind: "video" }, { kind: "cover" }]
  });
  expect((await app!.inject(item.media[0].previewUrl)).rawPayload).toEqual(shopVideo);
  expect((await app!.inject(`${base}/items?platform=tiktok`)).json().data.total).toBe(1);
  failFallback = true;
  const refresh = await app!.inject({ method: "POST", url: `${endpoint}/refresh` });
  expect(await terminal(refresh.json().data.id)).toMatchObject({
    status: "failed",
    errorCode: "TIKTOK_SHOP_FALLBACK_FAILED"
  });
  expect((await app!.inject(endpoint)).json().data).toEqual(item);
  expect((await app!.inject(item.media[0].downloadUrl)).rawPayload).toEqual(shopVideo);
});
it.each(["structured", "mobile"] as const)(
  "archives the actual video bytes from a %s public page through the existing file gateway",
  async (shape) => {
    videoShape = shape;
    const state = await create();
    expect(state.status).toBe("completed");
    const item = (await app!.inject(`${base}/items/${state.archiveId}`)).json().data;
    expect(item).toMatchObject({ contentId, type: "video", media: [{ kind: "video" }, { kind: "cover" }] });
    const media = await app!.inject(item.media[0].previewUrl);
    expect(media.statusCode).toBe(200);
    expect(media.rawPayload).toEqual(video);
  }
);
it("leaves a video archive and its downloadable files unchanged when public playback addresses disappear", async () => {
  const state = await create();
  const endpoint = `${base}/items/${state.archiveId}`;
  const previous = (await app!.inject(endpoint)).json().data;
  videoShape = "empty";
  const refresh = await app!.inject({ method: "POST", url: `${endpoint}/refresh` });
  expect(await terminal(refresh.json().data.id)).toMatchObject({ status: "failed", errorCode: "TIKTOK_MEDIA_INVALID" });
  expect((await app!.inject(endpoint)).json().data).toEqual(previous);
  expect((await app!.inject(previous.media[0].previewUrl)).rawPayload).toEqual(video);
  expect((await app!.inject(`${base}/items?platform=tiktok`)).json().data.total).toBe(1);
});
it("cancels without an archive and reports a separate anonymous runtime without installed packages", async () => {
  expect((await app!.inject(`${base}/runtime/tiktok`)).json().data).toMatchObject({
    platform: "tiktok",
    available: true,
    mode: "anonymous"
  });
  gate = () => undefined;
  const response = await app!.inject({ method: "POST", url: `${base}/items`, payload: { url } });
  await vi.waitFor(() => expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0));
  const cancelled = await app!.inject({ method: "DELETE", url: `${base}/tasks/${response.json().data.id}` });
  expect(cancelled.json().data).toMatchObject({ status: "failed", errorCode: "ARCHIVE_CANCELLED" });
  gate();
  gate = undefined;
  expect((await app!.inject(`${base}/items?platform=tiktok`)).json().data.total).toBe(0);
});
