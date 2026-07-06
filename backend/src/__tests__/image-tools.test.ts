import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app";

let storageRoot: string;

beforeEach(async () => {
  storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-image-tools-"));
  process.env.STORAGE_ROOT = storageRoot;
});

afterEach(async () => {
  delete process.env.STORAGE_ROOT;
  await fs.rm(storageRoot, { recursive: true, force: true });
});

describe("image tools api", () => {
  it("returns compression metadata for uploaded images", async () => {
    const app = await createApp();
    const image = await sharp({
      create: {
        width: 80,
        height: 60,
        channels: 3,
        background: "#2563eb"
      }
    })
      .png()
      .toBuffer();

    const response = await app.inject({
      method: "POST",
      url: "/api/tools/image-compress",
      ...multipartPayload({
        fileName: "demo.png",
        mimeType: "image/png",
        content: image,
        fields: {
          quality: "60",
          outputFormat: "webp"
        }
      })
    });

    expect(response.statusCode).toBe(200);
    const data = response.json().data;
    expect(data.task.status).toBe("completed");
    expect(data.downloadUrl).toMatch(/\/api\/files\/.+\.webp$/);
    expect(data.originalName).toBe("demo.png");
    expect(data.outputFormat).toBe("webp");
    expect(data.originalSize).toBe(image.length);
    expect(data.outputSize).toBeGreaterThan(0);
    expect(data.savedBytes).toBe(data.originalSize - data.outputSize);
    expect(data.compressionRatio).toBeCloseTo(data.outputSize / data.originalSize, 4);
    expect(data.width).toBe(80);
    expect(data.height).toBe(60);
  });
});

function multipartPayload(input: {
  fileName: string;
  mimeType: string;
  content: Buffer;
  fields?: Record<string, string>;
}) {
  const boundary = `----toolbox-${Math.random().toString(16).slice(2)}`;
  const chunks: Buffer[] = [];

  for (const [name, value] of Object.entries(input.fields ?? {})) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  }

  chunks.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${input.fileName}"\r\nContent-Type: ${input.mimeType}\r\n\r\n`
    ),
    input.content,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  );

  return {
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`
    },
    payload: Buffer.concat(chunks)
  };
}
