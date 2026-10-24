/** Signed-asset transport; retry/cancellation/proxy policy is unchanged. */
import type fs from "node:fs";
import fsp from "node:fs/promises";
import type { ComponentPackageManifest } from "./types";
import { ComponentManagerError } from "./component-error";
import { createRemoteFetch, type RemoteFetch } from "../../security/remote-fetch";
const DOWNLOAD_RANGE_BYTES = 1024 * 1024;

const DOWNLOAD_RANGE_CONCURRENCY = 4;

const DOWNLOAD_RANGE_ATTEMPTS = 5;

const DOWNLOAD_REQUEST_TIMEOUT_MS = 60_000;

const RETRYABLE_DOWNLOAD_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "EPIPE",
  "UND_ERR_SOCKET",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT"
]);

// GitHub Release 下载会从 github.com 跳转至资产 CDN；每一跳都校验 HTTPS 和公网 DNS，最多允许 5 次跳转。
const componentProxyUrl = process.env.TOOLBOX_COMPONENT_HTTPS_PROXY;

const fetchComponentAsset = createRemoteFetch({
  maxRedirects: 5,
  requireHttps: true,
  ...(componentProxyUrl ? { proxyUrl: componentProxyUrl } : {})
});

export async function downloadComponentArchive(
  manifest: ComponentPackageManifest,
  destination: string,
  options: { signal?: AbortSignal; onProgress?: (downloadedBytes: number) => void } = {},
  remoteFetch: RemoteFetch = fetchComponentAsset
) {
  let file: fs.promises.FileHandle | undefined;
  let createdDestination = false;
  let completed = false;
  try {
    file = await fsp.open(destination, "wx");
    createdDestination = true;
    const controller = new AbortController();
    const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
    const firstRangeEnd = Math.min(DOWNLOAD_RANGE_BYTES, manifest.archive.bytes) - 1;
    const firstRange = await readArchiveRange(manifest, 0, firstRangeEnd, signal, remoteFetch);

    // 非 Range 服务只允许首个响应退回完整流式下载；之后再收到 200 会导致重复写入，因此拒绝。
    if (firstRange.response) {
      await writeFullArchiveResponse(firstRange.response, file, manifest, options);
    } else {
      await writeBufferAt(file, firstRange.buffer, 0);
      let downloadedBytes = firstRange.buffer.byteLength;
      let nextRangeStart = DOWNLOAD_RANGE_BYTES;
      options.onProgress?.(downloadedBytes);

      const deferred: Array<{ start: number; end: number }> = [];
      const writeRange = async (start: number, end: number) => {
        const result = await readArchiveRange(manifest, start, end, signal, remoteFetch);
        if (result.response)
          throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包下载服务未返回有效的分段响应");
        throwIfDownloadAborted(signal);
        await writeBufferAt(file!, result.buffer, start);
        downloadedBytes += result.buffer.byteLength;
        options.onProgress?.(downloadedBytes);
      };

      const downloadWorker = async () => {
        while (true) {
          throwIfDownloadAborted(signal);
          const rangeStart = nextRangeStart;
          if (rangeStart >= manifest.archive.bytes) return;
          nextRangeStart += DOWNLOAD_RANGE_BYTES;
          const rangeEnd = Math.min(rangeStart + DOWNLOAD_RANGE_BYTES, manifest.archive.bytes) - 1;
          try {
            await writeRange(rangeStart, rangeEnd);
          } catch (error) {
            // Exhausted transient parallel requests do not discard already verified chunks.
            // Integrity, protocol and user-cancellation errors must still fail immediately.
            if (!signal.aborted && (isRetryableDownloadError(error) || error instanceof RetryableRangeReadError)) {
              deferred.push({ start: rangeStart, end: rangeEnd });
              return;
            }
            throw error;
          }
        }
      };

      const rangeCount = Math.ceil(manifest.archive.bytes / DOWNLOAD_RANGE_BYTES);
      const workers = Array.from({ length: Math.min(DOWNLOAD_RANGE_CONCURRENCY, Math.max(0, rangeCount - 1)) }, () =>
        downloadWorker()
      );
      try {
        await Promise.all(workers);
        if (deferred.length) {
          console.warn("能力包并发下载暂时失败，保留本次已完成分段，降为串行补下载；仍将校验大小和摘要。");
          while (nextRangeStart < manifest.archive.bytes) {
            deferred.push({
              start: nextRangeStart,
              end: Math.min(nextRangeStart + DOWNLOAD_RANGE_BYTES, manifest.archive.bytes) - 1
            });
            nextRangeStart += DOWNLOAD_RANGE_BYTES;
          }
          for (const range of deferred) await writeRange(range.start, range.end);
        }
      } catch (error) {
        controller.abort(error);
        await Promise.allSettled(workers);
        if (options.signal?.aborted) throw new Error("download cancelled");
        throw error;
      }
      if (downloadedBytes !== manifest.archive.bytes) {
        throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包响应大小校验失败");
      }
    }
    completed = true;
  } finally {
    await file?.close();
    if (createdDestination && !completed) await fsp.rm(destination, { force: true }).catch(() => undefined);
  }
}

