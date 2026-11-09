/** 同步其他设备提交的文件与图文；后台暂停，返回页面立即同步。 */
export function startLanListSync(refresh: () => Promise<unknown>, intervalMs = 3000) {
  let stopped = false;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  async function tick() {
    if (stopped || running) return;
    clearTimeout(timer);
    running = true;
    try {
      if (document.visibilityState !== "hidden") await refresh();
    } catch {
      // 自动同步失败保留列表，下次恢复；手动刷新仍展示具体错误。
    } finally {
      running = false;
      if (!stopped) timer = setTimeout(tick, intervalMs);
    }
  }
  const resume = () => {
    if (document.visibilityState !== "hidden") void tick();
  };
  document.addEventListener("visibilitychange", resume);
  window.addEventListener("focus", resume);
  timer = setTimeout(tick, intervalMs);
  return () => {
    stopped = true;
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", resume);
    window.removeEventListener("focus", resume);
  };
}
