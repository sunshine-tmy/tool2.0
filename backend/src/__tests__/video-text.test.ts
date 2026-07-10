import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";

const originalFetch = globalThis.fetch;
let storageRoot: string;

beforeEach(async () => {
  storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-video-text-"));
  process.env.STORAGE_ROOT = storageRoot;
  process.env.VIDEO_TEXT_AUDIO_EXTRACT_COMMAND = "";
  process.env.VIDEO_TEXT_TRANSCRIBE_COMMAND = "";
});

afterEach(async () => {
  globalThis.fetch = originalFetch;
  delete process.env.STORAGE_ROOT;
  delete process.env.VIDEO_TEXT_AUDIO_EXTRACT_COMMAND;
  delete process.env.VIDEO_TEXT_TRANSCRIBE_COMMAND;
  vi.restoreAllMocks();
  await fs.rm(storageRoot, { recursive: true, force: true });
});

describe("video text api", () => {
  it("ignores submitted transcript text and uses the configured local transcriber", async () => {
    const helperPath = path.join(storageRoot, "video-text-ignore-transcript-helper.cjs");
    await fs.writeFile(
      helperPath,
      `
const fs = require("fs");
const [mode, input, output] = process.argv.slice(2);
if (mode === "extract") {
  fs.writeFileSync(output, "audio");
} else if (mode === "transcribe") {
  fs.writeFileSync(output, "Transcribed speech from video only.");
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
        fileName: "demo.mp4",
        mimeType: "video/mp4",
        content: "fake-video",
        fields: {
          transcript: `1
00:00:01,000 --> 00:00:03,000
Injected text should be ignored.`
        }
      })
    });

    expect(response.statusCode).toBe(200);
    const data = response.json().data;
    expect(data.task.status).toBe("completed");
    expect(data.result.fullText).toContain("Transcribed speech from video only");
    expect(data.result.fullText).not.toContain("Injected text should be ignored");
    expect(data.result.source).toBe("transcriber");
    expect(Object.hasOwn(data.result, "keywords")).toBe(false);
    expect(Object.hasOwn(data.result, "suggestions")).toBe(false);
  });

  it("reports a clear failure when local transcription is not configured", async () => {
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
    expect(data.needsTranscript).toBeUndefined();
    expect(data.result).toBeNull();
  });

  it("recreates upload directories before saving video files", async () => {
    const helperPath = path.join(storageRoot, "video-text-recovered-upload-helper.cjs");
    await fs.writeFile(
      helperPath,
      `
const fs = require("fs");
const [mode, input, output] = process.argv.slice(2);
if (mode === "extract") {
  fs.writeFileSync(output, "audio");
} else if (mode === "transcribe") {
  fs.writeFileSync(output, "Recovered upload directory transcript.");
}
`,
      "utf8"
    );
    process.env.VIDEO_TEXT_AUDIO_EXTRACT_COMMAND = `"${process.execPath}" "${helperPath}" extract {input} {output}`;
    process.env.VIDEO_TEXT_TRANSCRIBE_COMMAND = `"${process.execPath}" "${helperPath}" transcribe {input} {output}`;

    const app = await createApp();
    await fs.rm(path.join(storageRoot, "video-text", "uploads"), { recursive: true, force: true });

    const response = await app.inject({
      method: "POST",
      url: "/api/tools/video-text/tasks",
      ...multipartPayload({
        fileName: "demo.mp4",
        mimeType: "video/mp4",
        content: "fake-video"
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

  it("downloads a remote video url and creates a video text task", async () => {
    const helperPath = path.join(storageRoot, "video-text-remote-url-helper.cjs");
    await fs.writeFile(
      helperPath,
      `
const fs = require("fs");
const [mode, input, output] = process.argv.slice(2);
if (mode === "extract") {
  fs.writeFileSync(output, "audio from " + fs.readFileSync(input, "utf8"));
} else if (mode === "transcribe") {
  fs.writeFileSync(output, "Remote short video transcript. " + fs.readFileSync(input, "utf8"));
}
`,
      "utf8"
    );
    process.env.VIDEO_TEXT_AUDIO_EXTRACT_COMMAND = `"${process.execPath}" "${helperPath}" extract {input} {output}`;
    process.env.VIDEO_TEXT_TRANSCRIBE_COMMAND = `"${process.execPath}" "${helperPath}" transcribe {input} {output}`;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("remote-video", {
        status: 200,
        headers: { "content-type": "video/mp4", "content-length": "12" }
      })
    );
    globalThis.fetch = fetchMock;

    const app = await createApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/tools/video-text/tasks/from-url",
      payload: {
        url: "https://cdn.test/creator-video.mp4",
        fileName: "达人视频.mp4"
      }
    });

    expect(response.statusCode).toBe(200);
    const data = response.json().data;
    expect(data.task.status).toBe("completed");
    expect(data.result.fileName).toBe("达人视频.mp4");
    expect(data.result.fullText).toContain("Remote short video transcript");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://cdn.test/creator-video.mp4",
      expect.objectContaining({
        headers: expect.objectContaining({ accept: "video/*,*/*" })
      })
    );
  });

  it("proxies a remote video url for browser preview", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("remote-video", {
        status: 200,
        headers: { "content-type": "video/mp4", "content-length": "12" }
      })
    );
    globalThis.fetch = fetchMock;

    const app = await createApp();
    const response = await app.inject({
      method: "GET",
      url: `/api/tools/video-text/remote-video?url=${encodeURIComponent("https://cdn.test/video.mp4")}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("video/mp4");
    expect(response.headers["content-length"]).toBe("12");
    expect(response.body).toBe("remote-video");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://cdn.test/video.mp4",
      expect.objectContaining({
        headers: expect.objectContaining({
          accept: "video/*,*/*",
          referer: "https://cdn.test/"
        })
      })
    );
  });

  it("attaches optional transcriber quality metadata from sidecar output", async () => {
    const helperPath = path.join(storageRoot, "video-text-quality-helper.cjs");
    await fs.writeFile(
      helperPath,
      `
const fs = require("fs");
const [mode, input, output] = process.argv.slice(2);
if (mode === "extract") {
  fs.writeFileSync(output, "audio");
} else if (mode === "transcribe") {
  fs.writeFileSync(output, "1\\n00:00:00,000 --> 00:00:02,000\\n精准中文口播。\\n");
  fs.writeFileSync(output + ".meta.json", JSON.stringify({
    model: "large-v3-turbo",
    language: "zh",
    device: "cuda",
    computeType: "int8_float16",
    averageLogProbability: -0.18,
    lowConfidenceSegments: [
      { index: 1, startSeconds: 0, endSeconds: 2, text: "精准中文口播。", averageLogProbability: -0.92 }
    ]
  }));
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
        fileName: "quality.mp4",
        mimeType: "video/mp4",
        content: "fake-video"
      })
    });

    expect(response.statusCode).toBe(200);
    const data = response.json().data;
    expect(data.task.status).toBe("completed");
    expect(data.result.recognitionQuality).toMatchObject({
      model: "large-v3-turbo",
      language: "zh",
      device: "cuda",
      computeType: "int8_float16",
      averageLogProbability: -0.18
    });
    expect(data.result.recognitionQuality.lowConfidenceSegments).toHaveLength(1);
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
    expect(data.task.error).not.toEqual("视频语音识别失败：未配置本地识别命令。");
    expect(data.result).toBeNull();
  });

  it("exports completed transcript results as text", async () => {
    const helperPath = path.join(storageRoot, "video-text-export-helper.cjs");
    await fs.writeFile(
      helperPath,
      `
const fs = require("fs");
const [mode, input, output] = process.argv.slice(2);
if (mode === "extract") {
  fs.writeFileSync(output, "audio");
} else if (mode === "transcribe") {
  fs.writeFileSync(output, "Fresh product demo copy.");
}
`,
      "utf8"
    );
    process.env.VIDEO_TEXT_AUDIO_EXTRACT_COMMAND = `"${process.execPath}" "${helperPath}" extract {input} {output}`;
    process.env.VIDEO_TEXT_TRANSCRIBE_COMMAND = `"${process.execPath}" "${helperPath}" transcribe {input} {output}`;

    const app = await createApp();
    const created = await app.inject({
      method: "POST",
      url: "/api/tools/video-text/tasks",
      ...multipartPayload({
        fileName: "demo.mp4",
        mimeType: "video/mp4",
        content: "fake-video"
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
    const app = await createVideoTextTestApp();
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

  it("ignores transcriber metadata sidecar files when listing analysis history", async () => {
    const app = await createVideoTextTestApp();
    const created = await createVideoTextTask(app, {
      fileName: "with-sidecar.mp4",
      transcript: "Sidecar files should not appear in history."
    });
    const taskId = created.json().data.task.id;
    await fs.writeFile(
      path.join(storageRoot, "video-text", "results", `${taskId}.txt.meta.json`),
      JSON.stringify({
        model: "medium",
        language: "zh",
        device: "cpu",
        computeType: "int8"
      }),
      "utf8"
    );

    const response = await app.inject({
      method: "GET",
      url: "/api/tools/video-text/history?page=1&pageSize=5"
    });

    expect(response.statusCode).toBe(200);
    const data = response.json().data;
    expect(data.total).toBe(1);
    expect(data.items).toHaveLength(1);
    expect(data.items[0].id).toBe(taskId);
  });

  it("deletes analysis history and stored result content", async () => {
    const app = await createVideoTextTestApp();
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

async function createVideoTextTestApp() {
  const helperPath = path.join(storageRoot, "video-text-shared-helper.cjs");
  await fs.writeFile(
    helperPath,
    `
const fs = require("fs");
const [mode, inputPath, output] = process.argv.slice(2);
if (mode === "extract") {
  fs.copyFileSync(inputPath, output);
} else if (mode === "transcribe") {
  fs.copyFileSync(inputPath, output);
}
`,
    "utf8"
  );
  process.env.VIDEO_TEXT_AUDIO_EXTRACT_COMMAND = `"${process.execPath}" "${helperPath}" extract {input} {output}`;
  process.env.VIDEO_TEXT_TRANSCRIBE_COMMAND = `"${process.execPath}" "${helperPath}" transcribe {input} {output}`;
  return createApp();
}

function createVideoTextTask(app: Awaited<ReturnType<typeof createApp>>, input: { fileName: string; transcript: string }) {
  return app.inject({
    method: "POST",
    url: "/api/tools/video-text/tasks",
    ...multipartPayload({
      fileName: input.fileName,
      mimeType: "video/mp4",
      content: input.transcript
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
