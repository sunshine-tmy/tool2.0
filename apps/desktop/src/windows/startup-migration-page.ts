export function startupMigrationHtml() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>首次启动数据迁移</title>
  <style>
    :root { color-scheme: light; font-family: "Microsoft YaHei UI", "Segoe UI", sans-serif; color: #172033; background: #f5f7fb; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 34px; }
    main { max-width: 650px; margin: 0 auto; }
    .brand { color: #2563eb; font-size: 12px; font-weight: 800; letter-spacing: .12em; }
    h1 { margin: 12px 0 8px; font-size: 25px; }
    .intro { color: #64748b; line-height: 1.7; margin: 0 0 22px; }
    .card { background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; margin: 12px 0; }
    .label { color: #64748b; font-size: 12px; margin: 0 0 5px; }
    .path { overflow-wrap: anywhere; font: 13px/1.55 Consolas, monospace; }
    .row { display: flex; justify-content: space-between; gap: 20px; padding: 7px 0; }
    .row span:first-child { color: #64748b; }
    .warning { color: #854d0e; background: #fefce8; border-radius: 10px; padding: 12px 14px; line-height: 1.6; margin-top: 14px; }
    #error { display: none; color: #b91c1c; background: #fef2f2; border-radius: 10px; padding: 12px 14px; margin-top: 14px; white-space: pre-wrap; }
    #status { min-height: 24px; color: #0f766e; margin-top: 12px; }
    .actions { display: flex; gap: 12px; margin-top: 22px; }
    button { border: 0; border-radius: 9px; padding: 11px 16px; font: inherit; font-weight: 700; cursor: pointer; }
    button:disabled { opacity: .52; cursor: wait; }
    #migrate { background: #2563eb; color: white; }
    #fresh { background: white; color: #334155; border: 1px solid #cbd5e1; }
    #exit { margin-left: auto; background: transparent; color: #64748b; }
  </style>
</head>
<body>
  <main>
    <div class="brand">ECOMMERCE TOOLBOX · FIRST RUN</div>
    <h1>选择如何处理旧版数据</h1>
    <p class="intro">检测到旧版电商工具箱数据。选择迁移后，应用会复制并校验文件，再切换到新目录；旧目录不会删除，可用于回退。完成选择前不会打开业务页面。</p>
    <section class="card">
      <p class="label">旧版数据来源</p><div id="source" class="path">正在检查…</div>
      <p class="label" style="margin-top:15px">新数据位置</p><div id="destination" class="path"></div>
      <div class="row" style="margin-top:12px"><span>预计迁移</span><strong id="size"></strong></div>
      <div class="row"><span>文件数量</span><strong id="files"></strong></div>
      <div class="row"><span>目标磁盘可用空间</span><strong id="free"></strong></div>
    </section>
    <div class="warning">“以空数据启动”不会删除旧目录，但本次应用将从空数据库和素材目录开始。迁移包含配置、业务数据、能力包、模型、浏览器登录状态、日志和迁移备份。</div>
    <div id="error" role="alert"></div><div id="status" aria-live="polite"></div>
    <div class="actions">
      <button id="migrate" type="button">迁移并继续</button>
      <button id="fresh" type="button">以空数据启动</button>
      <button id="exit" type="button">退出</button>
    </div>
  </main>
  <script>
    const api = window.toolboxDesktop;
    const byId = (id) => document.getElementById(id);
    const formatBytes = (value) => {
      if (value < 1024) return value + " B";
      const units = ["KB", "MB", "GB", "TB"];
      let amount = value / 1024, unit = 0;
      while (amount >= 1024 && unit < units.length - 1) { amount /= 1024; unit += 1; }
      return amount.toFixed(1) + " " + units[unit];
    };
    const showError = (error) => {
      byId("error").textContent = error instanceof Error ? error.message : String(error);
      byId("error").style.display = "block";
      byId("migrate").disabled = false;
      byId("fresh").disabled = false;
      byId("exit").disabled = false;
    };
    const runAction = async (button, message, action) => {
      byId("error").style.display = "none";
      byId("migrate").disabled = true;
      byId("fresh").disabled = true;
      byId("exit").disabled = true;
      button.disabled = true;
      byId("status").textContent = message;
      try { await action(); byId("status").textContent = "已完成，正在启动应用…"; }
      catch (error) { showError(error); }
    };
    (async () => {
      try {
        const state = await api.getStartupDataMigrationState();
        byId("source").textContent = state.sourceDirectory || "未找到旧版目录";
        byId("destination").textContent = state.destinationDirectory;
        byId("size").textContent = formatBytes(state.sourceBytes);
        byId("files").textContent = state.sourceFiles.toLocaleString("zh-CN");
        byId("free").textContent = state.freeBytes === undefined ? "暂不可读取" : formatBytes(state.freeBytes);
        if (state.sufficientSpace === false) {
          byId("migrate").disabled = true;
          byId("error").textContent = "目标磁盘空间不足。请释放空间后重新启动，旧数据不会被修改。";
          byId("error").style.display = "block";
        }
      } catch (error) { showError(error); }
    })();
    byId("migrate").addEventListener("click", () => runAction(byId("migrate"), "正在复制并逐文件校验。数据量较大时可能需要一些时间，请勿关闭应用…", () => api.migrateStartupData()));
    byId("fresh").addEventListener("click", () => {
      if (!window.confirm("本次将以空数据启动。旧目录会保留，但不会自动显示在新应用中。确定继续吗？")) return;
      void runAction(byId("fresh"), "正在记录选择…", () => api.chooseFreshStartupData());
    });
    byId("exit").addEventListener("click", () => api.exitStartupMigration());
  </script>
</body>
</html>`;
}
