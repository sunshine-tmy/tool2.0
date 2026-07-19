import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";

const originalFetch = globalThis.fetch;
const publicTestResolver = async () => [{ address: "93.184.216.34", family: 4 }];
let storageRoot: string;

beforeEach(async () => {
  storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-video-insights-"));
  process.env.STORAGE_ROOT = storageRoot;
  process.env.SHORT_VIDEO_PARSE_API_URL = "https://provider.test/api/short_videos";
  process.env.VIDEO_TEXT_TRANSCRIBE_COMMAND = "";
});

afterEach(async () => {
  globalThis.fetch = originalFetch;
  for (const name of [
    "STORAGE_ROOT",
    "SHORT_VIDEO_PARSE_API_URL",
    "VIDEO_TEXT_TRANSCRIBE_COMMAND",
    "VIDEO_TEXT_AUDIO_EXTRACT_COMMAND",
    "VIDEO_INSIGHTS_MODEL_BASE_URL",
    "VIDEO_INSIGHTS_MODEL_NAME",
    "VIDEO_INSIGHTS_MODEL_API_KEY",
    "VIDEO_INSIGHTS_MODEL_TIMEOUT_MS",
    "REMOTE_MEDIA_MAX_BYTES"
  ])
    delete process.env[name];
  vi.restoreAllMocks();
  await fs.rm(storageRoot, { recursive: true, force: true });
});

