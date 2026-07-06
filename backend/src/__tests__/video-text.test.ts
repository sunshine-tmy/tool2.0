import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app";

let storageRoot: string;

beforeEach(async () => {
  storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-video-text-"));
  process.env.STORAGE_ROOT = storageRoot;
  process.env.VIDEO_TEXT_AUDIO_EXTRACT_COMMAND = "";
  process.env.VIDEO_TEXT_TRANSCRIBE_COMMAND = "";
});

afterEach(async () => {
  delete process.env.STORAGE_ROOT;
  delete process.env.VIDEO_TEXT_AUDIO_EXTRACT_COMMAND;
  delete process.env.VIDEO_TEXT_TRANSCRIBE_COMMAND;
  await fs.rm(storageRoot, { recursive: true, force: true });
});

describe("video text api", () => {
  it("creates a completed analysis task from uploaded video and transcript text", async () => {
    const app = await createApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/tools/video-text/tasks",
      ...multipartPayload({
        fileName: "demo.mp4",
        mimeType: "video/mp4",
        content: "fake-video",
        fields: {
          transcript: `1
00:00:01,000 --> 00:00:03,000
Summer dress fabric is soft.

2
00:00:04,000 --> 00:00:06,000
Click shop cart for discount.`
        }
      })
    });

    expect(response.statusCode).toBe(200);
    const data = response.json().data;
    expect(data.task.status).toBe("completed");
    expect(data.result.fullText).toContain("Summer dress fabric");
    expect(data.result.segments).toHaveLength(2);
    expect(Object.hasOwn(data.result, "keywords")).toBe(false);
    expect(Object.hasOwn(data.result, "suggestions")).toBe(false);
  });

  it("reports a clear failure when no transcript source is available", async () => {
    const app = await createApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/tools/video-text/tasks",
      ...multipartPayload({
        fileName: "speech-only.mp4",
        mimeType: "video/mp4",
        content: "fake-video"
      })
    });

    expect(response.statusCode).toBe(200);
    const data = response.json().data;
    expect(data.task.status).toBe("failed");
    expect(data.task.error).toContain("未配置");
  });

  it("recreates upload directories before saving video files", async () => {
    const app = await createApp();
    await fs.rm(path.join(storageRoot, "video-text", "uploads"), { recursive: true, force: true });

    const response = await app.inject({
      method: "POST",
      url: "/api/tools/video-text/tasks",
      ...multipartPayload({
        fileName: "demo.mp4",
        mimeType: "video/mp4",
        content: "fake-video",
        fields: {
          transcript: "Recovered upload directory transcript."
        }
      })
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.task.status).toBe("completed");
    await expect(fs.readdir(path.join(storageRoot, "video-text", "uploads"))).resolves.toEqual(
      expect.arrayContaining([expect.stringMatching(/demo\.mp4$/)])
    );
  });

  it("extracts audio and transcribes uploaded video when local commands are configured", async () => {
    const helperPath = path.join(storageRoot, "video-text-helper.cjs");
    await fs.writeFile(
      helperPath,
      `
const fs = require("fs");
const [mode, input, output] = process.argv.slice(2);
if (mode === "extract") {
  fs.writeFileSync(output, "audio from " + fs.readFileSync(input, "utf8"));
} else if (mode === "transcribe") {
  const audio = fs.readFileSync(input, "utf8");
  fs.writeFileSync(output, "Voice script from local transcriber. Click shop cart today. " + audio);
}
`,
      "utf8"
    );
    process.env.VIDEO_TEXT_AUDIO_EXTRACT_COMMAND = `"${process.execPath}" "${helperPath}" extract {input} {output}`;
    process.env.VIDEO_TEXT_TRANSCRIBE_COMMAND = `"${process.execPath}" "${helperPath}" transcribe {input} {output}`;

    const app = await createApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/tools/video-text/tasks",
      ...multipartPayload({
        fileName: "speech-only.mp4",
        mimeType: "video/mp4",
        content: "fake-video"
      })
    });

    expect(response.statusCode).toBe(200);
    const data = response.json().data;
    expect(data.task.status).toBe("completed");
    expect(data.result.source).toBe("transcriber");
    expect(data.result.fullText).toContain("Voice script from local transcriber");
    await expect(fs.readdir(path.join(storageRoot, "video-text", "audio"))).resolves.toEqual(
      expect.arrayContaining([expect.stringMatching(/\.wav$/)])
    );
  });

  it("reports empty transcription separately from missing configuration", async () => {
    const helperPath = path.join(storageRoot, "video-text-empty-helper.cjs");
    await fs.writeFile(
      helperPath,
      `
const fs = require("fs");
const [mode, input, output] = process.argv.slice(2);
if (mode === "extract") {
  fs.writeFileSync(output, "audio");
} else if (mode === "transcribe") {
  fs.writeFileSync(output, "");
}
`,
      "utf8"
    );
    process.env.VIDEO_TEXT_AUDIO_EXTRACT_COMMAND = `"${process.execPath}" "${helperPath}" extract {input} {output}`;
    process.env.VIDEO_TEXT_TRANSCRIBE_COMMAND = `"${process.execPath}" "${helperPath}" transcribe {input} {output}`;

    const app = await createApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/tools/video-text/tasks",
      ...multipartPayload({
        fileName: "silent.mp4",
        mimeType: "video/mp4",
        content: "fake-video"
      })
    });

    expect(response.statusCode).toBe(200);
    const data = response.json().data;
    expect(data.task.status).toBe("failed");
    expect(data.task.error).toContain("未识别到");
    expect(data.task.error).not.toContain("未配置");
  });

  it("exports completed transcript results as text", async () => {
    const app = await createApp();
    const created = await app.inject({
      method: "POST",
      url: "/api/tools/video-text/tasks",
      ...multipartPayload({
        fileName: "demo.mp4",
        mimeType: "video/mp4",
        content: "fake-video",
        fields: {
          transcript: "Fresh product demo copy."
        }
      })
    });
    const taskId = created.json().data.task.id;

    const exported = await app.inject({
      method: "GET",
      url: `/api/tools/video-text/tasks/${taskId}/export?format=txt`
    });

    expect(exported.statusCode).toBe(200);
    expect(exported.headers["content-type"]).toContain("text/plain");
    expect(exported.body).toContain("Fresh product demo copy.");
  });

  it("lists completed analysis history with keyword filtering and pagination", async () => {
    const app = await createApp();
    await createVideoTextTask(app, {
      fileName: "summer-demo.mp4",
      transcript: "Summer dress product copy. Buy today."
    });
    await createVideoTextTask(app, {
      fileName: "winter-demo.mp4",
      transcript: "Winter coat product copy. Warm fabric."
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/tools/video-text/history?keyword=summer&page=1&pageSize=1"
    });

    expect(response.statusCode).toBe(200);
    const data = response.json().data;
    expect(data.total).toBe(1);
    expect(data.page).toBe(1);
    expect(data.pageSize).toBe(1);
    expect(data.items).toHaveLength(1);
    expect(data.items[0].fileName).toBe("summer-demo.mp4");
    expect(data.items[0].textPreview).toContain("Summer dress");
    expect(Object.hasOwn(data.items[0], "keywords")).toBe(false);
  });

  it("deletes analysis history and stored result content", async () => {
    const app = await createApp();
    const created = await createVideoTextTask(app, {
      fileName: "delete-me.mp4",
      transcript: "Temporary campaign copy."
    });
    const taskId = created.json().data.task.id;

    const deleted = await app.inject({
      method: "DELETE",
      url: `/api/tools/video-text/history/${taskId}`
    });
    expect(deleted.statusCode).toBe(200);
    expect(deleted.json().data.removed).toBe(true);

    const history = await app.inject({
      method: "GET",
      url: "/api/tools/video-text/history?keyword=temporary"
    });
    expect(history.json().data.total).toBe(0);

    const result = await app.inject({
      method: "GET",
      url: `/api/tools/video-text/tasks/${taskId}/result`
    });
    expect(result.statusCode).toBe(404);
  });
});

function createVideoTextTask(app: Awaited<ReturnType<typeof createApp>>, input: { fileName: string; transcript: string }) {
  return app.inject({
    method: "POST",
    url: "/api/tools/video-text/tasks",
    ...multipartPayload({
      fileName: input.fileName,
      mimeType: "video/mp4",
      content: "fake-video",
      fields: {
        transcript: input.transcript
      }
    })
  });
}

function multipartPayload(input: {
  fileName: string;
  mimeType: string;
  content: string;
  fields?: Record<string, string>;
}) {
  const boundary = `----toolbox-${Math.random().toString(16).slice(2)}`;
  const chunks: string[] = [];

  for (const [name, value] of Object.entries(input.fields ?? {})) {
    chunks.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
    );
  }

  chunks.push(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${input.fileName}"\r\nContent-Type: ${input.mimeType}\r\n\r\n${input.content}\r\n`
  );
  chunks.push(`--${boundary}--\r\n`);

  return {
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`
    },
    payload: chunks.join("")
  };
}
