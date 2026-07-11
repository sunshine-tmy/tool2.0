import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";
import { createApp } from "../app";

let storageRoot: string;

beforeEach(async () => {
  storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-lan-"));
  process.env.STORAGE_ROOT = storageRoot;
  process.env.LAN_TRANSFER_MAX_FILE_BYTES = String(20 * 1024 * 1024 * 1024);
  process.env.LAN_TRANSFER_RETENTION_DAYS = "7";
  process.env.LAN_PUBLIC_BASE_URL = "http://192.168.1.241:3100";
});

afterEach(async () => {
  delete process.env.STORAGE_ROOT;
  delete process.env.LAN_TRANSFER_MAX_FILE_BYTES;
  delete process.env.LAN_TRANSFER_RETENTION_DAYS;
  delete process.env.LAN_PUBLIC_BASE_URL;
  await fs.rm(storageRoot, { recursive: true, force: true });
});

describe("lan transfer api", () => {
  it("supports the canonical tools namespace for LAN file APIs", async () => {
    const app = await createApp();
    const upload = await app.inject({
      method: "POST",
      url: "/api/tools/lan-transfer/files",
      ...multipartPayload("file", "route.txt", "text/plain", "new namespace")
    });

    expect(upload.statusCode).toBe(200);
    const id = upload.json().data.file.id;

    const list = await app.inject({
      method: "GET",
      url: "/api/tools/lan-transfer/files"
    });
    expect(list.json().data.files).toHaveLength(1);

    const preview = await app.inject({
      method: "GET",
      url: `/api/tools/lan-transfer/files/${id}/preview`
    });
    expect(preview.body).toBe("new namespace");
  });

  it("uploads a file, stores metadata, lists it, previews it, and downloads it", async () => {
    const app = await createApp();
    const upload = await app.inject({
      method: "POST",
      url: "/api/lan/files",
      ...multipartPayload("file", "note.txt", "text/plain", "hello lan")
    });

    expect(upload.statusCode).toBe(200);
    const uploaded = upload.json().data.file;
    expect(uploaded).toMatchObject({
      originalName: "note.txt",
      mimeType: "text/plain",
      extension: "txt",
      category: "text",
      size: 9,
      downloadCount: 0,
      previewable: true
    });
    expect(upload.json().data.previewUrl).toBe(`/api/lan/files/${uploaded.id}/preview`);
    expect(upload.json().data.downloadUrl).toBe(`/api/lan/files/${uploaded.id}/download`);

    const list = await app.inject({
      method: "GET",
      url: "/api/lan/files?keyword=note&category=text&extension=txt"
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.files).toHaveLength(1);

    const preview = await app.inject({
      method: "GET",
      url: `/api/lan/files/${uploaded.id}/preview`
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.headers["content-disposition"]).toContain("inline");
    expect(preview.body).toBe("hello lan");

    const download = await app.inject({
      method: "GET",
      url: `/api/lan/files/${uploaded.id}/download`
    });
    expect(download.statusCode).toBe(200);
    expect(download.headers["content-disposition"]).toContain("note.txt");
    expect(download.body).toBe("hello lan");

    const afterDownload = await app.inject({ method: "GET", url: "/api/lan/files" });
    expect(afterDownload.json().data.files[0].downloadCount).toBe(1);
  });

  it("paginates LAN file lists", async () => {
    const app = await createApp();
    for (const name of ["one.txt", "two.txt", "three.txt", "four.txt", "five.txt"]) {
      const upload = await app.inject({
        method: "POST",
        url: "/api/lan/files",
        ...multipartPayload("file", name, "text/plain", name)
      });
      expect(upload.statusCode).toBe(200);
    }

    const list = await app.inject({
      method: "GET",
      url: "/api/lan/files?page=2&pageSize=2"
    });

    expect(list.statusCode).toBe(200);
    expect(list.json().data.files).toHaveLength(2);
    expect(list.json().data.pagination).toEqual({
      page: 2,
      pageSize: 2,
      total: 5,
      pageCount: 3
    });
  });

  it("supports range preview requests for previewable binary files", async () => {
    const app = await createApp();
    const upload = await app.inject({
      method: "POST",
      url: "/api/lan/files",
      ...multipartPayload("file", "video.mp4", "video/mp4", "0123456789")
    });
    const id = upload.json().data.file.id;

    const preview = await app.inject({
      method: "GET",
      url: `/api/lan/files/${id}/preview`,
      headers: {
        range: "bytes=2-5"
      }
    });

    expect(preview.statusCode).toBe(206);
    expect(preview.headers["content-range"]).toBe("bytes 2-5/10");
    expect(preview.body).toBe("2345");
  });

  it("returns 415 for unsupported preview categories and supports delete", async () => {
    const app = await createApp();
    const upload = await app.inject({
      method: "POST",
      url: "/api/lan/files",
      ...multipartPayload("file", "bundle.zip", "application/zip", "zip-content")
    });
    const id = upload.json().data.file.id;

    const preview = await app.inject({
      method: "GET",
      url: `/api/lan/files/${id}/preview`
    });
    expect(preview.statusCode).toBe(415);

    const remove = await app.inject({
      method: "DELETE",
      url: `/api/lan/files/${id}`
    });
    expect(remove.statusCode).toBe(200);

    const list = await app.inject({ method: "GET", url: "/api/lan/files" });
    expect(list.json().data.files).toHaveLength(0);
  });

  it("serializes concurrent file deletes without corrupting the LAN index", async () => {
    const app = await createApp();
    const ids: string[] = [];
    for (const name of ["one.txt", "two.txt", "three.txt"]) {
      const upload = await app.inject({
        method: "POST",
        url: "/api/tools/lan-transfer/files",
        ...multipartPayload("file", name, "text/plain", name)
      });
      ids.push(upload.json().data.file.id);
    }

    const deletes = await Promise.all(
      ids.slice(0, 2).map((id) =>
        app.inject({
          method: "DELETE",
          url: `/api/tools/lan-transfer/files/${id}`
        })
      )
    );

    expect(deletes.map((response) => response.statusCode)).toEqual([200, 200]);
    const rawIndex = await fs.readFile(path.join(storageRoot, "lan-transfer", "index.json"), "utf8");
    expect(() => JSON.parse(rawIndex)).not.toThrow();

    const list = await app.inject({ method: "GET", url: "/api/tools/lan-transfer/files" });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.files).toHaveLength(1);
  });

  it("recovers a LAN index with trailing duplicate JSON after a failed concurrent write", async () => {
    const app = await createApp();
    const upload = await app.inject({
      method: "POST",
      url: "/api/tools/lan-transfer/files",
      ...multipartPayload("file", "recover.txt", "text/plain", "recover")
    });
    const file = upload.json().data.file;
    const indexPath = path.join(storageRoot, "lan-transfer", "index.json");
    const validIndex = await fs.readFile(indexPath, "utf8");
    await fs.writeFile(indexPath, `${validIndex}  }\n]`, "utf8");

    const list = await app.inject({ method: "GET", url: "/api/tools/lan-transfer/files" });

    expect(list.statusCode).toBe(200);
    expect(list.json().data.files).toHaveLength(1);
    expect(list.json().data.files[0].id).toBe(file.id);
    const recoveredIndex = await fs.readFile(indexPath, "utf8");
    expect(() => JSON.parse(recoveredIndex)).not.toThrow();
  });

  it("cleans expired files from metadata and disk", async () => {
    const app = await createApp();
    const upload = await app.inject({
      method: "POST",
      url: "/api/lan/files",
      ...multipartPayload("file", "old.txt", "text/plain", "old")
    });
    const file = upload.json().data.file;
    const indexPath = path.join(storageRoot, "lan-transfer", "index.json");
    const records = JSON.parse(await fs.readFile(indexPath, "utf8"));
    records[0].expiresAt = new Date(Date.now() - 1000).toISOString();
    await fs.writeFile(indexPath, JSON.stringify(records, null, 2));

    const cleanup = await app.inject({
      method: "POST",
      url: "/api/lan/cleanup"
    });

    expect(cleanup.statusCode).toBe(200);
    expect(cleanup.json().data.removed).toBe(1);
    await expect(fs.access(path.join(storageRoot, "lan-transfer", "files", file.storedName))).rejects.toThrow();
  });

  it("returns a clear error when the uploaded file exceeds the configured limit", async () => {
    process.env.LAN_TRANSFER_MAX_FILE_BYTES = "4";
    const app = await createApp();
    const upload = await app.inject({
      method: "POST",
      url: "/api/lan/files",
      ...multipartPayload("file", "too-large.txt", "text/plain", "12345")
    });

    expect(upload.statusCode).toBe(413);
    expect(upload.json()).toMatchObject({
      success: false,
      error: {
        code: "FILE_TOO_LARGE"
      }
    });
  });

  it("uploads chunks out of order, reports resume status, and completes the final file", async () => {
    const app = await createApp();
    const session = await app.inject({
      method: "POST",
      url: "/api/lan/uploads",
      headers: {
        "content-type": "application/json"
      },
      payload: {
        originalName: "chunked.txt",
        mimeType: "text/plain",
        size: 10,
        chunkSize: 4,
        totalChunks: 3
      }
    });

    expect(session.statusCode).toBe(200);
    const uploadId = session.json().data.uploadId;

    const chunkOne = await app.inject({
      method: "PUT",
      url: `/api/lan/uploads/${uploadId}/chunks/1`,
      ...multipartPayload("chunk", "chunk-1", "application/octet-stream", "efgh")
    });
    expect(chunkOne.statusCode).toBe(200);

    const chunkZero = await app.inject({
      method: "PUT",
      url: `/api/lan/uploads/${uploadId}/chunks/0`,
      ...multipartPayload("chunk", "chunk-0", "application/octet-stream", "abcd")
    });
    expect(chunkZero.statusCode).toBe(200);

    const status = await app.inject({
      method: "GET",
      url: `/api/lan/uploads/${uploadId}`
    });
    expect(status.statusCode).toBe(200);
    expect(status.json().data.uploadedChunks).toEqual([0, 1]);

    const incomplete = await app.inject({
      method: "POST",
      url: `/api/lan/uploads/${uploadId}/complete`
    });
    expect(incomplete.statusCode).toBe(409);
    expect(incomplete.json()).toMatchObject({
      success: false,
      error: {
        code: "UPLOAD_INCOMPLETE",
        details: {
          missingChunks: [2]
        }
      }
    });

    const chunkTwo = await app.inject({
      method: "PUT",
      url: `/api/lan/uploads/${uploadId}/chunks/2`,
      ...multipartPayload("chunk", "chunk-2", "application/octet-stream", "ij")
    });
    expect(chunkTwo.statusCode).toBe(200);

    const complete = await app.inject({
      method: "POST",
      url: `/api/lan/uploads/${uploadId}/complete`
    });
    expect(complete.statusCode).toBe(200);
    const completedFile = complete.json().data.file;
    expect(completedFile).toMatchObject({
      originalName: "chunked.txt",
      size: 10,
      category: "text",
      previewable: true
    });

    const preview = await app.inject({
      method: "GET",
      url: `/api/lan/files/${completedFile.id}/preview`
    });
    expect(preview.body).toBe("abcdefghij");
  });

  it("records concurrently uploaded chunks without losing resume state", async () => {
    const app = await createApp();
    const content = Array.from({ length: 12 }, (_, index) => String(index).padStart(2, "0")).join("");
    const session = await app.inject({
      method: "POST",
      url: "/api/lan/uploads",
      headers: {
        "content-type": "application/json"
      },
      payload: {
        originalName: "parallel.txt",
        mimeType: "text/plain",
        size: content.length,
        chunkSize: 2,
        totalChunks: 12
      }
    });
    const uploadId = session.json().data.uploadId;

    const uploads = await Promise.all(
      Array.from({ length: 12 }, async (_, index) =>
        app.inject({
          method: "PUT",
          url: `/api/lan/uploads/${uploadId}/chunks/${index}`,
          ...multipartPayload(
            "chunk",
            `chunk-${index}`,
            "application/octet-stream",
            content.slice(index * 2, index * 2 + 2)
          )
        })
      )
    );

    expect(uploads.map((response) => response.statusCode)).toEqual(Array(12).fill(200));

    const status = await app.inject({
      method: "GET",
      url: `/api/lan/uploads/${uploadId}`
    });
    expect(status.json().data.uploadedChunks).toEqual(Array.from({ length: 12 }, (_, index) => index));

    const complete = await app.inject({
      method: "POST",
      url: `/api/lan/uploads/${uploadId}/complete`
    });
    expect(complete.statusCode).toBe(200);

    const preview = await app.inject({
      method: "GET",
      url: `/api/lan/files/${complete.json().data.file.id}/preview`
    });
    expect(preview.body).toBe(content);
    await expect(fs.access(path.join(storageRoot, "lan-transfer", "uploads", uploadId))).rejects.toThrow();
  });

  it("returns 507 before merging when disk space cannot hold the next chunk append", async () => {
    const app = await createApp();
    const session = await app.inject({
      method: "POST",
      url: "/api/lan/uploads",
      headers: {
        "content-type": "application/json"
      },
      payload: {
        originalName: "low-space.txt",
        mimeType: "text/plain",
        size: 8,
        chunkSize: 4,
        totalChunks: 2
      }
    });
    const uploadId = session.json().data.uploadId;

    for (const [index, content] of ["abcd", "efgh"].entries()) {
      const chunk = await app.inject({
        method: "PUT",
        url: `/api/lan/uploads/${uploadId}/chunks/${index}`,
        ...multipartPayload("chunk", `chunk-${index}`, "application/octet-stream", content)
      });
      expect(chunk.statusCode).toBe(200);
    }

    const statfsSpy = vi.spyOn(fs, "statfs").mockResolvedValue({
      bavail: 1,
      bfree: 1,
      blocks: 1,
      bsize: 1,
      files: 1,
      ffree: 1,
      type: 0
    } as Awaited<ReturnType<typeof fs.statfs>>);

    try {
      const complete = await app.inject({
        method: "POST",
        url: `/api/lan/uploads/${uploadId}/complete`
      });

      expect(complete.statusCode).toBe(507);
      expect(complete.json()).toMatchObject({
        success: false,
        error: {
          code: "INSUFFICIENT_STORAGE"
        }
      });
    } finally {
      statfsSpy.mockRestore();
    }
  });

  it("cancels a chunk upload session and removes its resume state", async () => {
    const app = await createApp();
    const session = await app.inject({
      method: "POST",
      url: "/api/lan/uploads",
      headers: {
        "content-type": "application/json"
      },
      payload: {
        originalName: "cancel.txt",
        mimeType: "text/plain",
        size: 4,
        chunkSize: 2,
        totalChunks: 2
      }
    });
    const uploadId = session.json().data.uploadId;

    const chunk = await app.inject({
      method: "PUT",
      url: `/api/lan/uploads/${uploadId}/chunks/0`,
      ...multipartPayload("chunk", "chunk-0", "application/octet-stream", "ca")
    });
    expect(chunk.statusCode).toBe(200);

    const cancel = await app.inject({
      method: "DELETE",
      url: `/api/lan/uploads/${uploadId}`
    });
    expect(cancel.statusCode).toBe(200);

    const status = await app.inject({
      method: "GET",
      url: `/api/lan/uploads/${uploadId}`
    });
    expect(status.statusCode).toBe(404);
  });
});

function multipartPayload(fieldName: string, fileName: string, mimeType: string, content: string) {
  const boundary = `----toolbox-${Math.random().toString(16).slice(2)}`;
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\n` +
        `Content-Type: ${mimeType}\r\n\r\n`
    ),
    Buffer.from(content),
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);

  return {
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`,
      "content-length": String(body.length)
    },
    payload: body
  };
}
