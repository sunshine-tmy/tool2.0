/** Stream a fixed local API capability to a native-selected destination without buffering models in memory. */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

export async function saveCapabilityExport(
  origin: string,
  componentId: string,
  destination: string,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch
) {
  const base = new URL(origin);
  if (
    base.protocol !== "http:" ||
    base.hostname !== "127.0.0.1" ||
    base.pathname !== "/" ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    !/^[a-z0-9][a-z0-9-]{0,79}$/.test(componentId)
  )
    throw new Error("能力导出地址无效");
  const response = await fetcher(new URL(`/api/v1/components/${componentId}/offline-export`, base), {
    method: "POST",
    headers: { origin: base.origin },
    redirect: "error",
    signal
  });
  if (!response.ok && response.headers.get("content-type")?.includes("application/json")) {
    const failure: unknown = await response.json().catch(() => undefined);
    if (failure && typeof failure === "object" && "message" in failure && typeof failure.message === "string")
      throw new Error(`能力包导出失败（HTTP ${response.status}）：${failure.message.slice(0, 1000)}`);
  }
  const limit = Number(response.headers.get("x-toolbox-export-max-bytes"));
  if (
    !response.ok ||
    response.headers.get("content-type")?.split(";")[0] !== "application/zip" ||
    !Number.isSafeInteger(limit) ||
    limit <= 0 ||
    !response.body
  ) {
    await response.body?.cancel();
    throw new Error(`能力包导出失败（HTTP ${response.status}），请确认已安装能力及依赖均与当前目录版本一致`);
  }
  const temporary = path.join(
    path.dirname(destination),
    `.${path.basename(destination)}.${crypto.randomUUID()}.partial`
  );
  let created = false,
    bytes = 0;
  try {
    const space = await fsp.statfs(path.dirname(destination));
    if (Number(space.bavail) * Number(space.bsize) < limit + 32 * 1024 * 1024)
      throw new Error("目标磁盘剩余空间不足，尚未覆盖目标文件");
    const handle = await fsp.open(temporary, "wx", 0o600);
    await handle.close();
    created = true;
    const meter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        bytes += chunk.length;
        callback(bytes > limit ? new Error("导出内容超过受信任大小限制") : null, chunk);
      }
    });
    await pipeline(
      Readable.fromWeb(response.body as unknown as NodeReadableStream<Uint8Array>, { signal }),
      meter,
      fs.createWriteStream(temporary, { flags: "r+" }),
      { signal }
    );
    if (!bytes) throw new Error("导出文件为空");
    const saved = await fsp.open(temporary, "r+");
    try {
      await saved.sync();
    } finally {
      await saved.close();
    }
    signal.throwIfAborted();
    await fsp.rename(temporary, destination);
    return { fileName: path.basename(destination), bytes };
  } finally {
    await response.body.cancel().catch(() => undefined);
    if (created) await fsp.rm(temporary, { force: true }).catch(() => undefined);
  }
}