async function readArchiveRange(
  manifest: ComponentPackageManifest,
  start: number,
  end: number,
  signal: AbortSignal | undefined,
  remoteFetch: RemoteFetch
): Promise<{ buffer: Buffer; response?: never } | { response: Response; buffer?: never }> {
  for (let attempt = 0; attempt < DOWNLOAD_RANGE_ATTEMPTS; attempt += 1) {
    throwIfDownloadAborted(signal);
    const requestSignal = createDownloadRequestSignal(signal);
    let response: Response;
    try {
      response = await remoteFetch(manifest.archive.url, {
        headers: { Range: `bytes=${start}-${end}` },
        signal: requestSignal
      });
    } catch (error) {
      if (signal?.aborted) throw new Error("download cancelled");
      const failure = requestSignal.aborted ? Object.assign(new Error("能力包下载超时"), { code: "ETIMEDOUT" }) : error;
      if (attempt + 1 >= DOWNLOAD_RANGE_ATTEMPTS || !isRetryableDownloadError(failure)) throw failure;
      reportRangeRetry(start, end, attempt);
      await delayDownloadRetry(attempt, signal);
      continue;
    }

    if (response.status === 200 && start === 0) return { response };
    if (isRetryableDownloadStatus(response.status) && attempt + 1 < DOWNLOAD_RANGE_ATTEMPTS) {
      await response.body?.cancel().catch(() => undefined);
      reportRangeRetry(start, end, attempt);
      await delayDownloadRetry(attempt, signal);
      continue;
    }
    if (response.status !== 206) {
      await response.body?.cancel().catch(() => undefined);
      throw new ComponentManagerError(
        "COMPONENT_INSTALL_FAILED",
        `能力包下载服务未返回有效的分段响应（HTTP ${response.status}）`
      );
    }

    const expectedRangeBytes = end - start + 1;
    validateRangeResponse(response, manifest, start, end, expectedRangeBytes);
    try {
      return { buffer: await readExactRange(response, expectedRangeBytes, signal) };
    } catch (error) {
      if (signal?.aborted) throw new Error("download cancelled");
      const failure = requestSignal.aborted
        ? Object.assign(new Error("能力包分段读取超时"), { code: "ETIMEDOUT" })
        : error;
      if (
        attempt + 1 >= DOWNLOAD_RANGE_ATTEMPTS ||
        (!isRetryableDownloadError(failure) && !(failure instanceof RetryableRangeReadError))
      ) {
        throw failure;
      }
      reportRangeRetry(start, end, attempt);
      await delayDownloadRetry(attempt, signal);
    }
  }
  throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包分段下载失败");
}

