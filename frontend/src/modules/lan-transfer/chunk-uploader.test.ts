/**
 * 中文模块说明：测试 frontend/src/modules/lan-transfer/chunk-uploader.test.ts 中的稳定行为、边界条件和回归场景
 */
import { describe, expect, it } from "vitest";
import { ConcurrentChunkUploader, DEFAULT_LAN_UPLOAD_CONCURRENCY, type ChunkUploadApi } from "./chunk-uploader";
import type { LanUploadStatus } from "./types";

describe("ConcurrentChunkUploader", () => {
  it("reconnects to a persisted upload session", async () => {
    let requestedUploadId = "";
    const uploadedIndexes: number[] = [];
    const api = createFakeChunkApi({
      getUploadStatus: async (uploadId) => {
        requestedUploadId = uploadId;
        return uploadStatus({ uploadId, uploadedChunks: [0] });
      },
      uploadChunk: async (_uploadId, index) => {
        uploadedIndexes.push(index);
        return uploadStatus({ uploadedChunks: [0, ...uploadedIndexes] });
      }
    });
    const file = new File(["abcdef"], "persisted.txt", { type: "text/plain" });
    const uploader = new ConcurrentChunkUploader(file, api, { chunkSize: 2, uploadId: "saved-upload" });

    await uploader.start();

    expect(requestedUploadId).toBe("saved-upload");
    expect(uploadedIndexes).toEqual([1, 2]);
  });

  it("skips chunks already reported by the resume status", async () => {
    const uploadedIndexes: number[] = [];
    const api = createFakeChunkApi({
      uploadedChunks: [0],
      uploadChunk: async (_uploadId, index) => {
        uploadedIndexes.push(index);
        return uploadStatus({ uploadedChunks: [0, ...uploadedIndexes] });
      }
    });
    const file = new File(["abcdefghij"], "resume.txt", { type: "text/plain" });
    const uploader = new ConcurrentChunkUploader(file, api, {
      chunkSize: 4,
      concurrency: DEFAULT_LAN_UPLOAD_CONCURRENCY
    });

    const result = await uploader.start();

    expect(result.status).toBe("done");
    expect(uploadedIndexes).toEqual([1, 2]);
    expect(api.completedUploadId).toBe("upload-1");
  });

  it("limits active chunk uploads to the configured concurrency", async () => {
    let activeUploads = 0;
    let maxActiveUploads = 0;
    const api = createFakeChunkApi({
      uploadChunk: async (_uploadId, index) => {
        activeUploads += 1;
        maxActiveUploads = Math.max(maxActiveUploads, activeUploads);
        await new Promise((resolve) => setTimeout(resolve, 5));
        activeUploads -= 1;
        return uploadStatus({ uploadedChunks: [index] });
      }
    });
    const file = new File(["abcdefghijkl"], "parallel.txt", { type: "text/plain" });
    const uploader = new ConcurrentChunkUploader(file, api, {
      chunkSize: 2,
      concurrency: 2
    });

    await uploader.start();

    expect(maxActiveUploads).toBe(2);
  });

  it("keeps in-flight memory bounded for a large logical file", async () => {
    const logicalSize = 512 * 1024 * 1024;
    const chunkSize = 4 * 1024 * 1024;
    let activeBytes = 0;
    let maxActiveBytes = 0;
    const api = createFakeChunkApi({
      uploadChunk: async (_uploadId, index, chunk) => {
        activeBytes += chunk.size;
        maxActiveBytes = Math.max(maxActiveBytes, activeBytes);
        await new Promise((resolve) => setTimeout(resolve, 2));
        activeBytes -= chunk.size;
        return uploadStatus({ uploadedChunks: [index] });
      }
    });
    const file = {
      name: "large-logical-file.bin",
      type: "application/octet-stream",
      size: logicalSize,
      slice: (start: number, end: number) => ({ size: end - start }) as Blob
    } as unknown as File;
    const uploader = new ConcurrentChunkUploader(file, api, {
      chunkSize,
      concurrency: 2,
      maxRetries: 0
    });

    const result = await uploader.start();

    expect(result.status).toBe("done");
    expect(maxActiveBytes).toBeLessThanOrEqual(chunkSize * 2);
  });

  it("pauses before scheduling additional chunks and resumes missing chunks", async () => {
    const uploadedIndexes: number[] = [];
    const api = createFakeChunkApi({
      uploadChunk: async (_uploadId, index) => {
        uploadedIndexes.push(index);
        return uploadStatus({ uploadedChunks: [...uploadedIndexes] });
      }
    });
    const file = new File(["abcdef"], "pause.txt", { type: "text/plain" });
    const uploader = new ConcurrentChunkUploader(file, api, {
      chunkSize: 2,
      concurrency: 1
    });
    let pausedOnce = false;

    uploader.onProgress((snapshot) => {
      if (!pausedOnce && snapshot.uploadedChunks.length === 1) {
        pausedOnce = true;
        uploader.pause();
      }
    });

    const paused = await uploader.start();
    expect(paused.status).toBe("paused");
    expect(uploadedIndexes).toEqual([0]);

    const resumed = await uploader.resume();
    expect(resumed.status).toBe("done");
    expect(uploadedIndexes).toEqual([0, 1, 2]);
  });

  it("deduplicates repeated resume clicks while an upload run is active", async () => {
    const uploadedIndexes: number[] = [];
    const api = createFakeChunkApi({
      uploadedChunks: [0],
      uploadChunk: async (_uploadId, index) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        uploadedIndexes.push(index);
        return uploadStatus({ uploadedChunks: [0, ...uploadedIndexes] });
      }
    });
    const file = new File(["abcdef"], "multi-resume.txt", { type: "text/plain" });
    const uploader = new ConcurrentChunkUploader(file, api, {
      chunkSize: 2,
      concurrency: 1
    });

    const [first, second] = await Promise.all([uploader.resume(), uploader.resume()]);

    expect(first.status).toBe("done");
    expect(second.status).toBe("done");
    expect(uploadedIndexes).toEqual([1, 2]);
  });

  it("retries a failed chunk before failing the upload", async () => {
    const attemptsByChunk = new Map<number, number>();
    const api = createFakeChunkApi({
      uploadChunk: async (_uploadId, index) => {
        const attempts = (attemptsByChunk.get(index) ?? 0) + 1;
        attemptsByChunk.set(index, attempts);
        if (index === 1 && attempts === 1) {
          throw new Error("ERR_CONNECTION_RESET");
        }
        return uploadStatus({ uploadedChunks: [index] });
      }
    });
    const file = new File(["abcdefgh"], "retry.txt", { type: "text/plain" });
    const uploader = new ConcurrentChunkUploader(file, api, {
      chunkSize: 4,
      concurrency: 1,
      maxRetries: 2,
      retryDelayMs: 1
    });

    const result = await uploader.start();

    expect(result.status).toBe("done");
    expect(attemptsByChunk.get(1)).toBe(2);
  });

  it("completes immediately when resume status says every chunk is already uploaded", async () => {
    const uploadedIndexes: number[] = [];
    const api = createFakeChunkApi({
      uploadedChunks: [0, 1, 2],
      uploadChunk: async (_uploadId, index) => {
        uploadedIndexes.push(index);
        return uploadStatus({ uploadedChunks: [0, 1, 2] });
      }
    });
    const file = new File(["abcdefghij"], "complete-only.txt", { type: "text/plain" });
    const uploader = new ConcurrentChunkUploader(file, api, {
      chunkSize: 4,
      concurrency: 2
    });

    const result = await uploader.start();

    expect(result.status).toBe("done");
    expect(uploadedIndexes).toEqual([]);
    expect(api.completedUploadId).toBe("upload-1");
  });

  it("creates a zero-chunk session for an empty file and completes it", async () => {
    let sessionInput: Parameters<ChunkUploadApi["createUploadSession"]>[0] | undefined;
    const uploadedIndexes: number[] = [];
    const api = createFakeChunkApi({
      createUploadSession: async (input) => {
        sessionInput = input;
        return uploadStatus({ size: 0, totalChunks: 0, uploadedChunks: [] });
      },
      uploadChunk: async (_uploadId, index) => {
        uploadedIndexes.push(index);
        return uploadStatus({ size: 0, totalChunks: 0, uploadedChunks: [] });
      }
    });
    const file = new File([], "empty.txt", { type: "text/plain" });
    const uploader = new ConcurrentChunkUploader(file, api, { chunkSize: 4 });

    const result = await uploader.start();

    expect(result.status).toBe("done");
    expect(sessionInput).toMatchObject({ size: 0, chunkSize: 4, totalChunks: 0 });
    expect(uploadedIndexes).toEqual([]);
    expect(api.completedUploadId).toBe("upload-1");
  });

  it("stops without deleting the resumable session when its owning scope aborts", async () => {
    const controller = new AbortController();
    const api = createFakeChunkApi();
    const uploader = new ConcurrentChunkUploader(new File(["abc"], "scope.txt"), api, {
      chunkSize: 2,
      signal: controller.signal
    });

    controller.abort();
    await expect(uploader.start()).resolves.toMatchObject({ status: "canceled" });
    expect(api.completedUploadId).toBeUndefined();
  });
});

