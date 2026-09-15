/**
 * 中文模块说明：测试 backend/src/__tests__/image-tools.test.ts 中的稳定行为、边界条件和回归场景
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { Readable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";
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
  it.each(["jpeg", "png", "webp"] as const)("honors %s output when settings follow the file", async (format) => {
    const app = await createApp();
    try {
      // Exceed the multipart stream buffer so trailing fields cannot be parsed early.
      const image = await sharp(randomBytes(240 * 180 * 3), {
        raw: { width: 240, height: 180, channels: 3 }
      })
        .png()
        .toBuffer();
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/tools/image-compress",
        ...multipartPayload({
          fileName: "demo.png",
          mimeType: "image/png",
          content: image,
          fileFirst: true,
          fields: { quality: "60", outputFormat: format, width: "120" }
        })
      });
      expect(response.statusCode).toBe(200);
      const data = response.json().data;
      expect(data.outputFormat).toBe(format);
      expect(data.outputName).toMatch(new RegExp(`\\.${format}$`));
      const download = await app.inject({ method: "GET", url: data.downloadUrl });
      expect(download.statusCode).toBe(200);
      const metadata = await sharp(download.rawPayload).metadata();
      expect(metadata.format).toBe(format);
      expect(metadata.width).toBe(120);
      expect(metadata.height).toBe(90);
      const expected = await sharp(image)
        .rotate()
        .resize({ width: 120, withoutEnlargement: true })
        .toFormat(format, { quality: 60 })
        .toBuffer();
      expect(download.rawPayload.equals(expected)).toBe(true);
    } finally {
      await app.close();
    }
  });

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
      url: "/api/v1/tools/image-compress",
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
    expect(data.downloadUrl).toMatch(/\/api\/v1\/files\/.+\.webp$/);
    expect(data.originalName).toBe("demo.png");
    expect(data.outputFormat).toBe("webp");
    expect(data.originalSize).toBe(image.length);
    expect(data.outputSize).toBeGreaterThan(0);
    expect(data.savedBytes).toBe(data.originalSize - data.outputSize);
    expect(data.compressionRatio).toBeCloseTo(data.outputSize / data.originalSize, 4);
    expect(data.width).toBe(80);
    expect(data.height).toBe(60);
  });

  it("downloads all completed compression results in one zip", async () => {
    const app = await createApp();
    try {
      const image = await sharp({
        create: { width: 80, height: 60, channels: 3, background: "#2563eb" }
      })
        .png()
        .toBuffer();
      const taskIds: string[] = [];
      for (let index = 0; index < 2; index += 1) {
        const response = await app.inject({
          method: "POST",
          url: "/api/v1/tools/image-compress",
          ...multipartPayload({
            fileName: `demo-${index}.png`,
            mimeType: "image/png",
            content: image,
            fields: { outputFormat: "jpeg" }
          })
        });
        expect(response.statusCode).toBe(200);
        taskIds.push(response.json().data.task.id);
      }

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/tools/image-compress/download.zip",
        payload: {
          files: taskIds.map((taskId) => ({ taskId, fileName: "商品图.jpg" }))
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("application/zip");
      expect(response.rawPayload.subarray(0, 2).toString()).toBe("PK");
      const zipIndex = response.rawPayload.toString("utf8");
      expect(zipIndex).toContain("商品图.jpeg");
      expect(zipIndex).toContain("商品图 (2).jpeg");
    } finally {
      await app.close();
    }
  });
});

function multipartPayload(input: {
  fileName: string;
  mimeType: string;
  content: Buffer;
  fields?: Record<string, string>;
  fileFirst?: boolean;
}) {
  const boundary = `----toolbox-${Math.random().toString(16).slice(2)}`;
  const chunks: Buffer[] = [];

  const fieldChunks = Object.entries(input.fields ?? {}).map(([name, value]) =>
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`)
  );
  if (!input.fileFirst) chunks.push(...fieldChunks);

  chunks.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${input.fileName}"\r\nContent-Type: ${input.mimeType}\r\n\r\n`
    ),
    input.content,
    Buffer.from("\r\n")
  );
  if (input.fileFirst) chunks.push(...fieldChunks);
  chunks.push(Buffer.from(`--${boundary}--\r\n`));

  return {
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`
    },
    payload: input.fileFirst
      ? Readable.from(
          (async function* () {
            for (const chunk of chunks) {
              yield chunk;
              await delay(25);
            }
          })()
        )
      : Buffer.concat(chunks)
  };
}
