/** PID ownership for long builds; an expiring directory lock serializes only metadata changes. */
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { lstat, open, readFile, rm } from "node:fs/promises";
import lockfile from "proper-lockfile";

async function withAccess(lockPath, work) {
  let release;
  try {
    // Never use a short heartbeat to decide whether a long-running build is alive.
    // This gate covers only creating, inspecting and removing the PID file.
    release = await lockfile.lock(lockPath, {
      realpath: false,
      lockfilePath: `${lockPath}.lock`,
      stale: 30_000,
      update: 5_000,
      retries: { retries: 20, factor: 1, minTimeout: 100, maxTimeout: 100 }
    });
  } catch (error) {
    if (error.code === "ELOCKED") {
      throw new Error("正在更新桌面打包锁，请稍后重试；若刚强制结束打包，请等待 30 秒再重试。", { cause: error });
    }
    throw error;
  }
  try {
    return await work();
  } finally {
    await release();
  }
}

async function readOwner(lockPath) {
  try {
    const stat = await lstat(lockPath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4096) throw new Error("打包锁类型异常");
    const owner = JSON.parse(await readFile(lockPath, "utf8"));
    if (!Number.isSafeInteger(owner.pid) || owner.pid <= 0 || owner.pid > 0x7fffffff)
      throw new Error("打包锁 PID 无效");
    return owner;
  } catch (error) {
    if (error.code === "ENOENT") return undefined;
    throw new Error(`无法确认打包锁的持有者：${lockPath}。请确认所有打包进程已退出后再手动清理。`, { cause: error });
  }
}

async function recover(lockPath) {
  const owner = await readOwner(lockPath);
  if (!owner) return false;
  if (owner.hostname && owner.hostname !== hostname()) {
    throw new Error(`打包锁来自另一台机器（${owner.hostname}），无法自动确认进程状态：${lockPath}`);
  }
  try {
    process.kill(owner.pid, 0);
  } catch (error) {
    // EPERM and unknown errors are not evidence that the owner has exited.
    if (error.code !== "ESRCH")
      throw new Error(`无法确认打包进程 PID ${owner.pid} 是否退出，保留锁：${lockPath}`, { cause: error });
    await rm(lockPath);
    console.log(`已恢复失效的桌面打包锁：PID ${owner.pid} 已退出。`);
    return true;
  }
  throw new Error(
    `Another desktop package operation owns ${lockPath} (PID ${owner.pid}). 该进程仍在运行，请等待打包结束。`
  );
}

/** Maintenance entry: checks ownership without starting a build or changing the product version. */
export async function recoverStaleDesktopPackageLock(lockPath) {
  return withAccess(lockPath, () => recover(lockPath));
}

export async function acquireDesktopPackageLock(lockPath) {
  const token = randomUUID();
  const handle = await withAccess(lockPath, async () => {
    let file;
    try {
      file = await open(lockPath, "wx");
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      await recover(lockPath);
      // wx remains the final exclusion check, including against older launchers.
      file = await open(lockPath, "wx");
    }
    try {
      await file.writeFile(
        `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), hostname: hostname(), token })}\n`
      );
      await file.sync();
      return file;
    } catch (error) {
      await file.close();
      await rm(lockPath, { force: true });
      throw error;
    }
  });
  return async () => {
    await handle.close();
    await withAccess(lockPath, async () => {
      const owner = await readOwner(lockPath);
      if (owner?.token === token) await rm(lockPath);
    });
  };
}