function createDownloadRequestSignal(signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(DOWNLOAD_REQUEST_TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

function reportRangeRetry(start: number, end: number, attempt: number) {
  console.warn(`能力包分段 ${start}-${end} 下载暂时失败，正在重试（${attempt + 2}/${DOWNLOAD_RANGE_ATTEMPTS}）。`);
}

function validateRangeResponse(
  response: Response,
  manifest: ComponentPackageManifest,
  start: number,
  end: number,
  expectedBytes: number
) {
  if (!response.ok || response.status !== 206 || !response.body) {
    throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包下载失败");
  }
  const match = /^bytes (\d+)-(\d+)\/(\d+)$/i.exec(response.headers.get("content-range") || "");
  if (!match || Number(match[1]) !== start || Number(match[2]) !== end || Number(match[3]) !== manifest.archive.bytes) {
    throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包分段范围校验失败");
  }
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null && Number(contentLength) !== expectedBytes) {
    throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包分段大小校验失败");
  }
}

class RetryableRangeReadError extends Error {}

async function readExactRange(response: Response, expectedBytes: number, signal?: AbortSignal) {
  const chunks: Buffer[] = [];
  let receivedBytes = 0;
  try {
    for await (const chunk of response.body!) {
      throwIfDownloadAborted(signal);
      const buffer = Buffer.from(chunk);
      receivedBytes += buffer.byteLength;
      if (receivedBytes > expectedBytes) {
        throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包分段响应超过声明大小");
      }
      chunks.push(buffer);
    }
  } catch (error) {
    await response.body?.cancel().catch(() => undefined);
    if (error instanceof ComponentManagerError) throw error;
    if (signal?.aborted) throw new Error("download cancelled");
    if (isRetryableDownloadError(error)) throw error;
    throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包分段读取失败");
  }
  if (receivedBytes !== expectedBytes) throw new RetryableRangeReadError("能力包分段连接提前结束");
  return Buffer.concat(chunks, expectedBytes);
}

async function writeFullArchiveResponse(
  response: Response,
  file: fs.promises.FileHandle,
  manifest: ComponentPackageManifest,
  options: { signal?: AbortSignal; onProgress?: (downloadedBytes: number) => void }
) {
  if (!response.ok || !response.body) throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包下载失败");
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null && Number(contentLength) !== manifest.archive.bytes) {
    throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包响应大小校验失败");
  }
  let downloadedBytes = 0;
  for await (const chunk of response.body) {
    throwIfDownloadAborted(options.signal);
    const buffer = Buffer.from(chunk);
    downloadedBytes += buffer.byteLength;
    if (downloadedBytes > manifest.archive.bytes) {
      throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包响应超过清单大小");
    }
    await writeBufferAt(file, buffer, downloadedBytes - buffer.byteLength);
    options.onProgress?.(downloadedBytes);
  }
  if (downloadedBytes !== manifest.archive.bytes) {
    throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包响应大小校验失败");
  }
  return downloadedBytes;
}

async function writeBufferAt(file: fs.promises.FileHandle, buffer: Buffer, position: number) {
  let writtenBytes = 0;
  while (writtenBytes < buffer.byteLength) {
    const result = await file.write(buffer, writtenBytes, buffer.byteLength - writtenBytes, position + writtenBytes);
    if (!result.bytesWritten) throw new Error("能力包临时文件写入提前结束");
    writtenBytes += result.bytesWritten;
  }
}

function throwIfDownloadAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new Error("download cancelled");
}

function isRetryableDownloadStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function isRetryableDownloadError(error: unknown): boolean {
  let current: unknown = error;
  while (current instanceof Error) {
    if (
      current.name === "TimeoutError" ||
      RETRYABLE_DOWNLOAD_CODES.has((current as NodeJS.ErrnoException).code || "")
    ) {
      return true;
    }
    current = (current as Error & { cause?: unknown }).cause;
  }
  return false;
}

async function delayDownloadRetry(attempt: number, signal?: AbortSignal) {
  throwIfDownloadAborted(signal);
  await new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("download cancelled"));
    };
    const timer = setTimeout(
      () => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      },
      250 * 2 ** attempt
    );
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