function providerResponse(title = "商品实测") {
  return new Response(
    JSON.stringify({
      code: 200,
      platform: "douyin",
      data: {
        type: "video",
        title,
        desc: "限时优惠，点击下单，售价99元。",
        author: { name: "creator", id: "100" },
        cover: "https://cdn.test/cover.jpg",
        url: "https://cdn.test/video.mp4"
      }
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}

async function createCard(app: Awaited<ReturnType<typeof createApp>>, suffix = "abc123") {
  return app.inject({
    method: "POST",
    url: "/api/tools/video-insights",
    payload: { input: `https://v.douyin.com/${suffix}/` }
  });
}

async function configureUploadTranscriber(transcriptText: string) {
  const helperPath = path.join(storageRoot, "video-insight-upload-helper.cjs");
  await fs.writeFile(
    helperPath,
    `
const fs = require("fs");
const [mode, input, output] = process.argv.slice(2);
if (mode === "extract") {
  fs.writeFileSync(output, "audio:" + fs.readFileSync(input, "utf8"));
} else if (mode === "transcribe") {
  fs.writeFileSync(output, ${JSON.stringify(transcriptText)});
}
`,
    "utf8"
  );
  process.env.VIDEO_TEXT_AUDIO_EXTRACT_COMMAND = `"${process.execPath}" "${helperPath}" extract {input} {output}`;
  process.env.VIDEO_TEXT_TRANSCRIBE_COMMAND = `"${process.execPath}" "${helperPath}" transcribe {input} {output}`;
}

function multipartPayload(input: { fileName: string; mimeType: string; content: string }) {
  const boundary = `----toolbox-${Math.random().toString(16).slice(2)}`;
  return {
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload: [
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${input.fileName}"\r\nContent-Type: ${input.mimeType}\r\n\r\n${input.content}\r\n`,
      `--${boundary}--\r\n`
    ].join("")
  };
}

describe("video insights api", () => {
  it("uploads, transcribes and analyzes a local video without retaining the media", async () => {
    await configureUploadTranscriber(
      "油皮夏天是不是一化妆就脱妆？这套方法通过控油打底让底妆更持久。实测八小时后妆面仍然完整。收藏这条视频照着做。"
    );
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    const app = await createApp({ remoteAddressResolver: publicTestResolver });
    const response = await app.inject({
      method: "POST",
      url: "/api/tools/video-insights/upload",
      ...multipartPayload({ fileName: "../../油皮底妆.mp4", mimeType: "video/mp4", content: "fake-video" })
    });

    expect(response.statusCode).toBe(201);
    const card = response.json().data;
    expect(card).toMatchObject({
      platform: "unknown",
      provider: "local-upload",
      source: { type: "upload", mimeType: "video/mp4" },
      transcript: { status: "completed" },
      analysis: { version: 3 }
    });
    expect(card.source.originalFileName).toBe("油皮底妆.mp4");
    expect(card.analysis.improvements).toBeInstanceOf(Array);
    expect(card.analysis.finalOutput.fullScript).toContain("油皮夏天");
    expect(card.analysis.changeLog.length).toBeGreaterThan(0);
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(fs.readdir(path.join(storageRoot, "video-text", "uploads"))).resolves.toEqual([]);
    await expect(fs.readdir(path.join(storageRoot, "video-text", "audio"))).resolves.toEqual([]);
    await expect(fs.readdir(path.join(storageRoot, "video-text", "results"))).resolves.toEqual([]);
    await expect(fs.readdir(path.join(storageRoot, "video-insights", "cards"))).resolves.toHaveLength(1);
  });

  it("rejects local video uploads when transcription is unavailable", async () => {
    const app = await createApp({ remoteAddressResolver: publicTestResolver });
    const response = await app.inject({
      method: "POST",
      url: "/api/tools/video-insights/upload",
      ...multipartPayload({ fileName: "silent.mp4", mimeType: "video/mp4", content: "fake-video" })
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe("VIDEO_TRANSCRIBER_NOT_CONFIGURED");
    await expect(fs.readdir(path.join(storageRoot, "video-insights", "cards"))).resolves.toEqual([]);
  });

  it("rejects non-video uploads and oversized video streams", async () => {
    await configureUploadTranscriber("有效转写文本");
    process.env.REMOTE_MEDIA_MAX_BYTES = "5";
    const app = await createApp({ remoteAddressResolver: publicTestResolver });
    const invalidType = await app.inject({
      method: "POST",
      url: "/api/tools/video-insights/upload",
      ...multipartPayload({ fileName: "notes.txt", mimeType: "text/plain", content: "notes" })
    });
    expect(invalidType.statusCode).toBe(415);

    const tooLarge = await app.inject({
      method: "POST",
      url: "/api/tools/video-insights/upload",
      ...multipartPayload({ fileName: "large.mp4", mimeType: "video/mp4", content: "more-than-five-bytes" })
    });
    expect(tooLarge.statusCode).toBe(413);
    await expect(fs.readdir(path.join(storageRoot, "video-insights", "cards"))).resolves.toEqual([]);
    await expect(fs.readdir(path.join(storageRoot, "video-text", "uploads"))).resolves.toEqual([]);
  });

  it("creates a persistent rule-based card when local transcription is unavailable", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(providerResponse());
    const app = await createApp({ remoteAddressResolver: publicTestResolver });
    const response = await createCard(app);
    const body = response.json();

    expect(response.statusCode).toBe(201);
    expect(body.data.transcript).toMatchObject({ status: "unavailable" });
    expect(body.data.analysis).toMatchObject({ source: "rules" });
    expect(body.data.analysis.keywords.price).toContain("售价99元");
    expect(await fs.readdir(path.join(storageRoot, "video-insights", "cards"))).toHaveLength(1);

    await app.close();
    const restoredApp = await createApp({ remoteAddressResolver: publicTestResolver });
    const list = await restoredApp.inject({
      method: "GET",
      url: "/api/tools/video-insights?page=1&pageSize=1&platform=douyin"
    });
    expect(list.json().data).toMatchObject({ total: 1, page: 1, pageSize: 1 });
  });

  it("keeps the card when local transcription fails", async () => {
    process.env.VIDEO_TEXT_TRANSCRIBE_COMMAND = "not-a-real-transcriber {input} {output}";
    process.env.VIDEO_TEXT_AUDIO_EXTRACT_COMMAND = "not-a-real-extractor {input} {output}";
    globalThis.fetch = vi
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve(
          url.includes("provider.test") ? providerResponse() : new Response("video-bytes", { status: 200 })
        )
      );
    const app = await createApp({ remoteAddressResolver: publicTestResolver });
    const response = await createCard(app, "transcription-failure");

    expect(response.statusCode).toBe(201);
    expect(response.json().data.transcript).toMatchObject({ status: "unavailable" });
    expect(response.json().data.warnings.join(" ")).toContain("本地转写未完成");
  });

  it("rejects duplicate links and deletes only the local card", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(providerResponse());
    const app = await createApp({ remoteAddressResolver: publicTestResolver });
    const first = await createCard(app);
    const duplicate = await createCard(app);
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().error.code).toBe("VIDEO_INSIGHT_DUPLICATE");

    const removed = await app.inject({ method: "DELETE", url: `/api/tools/video-insights/${first.json().data.id}` });
    expect(removed.json().data).toEqual({ removed: true });
    const missing = await app.inject({ method: "GET", url: `/api/tools/video-insights/${first.json().data.id}` });
    expect(missing.statusCode).toBe(404);
  });

  it("handles unavailable providers without creating a card", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ code: 503, msg: "unavailable" }), { status: 200 }));
    const app = await createApp({ remoteAddressResolver: publicTestResolver });
    const response = await createCard(app);
    expect(response.statusCode).toBe(502);
    const list = await app.inject({ method: "GET", url: "/api/tools/video-insights" });
    expect(list.json().data.total).toBe(0);
  });

  it("requires explicit model configuration and never returns its key", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(providerResponse());
    const app = await createApp({ remoteAddressResolver: publicTestResolver });
    const created = await createCard(app);
    const response = await app.inject({
      method: "POST",
      url: `/api/tools/video-insights/${created.json().data.id}/analyze`,
      payload: { mode: "model" }
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe("MODEL_NOT_CONFIGURED");

    await app.close();
    process.env.VIDEO_INSIGHTS_MODEL_BASE_URL = "http://127.0.0.1:11434/v1";
    process.env.VIDEO_INSIGHTS_MODEL_NAME = "local-model";
    process.env.VIDEO_INSIGHTS_MODEL_API_KEY = "must-not-leak";
    process.env.VIDEO_INSIGHTS_MODEL_TIMEOUT_MS = "1000";
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("chat/completions")) return Promise.resolve(new Response("failure", { status: 500 }));
      return Promise.resolve(providerResponse());
    });
    const configuredApp = await createApp({ remoteAddressResolver: publicTestResolver });
    const list = await configuredApp.inject({ method: "GET", url: "/api/tools/video-insights" });
    expect(JSON.stringify(list.json())).not.toContain("must-not-leak");

    globalThis.fetch = vi.fn().mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), {
            once: true
          });
        })
    );
    const timedOut = await configuredApp.inject({
      method: "POST",
      url: `/api/tools/video-insights/${created.json().data.id}/analyze`,
      payload: { mode: "model" }
    });
    expect(timedOut.statusCode).toBe(504);
    expect(JSON.stringify(timedOut.json())).not.toContain("must-not-leak");
  });
});
