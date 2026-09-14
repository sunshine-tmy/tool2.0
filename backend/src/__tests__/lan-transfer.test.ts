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
  process.env.LAN_TRANSFER_RETENTION_DAYS = "3";
  process.env.LAN_TRANSFER_MAX_STORAGE_BYTES = String(100 * 1024 * 1024 * 1024);
  process.env.LAN_PUBLIC_BASE_URL = "http://192.168.1.241:3100";
});

afterEach(async () => {
  delete process.env.STORAGE_ROOT;
  delete process.env.LAN_TRANSFER_MAX_FILE_BYTES;
  delete process.env.LAN_TRANSFER_RETENTION_DAYS;
  delete process.env.LAN_TRANSFER_MAX_STORAGE_BYTES;
  delete process.env.LAN_TRANSFER_PIN;
  delete process.env.LAN_TRANSFER_GUEST_MODE;
  delete process.env.LAN_TRANSFER_UPLOAD_RETENTION_HOURS;
  delete process.env.LAN_PUBLIC_BASE_URL;
  delete process.env.DEPLOYMENT_MODE;
  delete process.env.ADMIN_PIN;
  delete process.env.CORS_ORIGINS;
  await fs.rm(storageRoot, { recursive: true, force: true });
});

describe("lan transfer api", () => {
  it("reports usable LAN sharing information", async () => {
    const app = await createApp();
    const response = await app.inject({ method: "GET", url: "/api/v1/tools/lan-transfer/info" });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({
      retentionDays: 3,
      pinRequired: false,
      authenticated: true
    });
    expect(response.json().data.lanUrls.every((url: string) => url.endsWith("/tools/lan-transfer"))).toBe(true);
  });

  it("supports the canonical tools namespace for LAN file APIs", async () => {
    const app = await createApp();
    const upload = await app.inject({
      method: "POST",
      url: "/api/v1/tools/lan-transfer/files",
      ...multipartPayload("file", "route.txt", "text/plain", "new namespace")
    });

    expect(upload.statusCode).toBe(200);
    const id = upload.json().data.file.id;

    const list = await app.inject({
      method: "GET",
      url: "/api/v1/tools/lan-transfer/files"
    });
    expect(list.json().data.files).toHaveLength(1);

    const preview = await app.inject({
      method: "GET",
      url: `/api/v1/tools/lan-transfer/files/${id}/preview`
    });
    expect(preview.body).toBe("new namespace");
  });

  it("allows guest transfers but requires an administrator session for LAN management in LAN mode", async () => {
    process.env.DEPLOYMENT_MODE = "lan";
    process.env.ADMIN_PIN = "123456";
    process.env.CORS_ORIGINS = "http://192.168.1.10:5173";
    const app = await createApp();

    try {
      const upload = await app.inject({
        method: "POST",
        url: "/api/v1/tools/lan-transfer/files",
        ...multipartPayload("file", "guest.txt", "text/plain", "guest transfer")
      });
      expect(upload.statusCode).toBe(200);
      const fileId = upload.json().data.file.id;

      const download = await app.inject({
        method: "GET",
        url: `/api/v1/tools/lan-transfer/files/${fileId}/download`
      });
      expect(download.statusCode).toBe(200);
      expect(download.body).toBe("guest transfer");

      const note = await app.inject({
        method: "POST",
        url: "/api/v1/tools/lan-transfer/notes",
        ...noteMultipartPayload({ content: "guest note" }, [])
      });
      expect(note.statusCode).toBe(200);
      const noteId = note.json().data.id;

      const uploadSession = await app.inject({
        method: "POST",
        url: "/api/v1/tools/lan-transfer/uploads",
        payload: {
          originalName: "chunked.txt",
          mimeType: "text/plain",
          size: 4,
          chunkSize: 4,
          totalChunks: 1
        }
      });
      expect(uploadSession.statusCode).toBe(200);
      const uploadId = uploadSession.json().data.uploadId;
      const cancelled = await app.inject({
        method: "DELETE",
        url: `/api/v1/tools/lan-transfer/uploads/${uploadId}`
      });
      expect(cancelled.statusCode).toBe(200);

      const deniedManagementRequests = await Promise.all([
        app.inject({ method: "DELETE", url: `/api/v1/tools/lan-transfer/files/${fileId}` }),
        app.inject({
          method: "PATCH",
          url: `/api/v1/tools/lan-transfer/files/${fileId}/expiry`,
          payload: { days: 30 }
        }),
        app.inject({
          method: "POST",
          url: "/api/v1/tools/lan-transfer/files/batch-delete",
          payload: { ids: [fileId] }
        }),
        app.inject({ method: "POST", url: "/api/v1/tools/lan-transfer/cleanup" }),
        app.inject({ method: "DELETE", url: `/api/v1/tools/lan-transfer/notes/${noteId}` }),
        app.inject({
          method: "PATCH",
          url: `/api/v1/tools/lan-transfer/notes/${noteId}/expiry`,
          payload: { days: 30 }
        }),
        app.inject({
          method: "POST",
          url: "/api/v1/tools/lan-transfer/notes/batch-delete",
          payload: { ids: [noteId] }
        })
      ]);
      for (const response of deniedManagementRequests) {
        expect(response.statusCode).toBe(401);
        expect(response.json().error.code).toBe("ADMIN_SESSION_REQUIRED");
      }

      const login = await app.inject({
        method: "POST",
        url: "/api/v1/session",
        payload: { pin: "123456" }
      });
      const setCookie = login.headers["set-cookie"]!;
      const cookie = (Array.isArray(setCookie) ? setCookie[0] : setCookie).split(";", 1)[0];
      const adminHeaders = {
        cookie,
        origin: "http://192.168.1.10:5173",
        "x-csrf-token": login.json().data.csrfToken
      };

      const [deletedFile, deletedNote] = await Promise.all([
        app.inject({
          method: "DELETE",
          url: `/api/v1/tools/lan-transfer/files/${fileId}`,
          headers: adminHeaders
        }),
        app.inject({
          method: "DELETE",
          url: `/api/v1/tools/lan-transfer/notes/${noteId}`,
          headers: adminHeaders
        })
      ]);
      expect(deletedFile.statusCode).toBe(200);
      expect(deletedNote.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });

  it("uploads a file, stores metadata, lists it, previews it, and downloads it", async () => {
    const app = await createApp();
    const upload = await app.inject({
      method: "POST",
      url: "/api/v1/tools/lan-transfer/files",
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
    expect(upload.json().data.previewUrl).toBe(`/api/v1/tools/lan-transfer/files/${uploaded.id}/preview`);
    expect(upload.json().data.downloadUrl).toBe(`/api/v1/tools/lan-transfer/files/${uploaded.id}/download`);

    const list = await app.inject({
      method: "GET",
      url: "/api/v1/tools/lan-transfer/files?keyword=note&category=text&extension=txt"
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.files).toHaveLength(1);

    const preview = await app.inject({
      method: "GET",
      url: `/api/v1/tools/lan-transfer/files/${uploaded.id}/preview`
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.headers["content-disposition"]).toContain("inline");
    expect(preview.body).toBe("hello lan");

    const download = await app.inject({
      method: "GET",
      url: `/api/v1/tools/lan-transfer/files/${uploaded.id}/download`
    });
    expect(download.statusCode).toBe(200);
    expect(download.headers["content-disposition"]).toContain("note.txt");
    expect(download.body).toBe("hello lan");

    const afterDownload = await app.inject({ method: "GET", url: "/api/v1/tools/lan-transfer/files" });
    expect(afterDownload.json().data.files[0].downloadCount).toBe(1);
  });

  it("publishes, lists, previews, extends and deletes LAN text-image notes", async () => {
    const app = await createApp();
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from("test-image")
    ]);
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/tools/lan-transfer/notes",
      ...noteMultipartPayload({ title: "设备验证码", content: "验证码 246810\nhttps://example.com/order/1" }, [
        { fieldName: "images", fileName: "proof.png", mimeType: "image/png", content: png }
      ])
    });

    expect(created.statusCode).toBe(200);
    const note = created.json().data;
    expect(note).toMatchObject({
      title: "设备验证码",
      content: "验证码 246810\nhttps://example.com/order/1",
      images: [
        expect.objectContaining({
          originalName: "proof.png",
          mimeType: "image/png",
          previewUrl: expect.stringContaining("/preview"),
          downloadUrl: expect.stringContaining("/download")
        })
      ]
    });
    expect(Date.parse(note.expiresAt)).toBeGreaterThan(Date.now() + 2 * 24 * 60 * 60 * 1000);

    const list = await app.inject({ method: "GET", url: "/api/v1/tools/lan-transfer/notes" });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.notes).toHaveLength(1);
    expect(list.json().data.pagination.total).toBe(1);

    const preview = await app.inject({ method: "GET", url: note.images[0].previewUrl });
    expect(preview.statusCode).toBe(200);
    expect(preview.headers["content-type"]).toContain("image/png");
    expect(preview.rawPayload.subarray(0, 8)).toEqual(png.subarray(0, 8));

    const info = await app.inject({ method: "GET", url: "/api/v1/tools/lan-transfer/info" });
    expect(info.json().data.noteCount).toBe(1);
    expect(info.json().data.usedBytes).toBe(png.length);

    const expiry = await app.inject({
      method: "PATCH",
      url: `/api/v1/tools/lan-transfer/notes/${note.id}/expiry`,
      payload: { days: 30 }
    });
    expect(expiry.statusCode).toBe(200);
    expect(Date.parse(expiry.json().data.expiresAt)).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000);

    const removed = await app.inject({
      method: "DELETE",
      url: `/api/v1/tools/lan-transfer/notes/${note.id}`
    });
    expect(removed.statusCode).toBe(200);
    const empty = await app.inject({ method: "GET", url: "/api/v1/tools/lan-transfer/notes" });
    expect(empty.json().data.notes).toHaveLength(0);
  });

  it("batch deletes selected LAN notes and their stored images", async () => {
    const app = await createApp();
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from("batch-note-image")
    ]);
    const createdNotes = await Promise.all(
      ["第一条", "第二条"].map(async (title, index) => {
        const response = await app.inject({
          method: "POST",
          url: "/api/v1/tools/lan-transfer/notes",
          ...noteMultipartPayload({ title, content: `批量内容 ${index + 1}` }, [
            {
              fieldName: "images",
              fileName: `batch-${index + 1}.png`,
              mimeType: "image/png",
              content: png
            }
          ])
        });
        expect(response.statusCode).toBe(200);
        return response.json().data;
      })
    );
    const removed = await app.inject({
      method: "POST",
      url: "/api/v1/tools/lan-transfer/notes/batch-delete",
      payload: { ids: [createdNotes[0].id, createdNotes[1].id, "missing-note"] }
    });

    expect(removed.statusCode).toBe(200);
    expect(removed.json().data.missing).toEqual(["missing-note"]);
    expect(removed.json().data.removed).toHaveLength(2);
    expect(removed.json().data.removed).toEqual(expect.arrayContaining(createdNotes.map((note) => note.id)));
    const list = await app.inject({ method: "GET", url: "/api/v1/tools/lan-transfer/notes" });
    expect(list.json().data.notes).toHaveLength(0);
    expect(await fs.readdir(path.join(storageRoot, "lan-transfer", "notes", "images"))).toHaveLength(0);
  });

  it("accepts text-only notes and rejects spoofed image content", async () => {
    const app = await createApp();
    const textOnly = await app.inject({
      method: "POST",
      url: "/api/v1/tools/lan-transfer/notes",
      ...noteMultipartPayload({ content: "从手机复制到电脑的一段文字" }, [])
    });
    expect(textOnly.statusCode).toBe(200);
    expect(textOnly.json().data).toMatchObject({ content: "从手机复制到电脑的一段文字", images: [] });

    const spoofed = await app.inject({
      method: "POST",
      url: "/api/v1/tools/lan-transfer/notes",
      ...noteMultipartPayload({ content: "伪造图片" }, [
        { fieldName: "images", fileName: "fake.png", mimeType: "image/png", content: Buffer.from("<html>") }
      ])
    });
    expect(spoofed.statusCode).toBe(415);
    expect(spoofed.json().error.code).toBe("LAN_NOTE_IMAGE_INVALID");
  });

  it("paginates LAN file lists", async () => {
    const app = await createApp();
    for (const name of ["one.txt", "two.txt", "three.txt", "four.txt", "five.txt"]) {
      const upload = await app.inject({
        method: "POST",
        url: "/api/v1/tools/lan-transfer/files",
        ...multipartPayload("file", name, "text/plain", name)
      });
      expect(upload.statusCode).toBe(200);
    }

    const list = await app.inject({
      method: "GET",
      url: "/api/v1/tools/lan-transfer/files?page=2&pageSize=2"
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
      url: "/api/v1/tools/lan-transfer/files",
      ...multipartPayload("file", "video.mp4", "video/mp4", "0123456789")
    });
    const id = upload.json().data.file.id;

    const preview = await app.inject({
      method: "GET",
      url: `/api/v1/tools/lan-transfer/files/${id}/preview`,
      headers: {
        range: "bytes=2-5"
      }
    });

    expect(preview.statusCode).toBe(206);
    expect(preview.headers["content-range"]).toBe("bytes 2-5/10");
    expect(preview.body).toBe("2345");
  });

  it("supports suffix byte ranges", async () => {
    const app = await createApp();
    const upload = await app.inject({
      method: "POST",
      url: "/api/v1/tools/lan-transfer/files",
      ...multipartPayload("file", "suffix.txt", "text/plain", "hello lan")
    });
    const id = upload.json().data.file.id;

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/tools/lan-transfer/files/${id}/preview`,
      headers: { range: "bytes=-3" }
    });

    expect(response.statusCode).toBe(206);
    expect(response.headers["content-range"]).toBe("bytes 6-8/9");
    expect(response.body).toBe("lan");
  });

  it("uses a PIN to unlock management while preserving upload-only guest access", async () => {
    process.env.LAN_TRANSFER_PIN = "2468";
    process.env.LAN_TRANSFER_GUEST_MODE = "upload-only";
    const app = await createApp();

    const upload = await app.inject({
      method: "POST",
      url: "/api/v1/tools/lan-transfer/files",
      ...multipartPayload("file", "guest.txt", "text/plain", "guest upload")
    });
    expect(upload.statusCode).toBe(200);
    const id = upload.json().data.file.id;

    const deniedList = await app.inject({ method: "GET", url: "/api/v1/tools/lan-transfer/files" });
    expect(deniedList.statusCode).toBe(401);

    const login = await app.inject({
      method: "POST",
      url: "/api/v1/tools/lan-transfer/access",
      payload: { pin: "2468" }
    });
    expect(login.statusCode).toBe(200);
    const cookie = String(login.headers["set-cookie"]).split(";")[0];

    const removed = await app.inject({
      method: "DELETE",
      url: `/api/v1/tools/lan-transfer/files/${id}`,
      headers: { cookie }
    });
    expect(removed.statusCode).toBe(200);
  });

  it("rejects malformed list, entity, expiry, upload and chunk parameters at the schema boundary", async () => {
    const app = await createApp();
    const responses = await Promise.all([
      app.inject({ method: "GET", url: "/api/v1/tools/lan-transfer/files?page=0" }),
      app.inject({ method: "GET", url: "/api/v1/tools/lan-transfer/files/bad!/download" }),
      app.inject({
        method: "PATCH",
        url: "/api/v1/tools/lan-transfer/files/abcdef/expiry",
        payload: { days: 0 }
      }),
      app.inject({
        method: "POST",
        url: "/api/v1/tools/lan-transfer/uploads",
        payload: { originalName: "file.txt", size: -1, chunkSize: 1, totalChunks: 0 }
      }),
      app.inject({ method: "PUT", url: "/api/v1/tools/lan-transfer/uploads/abcdef/chunks/-1" })
    ]);

    for (const response of responses) {
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        success: false,
        error: { code: "REQUEST_INVALID" },
        requestId: expect.any(String)
      });
    }
    await app.close();
  });

  it("rate limits repeated LAN PIN attempts independently", async () => {
    process.env.LAN_TRANSFER_PIN = "2468";
    const app = await createApp();
    let response;
    for (let requestNumber = 0; requestNumber < 6; requestNumber += 1) {
      response = await app.inject({
        method: "POST",
        url: "/api/v1/tools/lan-transfer/access",
        payload: { pin: "wrong" }
      });
    }

    expect(response?.statusCode).toBe(429);
    expect(response?.json().error.code).toBe("REQUEST_INVALID");
    await app.close();
  });

  it("enforces the configured storage quota", async () => {
    process.env.LAN_TRANSFER_MAX_STORAGE_BYTES = "4";
    const app = await createApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/tools/lan-transfer/files",
      ...multipartPayload("file", "too-large.txt", "text/plain", "12345")
    });
    expect(response.statusCode).toBe(507);
    expect(response.json().error.code).toBe("LAN_STORAGE_QUOTA_EXCEEDED");
  });

  it("extends retention and supports batch ZIP download and deletion", async () => {
    const app = await createApp();
    const ids: string[] = [];
    for (const [name, content] of [
      ["one.txt", "one"],
      ["two.txt", "two"]
    ]) {
      const upload = await app.inject({
        method: "POST",
        url: "/api/v1/tools/lan-transfer/files",
        ...multipartPayload("file", name, "text/plain", content)
      });
      ids.push(upload.json().data.file.id);
    }

    const expiry = await app.inject({
      method: "PATCH",
      url: `/api/v1/tools/lan-transfer/files/${ids[0]}/expiry`,
      payload: { days: 30 }
    });
    expect(expiry.statusCode).toBe(200);
    expect(Date.parse(expiry.json().data.expiresAt)).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000);

    const archive = await app.inject({
      method: "POST",
      url: "/api/v1/tools/lan-transfer/files/batch-download",
      payload: { ids }
    });
    expect(archive.statusCode).toBe(200);
    expect(archive.headers["content-type"]).toContain("application/zip");
    expect(archive.rawPayload.subarray(0, 2).toString()).toBe("PK");

    const removed = await app.inject({
      method: "POST",
      url: "/api/v1/tools/lan-transfer/files/batch-delete",
      payload: { ids }
    });
    expect(removed.json().data.removed).toEqual(expect.arrayContaining(ids));
    const list = await app.inject({ method: "GET", url: "/api/v1/tools/lan-transfer/files" });
    expect(list.json().data.files).toHaveLength(0);
  });

  it("returns 415 for unsupported preview categories and supports delete", async () => {
    const app = await createApp();
    const upload = await app.inject({
      method: "POST",
      url: "/api/v1/tools/lan-transfer/files",
      ...multipartPayload("file", "bundle.zip", "application/zip", "zip-content")
    });
    const id = upload.json().data.file.id;

    const preview = await app.inject({
      method: "GET",
      url: `/api/v1/tools/lan-transfer/files/${id}/preview`
    });
    expect(preview.statusCode).toBe(415);

    const remove = await app.inject({
      method: "DELETE",
      url: `/api/v1/tools/lan-transfer/files/${id}`
    });
    expect(remove.statusCode).toBe(200);

    const list = await app.inject({ method: "GET", url: "/api/v1/tools/lan-transfer/files" });
    expect(list.json().data.files).toHaveLength(0);
  });

  it("serializes concurrent file deletes without corrupting the LAN index", async () => {
    const app = await createApp();
    const ids: string[] = [];
    for (const name of ["one.txt", "two.txt", "three.txt"]) {
      const upload = await app.inject({
        method: "POST",
        url: "/api/v1/tools/lan-transfer/files",
        ...multipartPayload("file", name, "text/plain", name)
      });
      ids.push(upload.json().data.file.id);
    }

    const deletes = await Promise.all(
      ids.slice(0, 2).map((id) =>
        app.inject({
          method: "DELETE",
          url: `/api/v1/tools/lan-transfer/files/${id}`
        })
      )
    );

    expect(deletes.map((response) => response.statusCode)).toEqual([200, 200]);
    const rawIndex = await fs.readFile(path.join(storageRoot, "lan-transfer", "index.json"), "utf8");
    expect(() => JSON.parse(rawIndex)).not.toThrow();

    const list = await app.inject({ method: "GET", url: "/api/v1/tools/lan-transfer/files" });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.files).toHaveLength(1);
  });

  it("continues from SQLite when the read-only legacy index is corrupted", async () => {
    const app = await createApp();
    const upload = await app.inject({
      method: "POST",
      url: "/api/v1/tools/lan-transfer/files",
      ...multipartPayload("file", "recover.txt", "text/plain", "recover")
    });
    const file = upload.json().data.file;
    const indexPath = path.join(storageRoot, "lan-transfer", "index.json");
    const validIndex = await fs.readFile(indexPath, "utf8");
    await fs.writeFile(indexPath, `${validIndex}  }\n]`, "utf8");

    const list = await app.inject({ method: "GET", url: "/api/v1/tools/lan-transfer/files" });

    expect(list.statusCode).toBe(200);
    expect(list.json().data.files).toHaveLength(1);
    expect(list.json().data.files[0].id).toBe(file.id);
    expect(await fs.readFile(indexPath, "utf8")).toContain("}\n]");
  });

  it("cleans expired files from metadata and disk", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const app = await createApp();
    const upload = await app.inject({
      method: "POST",
      url: "/api/v1/tools/lan-transfer/files",
      ...multipartPayload("file", "old.txt", "text/plain", "old")
    });
    const file = upload.json().data.file;
    vi.setSystemTime(new Date("2026-01-05T00:00:00.000Z"));

    const cleanup = await app.inject({
      method: "POST",
      url: "/api/v1/tools/lan-transfer/cleanup"
    });

    expect(cleanup.statusCode).toBe(200);
    expect(cleanup.json().data.removed).toBe(1);
    await expect(fs.access(path.join(storageRoot, "lan-transfer", "files", file.storedName))).rejects.toThrow();
    vi.useRealTimers();
  });

  it("cleans expired text-image notes and their stored images", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const app = await createApp();
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("expired")]);
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/tools/lan-transfer/notes",
      ...noteMultipartPayload({ content: "过期图文" }, [
        { fieldName: "images", fileName: "expired.png", mimeType: "image/png", content: png }
      ])
    });
    const image = created.json().data.images[0];
    vi.setSystemTime(new Date("2026-01-05T00:00:00.000Z"));

    const cleanup = await app.inject({ method: "POST", url: "/api/v1/tools/lan-transfer/cleanup" });

    expect(cleanup.statusCode).toBe(200);
    expect(cleanup.json().data).toMatchObject({ removed: 1, filesRemoved: 0, notesRemoved: 1 });
    await expect(
      fs.access(path.join(storageRoot, "lan-transfer", "notes", "images", image.storedName))
    ).rejects.toThrow();
    vi.useRealTimers();
  });

  it("returns a clear error when the uploaded file exceeds the configured limit", async () => {
    process.env.LAN_TRANSFER_MAX_FILE_BYTES = "4";
    const app = await createApp();
    const upload = await app.inject({
      method: "POST",
      url: "/api/v1/tools/lan-transfer/files",
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
      url: "/api/v1/tools/lan-transfer/uploads",
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
      url: `/api/v1/tools/lan-transfer/uploads/${uploadId}/chunks/1`,
      ...multipartPayload("chunk", "chunk-1", "application/octet-stream", "efgh")
    });
    expect(chunkOne.statusCode).toBe(200);

    const chunkZero = await app.inject({
      method: "PUT",
      url: `/api/v1/tools/lan-transfer/uploads/${uploadId}/chunks/0`,
      ...multipartPayload("chunk", "chunk-0", "application/octet-stream", "abcd")
    });
    expect(chunkZero.statusCode).toBe(200);

    const status = await app.inject({
      method: "GET",
      url: `/api/v1/tools/lan-transfer/uploads/${uploadId}`
    });
    expect(status.statusCode).toBe(200);
    expect(status.json().data.uploadedChunks).toEqual([0, 1]);

    const incomplete = await app.inject({
      method: "POST",
      url: `/api/v1/tools/lan-transfer/uploads/${uploadId}/complete`
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
      url: `/api/v1/tools/lan-transfer/uploads/${uploadId}/chunks/2`,
      ...multipartPayload("chunk", "chunk-2", "application/octet-stream", "ij")
    });
    expect(chunkTwo.statusCode).toBe(200);

    const complete = await app.inject({
      method: "POST",
      url: `/api/v1/tools/lan-transfer/uploads/${uploadId}/complete`
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
      url: `/api/v1/tools/lan-transfer/files/${completedFile.id}/preview`
    });
    expect(preview.body).toBe("abcdefghij");
  });

  it("uploads and downloads an empty text file", async () => {
    const app = await createApp();
    const session = await app.inject({
      method: "POST",
      url: "/api/v1/tools/lan-transfer/uploads",
      headers: {
        "content-type": "application/json"
      },
      payload: {
        originalName: "empty.txt",
        mimeType: "text/plain",
        size: 0,
        chunkSize: 4,
        totalChunks: 0
      }
    });

    expect(session.statusCode).toBe(200);
    expect(session.json().data).toMatchObject({ size: 0, totalChunks: 0, uploadedChunks: [] });

    const complete = await app.inject({
      method: "POST",
      url: `/api/v1/tools/lan-transfer/uploads/${session.json().data.uploadId}/complete`
    });

    expect(complete.statusCode).toBe(200);
    const file = complete.json().data.file;
    expect(file).toMatchObject({ originalName: "empty.txt", size: 0, category: "text", previewable: true });

    const download = await app.inject({ method: "GET", url: `/api/v1/tools/lan-transfer/files/${file.id}/download` });
    expect(download.statusCode).toBe(200);
    expect(download.body).toBe("");
  });

  it("records concurrently uploaded chunks without losing resume state", async () => {
    const app = await createApp();
    const content = Array.from({ length: 12 }, (_, index) => String(index).padStart(2, "0")).join("");
    const session = await app.inject({
      method: "POST",
      url: "/api/v1/tools/lan-transfer/uploads",
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
          url: `/api/v1/tools/lan-transfer/uploads/${uploadId}/chunks/${index}`,
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
      url: `/api/v1/tools/lan-transfer/uploads/${uploadId}`
    });
    expect(status.json().data.uploadedChunks).toEqual(Array.from({ length: 12 }, (_, index) => index));

    const complete = await app.inject({
      method: "POST",
      url: `/api/v1/tools/lan-transfer/uploads/${uploadId}/complete`
    });
    expect(complete.statusCode).toBe(200);

    const preview = await app.inject({
      method: "GET",
      url: `/api/v1/tools/lan-transfer/files/${complete.json().data.file.id}/preview`
    });
    expect(preview.body).toBe(content);
    await expect(fs.access(path.join(storageRoot, "lan-transfer", "uploads", uploadId))).rejects.toThrow();
  });

  it("returns 507 before merging when disk space cannot hold the complete merged file", async () => {
    const app = await createApp();
    const session = await app.inject({
      method: "POST",
      url: "/api/v1/tools/lan-transfer/uploads",
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
        url: `/api/v1/tools/lan-transfer/uploads/${uploadId}/chunks/${index}`,
        ...multipartPayload("chunk", `chunk-${index}`, "application/octet-stream", content)
      });
      expect(chunk.statusCode).toBe(200);
    }

    const statfsSpy = vi.spyOn(fs, "statfs").mockResolvedValue({
      bavail: 5,
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
        url: `/api/v1/tools/lan-transfer/uploads/${uploadId}/complete`
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
      url: "/api/v1/tools/lan-transfer/uploads",
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
      url: `/api/v1/tools/lan-transfer/uploads/${uploadId}/chunks/0`,
      ...multipartPayload("chunk", "chunk-0", "application/octet-stream", "ca")
    });
    expect(chunk.statusCode).toBe(200);

    const cancel = await app.inject({
      method: "DELETE",
      url: `/api/v1/tools/lan-transfer/uploads/${uploadId}`
    });
    expect(cancel.statusCode).toBe(200);

    const status = await app.inject({
      method: "GET",
      url: `/api/v1/tools/lan-transfer/uploads/${uploadId}`
    });
    expect(status.statusCode).toBe(404);
  });

  it("removes abandoned upload sessions during startup cleanup", async () => {
    process.env.LAN_TRANSFER_UPLOAD_RETENTION_HOURS = "1";
    const uploadsDir = path.join(storageRoot, "lan-transfer", "uploads");
    const sessionDir = path.join(uploadsDir, "stale-upload", "chunks");
    await fs.mkdir(sessionDir, { recursive: true });
    await fs.writeFile(path.join(sessionDir, "0.part"), "old");
    await fs.writeFile(
      path.join(uploadsDir, "index.json"),
      JSON.stringify([
        {
          uploadId: "stale-upload",
          originalName: "old.txt",
          mimeType: "text/plain",
          size: 3,
          chunkSize: 3,
          totalChunks: 1,
          uploadedChunks: [0],
          createdAt: "2020-01-01T00:00:00.000Z",
          updatedAt: "2020-01-01T00:00:00.000Z"
        }
      ])
    );

    const app = await createApp();
    const status = await app.inject({ method: "GET", url: "/api/v1/tools/lan-transfer/uploads/stale-upload" });

    expect(status.statusCode).toBe(404);
    await expect(fs.access(path.join(uploadsDir, "stale-upload"))).rejects.toThrow();
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

function noteMultipartPayload(
  fields: Record<string, string>,
  files: Array<{ fieldName: string; fileName: string; mimeType: string; content: Buffer }>
) {
  const boundary = `----toolbox-note-${Math.random().toString(16).slice(2)}`;
  const chunks: Buffer[] = [];
  for (const [name, value] of Object.entries(fields)) {
    chunks.push(
      Buffer.from(`--${boundary}\r\n` + `Content-Disposition: form-data; name="${name}"\r\n\r\n` + `${value}\r\n`)
    );
  }
  for (const file of files) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="${file.fieldName}"; filename="${file.fileName}"\r\n` +
          `Content-Type: ${file.mimeType}\r\n\r\n`
      ),
      file.content,
      Buffer.from("\r\n")
    );
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  const body = Buffer.concat(chunks);
  return {
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`,
      "content-length": String(body.length)
    },
    payload: body
  };
}
