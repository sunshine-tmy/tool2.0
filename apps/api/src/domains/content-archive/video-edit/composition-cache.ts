import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const lifetime = 3600_000;
export async function cleanupCompositionCache(root: string) {
  const entries = await fs.readdir(root).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const files = (
    await Promise.all(
      entries
        .filter((name) => /^[a-f0-9]{64}\.mkv$/.test(name))
        .map(async (name) => {
          const file = path.join(root, name),
            stat = await fs.stat(file).catch(() => undefined);
          return stat ? { file, stat } : undefined;
        })
    )
  )
    .filter((entry) => entry !== undefined)
    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
  let total = 0;
  for (const { file, stat } of files) {
    total += stat.size;
    if (total > 1024 ** 3 || Date.now() - stat.mtimeMs > lifetime) await fs.rm(file, { force: true });
  }
}

/** 缓存完整的无损画面及混音；目标补帧参数不进入合成缓存键。 */
export async function preparedComposition(
  root: string | undefined,
  key: string | undefined,
  output: string,
  budget: number,
  signal: AbortSignal,
  generate: () => Promise<unknown>
) {
  const target = root && key && /^[a-f0-9]{64}$/.test(key) ? path.join(root, `${key}.mkv`) : undefined;
  if (target) {
    const stat = await fs.stat(target).catch(() => undefined);
    if (stat && Date.now() - stat.mtimeMs < lifetime) {
      await fs.utimes(target, new Date(), new Date());
      return target;
    }
  }
  await generate();
  signal.throwIfAborted();
  const stat = await fs.stat(output);
  if (target && stat.size < Math.min(512 * 1024 ** 2, budget / 4)) {
    await fs.mkdir(root!, { recursive: true });
    const temporary = `${target}.${randomUUID()}.partial`;
    try {
      await fs.copyFile(output, temporary);
      signal.throwIfAborted();
      await fs.rename(temporary, target);
      await cleanupCompositionCache(root!);
    } catch {
      signal.throwIfAborted();
      // 缓存写入失败时仍使用本次已生成的完整合成结果。
    } finally {
      await fs.rm(temporary, { force: true });
    }
  }
  return output;
}
