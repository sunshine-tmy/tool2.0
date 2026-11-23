import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type { ArchiveCutClip } from "@toolbox/shared";
import { runMediaProcess, type RenderVideoOptions } from "./renderer";

const active = new Set<string>();
const maximum = 2 * 1024 ** 3,
  lifetime = 3600_000;
export function interpolationCacheKey(checksum: string, clip: ArchiveCutClip, fps: number, modelVersion = "flow-v1") {
  return createHash("sha256")
    .update(
      JSON.stringify([
        "pipeline-v3",
        checksum,
        clip.start,
        clip.end,
        clip.speed ?? 1,
        Boolean(clip.reverse),
        clip.interpolation,
        fps,
        modelVersion
      ])
    )
    .digest("hex");
}
async function prune(root: string) {
  const files = await fs.readdir(root, { withFileTypes: true });
  const entries = [];
  for (const file of files) {
    if (!file.isFile() || !/^[a-f0-9]{64}\.mkv$/.test(file.name)) continue;
    const target = path.join(root, file.name),
      stat = await fs.stat(target).catch(() => undefined);
    if (stat) entries.push({ target, stat });
  }
  entries.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
  let bytes = 0;
  for (const { target, stat } of entries) {
    bytes += stat.size;
    if (!active.has(target) && (bytes > maximum || Date.now() - stat.mtimeMs > lifetime)) {
      await fs.rm(target, { force: true });
      await fs.rm(`${target}.json`, { force: true });
    }
  }
}
export async function cleanupInterpolationCache(root: string) {
  try {
    await prune(root);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
/** 缓存只保存无声画面；音量和淡入淡出始终从当前输入重新复用。 */
export async function cachedInterpolation(
  options: RenderVideoOptions,
  input: string,
  output: string,
  duration: number,
  key: string | undefined,
  remaining: number,
  generate: () => Promise<"flow" | "rife">
) {
  if (!options.interpolationCacheRoot || !key) return generate();
  const root = options.interpolationCacheRoot;
  await fs.mkdir(root, { recursive: true });
  const target = path.join(root, `${key}.mkv`);
  active.add(target);
  try {
    await prune(root);
    try {
      const meta = JSON.parse(await fs.readFile(`${target}.json`, "utf8"));
      const stat = await fs.stat(target);
      if (
        (meta.engine === "rife" || meta.engine === "flow") &&
        stat.size === meta.size &&
        Date.now() - stat.mtimeMs < lifetime
      ) {
        options.onStatus?.(`复用${meta.engine === "rife" ? "AI" : "兼容"}补帧缓存`);
        await runMediaProcess(
          options.tools.ffmpeg,
          [
            "-v",
            "error",
            "-nostdin",
            "-y",
            "-i",
            target,
            "-i",
            input,
            "-map",
            "0:v:0",
            "-map",
            "1:a?",
            "-t",
            String(duration),
            "-c",
            "copy",
            output
          ],
          options.signal,
          { output, maxBytes: remaining }
        );
        await fs.utimes(target, new Date(), new Date());
        return meta.engine as "flow" | "rife";
      }
    } catch {
      options.signal.throwIfAborted();
    }
    const engine = await generate();
    const size = (await fs.stat(output)).size;
    if (size < Math.min(512 * 1024 ** 2, remaining / 3)) {
      const temporary = path.join(root, `${key}-${randomUUID()}.tmp.mkv`);
      try {
        await runMediaProcess(
          options.tools.ffmpeg,
          ["-v", "error", "-nostdin", "-y", "-i", output, "-map", "0:v:0", "-an", "-c:v", "copy", temporary],
          options.signal,
          { output: temporary, maxBytes: Math.min(512 * 1024 ** 2, remaining / 3) }
        );
        const videoSize = (await fs.stat(temporary)).size;
        await fs.rename(temporary, target);
        await fs.writeFile(`${target}.json`, JSON.stringify({ engine, size: videoSize }));
      } catch {
        options.signal.throwIfAborted();
      } finally {
        await fs.rm(temporary, { force: true });
      }
    }
    await prune(root);
    return engine;
  } finally {
    active.delete(target);
  }
}