function createFakeChunkApi(overrides: Partial<ChunkUploadApi> & { uploadedChunks?: number[] } = {}) {
  const api: ChunkUploadApi & { completedUploadId?: string } = {
    async createUploadSession(input) {
      if (overrides.createUploadSession) {
        return overrides.createUploadSession(input);
      }
      return uploadStatus({ uploadedChunks: overrides.uploadedChunks ?? [] });
    },
    async getUploadStatus(uploadId) {
      if (overrides.getUploadStatus) {
        return overrides.getUploadStatus(uploadId);
      }
      return uploadStatus({ uploadedChunks: overrides.uploadedChunks ?? [] });
    },
    async uploadChunk(uploadId, index, chunk, onUploadProgress) {
      onUploadProgress?.({ loaded: chunk.size, total: chunk.size });
      if (overrides.uploadChunk) {
        return overrides.uploadChunk(uploadId, index, chunk, onUploadProgress);
      }
      return uploadStatus({ uploadedChunks: [index] });
    },
    async completeUpload(uploadId) {
      api.completedUploadId = uploadId;
      return {
        file: uploadStatus({}).originalName as never,
        previewUrl: "/preview",
        downloadUrl: "/download"
      };
    },
    async cancelUpload() {
      return { removed: true };
    }
  };

  return api;
}

function uploadStatus(overrides: Partial<LanUploadStatus>): LanUploadStatus {
  return {
    uploadId: "upload-1",
    originalName: "file.txt",
    mimeType: "text/plain",
    size: 10,
    chunkSize: 4,
    totalChunks: 3,
    uploadedChunks: [],
    uploadedBytes: 0,
    createdAt: "2026-07-06T00:00:00.000Z",
    updatedAt: "2026-07-06T00:00:00.000Z",
    ...overrides
  };
}
