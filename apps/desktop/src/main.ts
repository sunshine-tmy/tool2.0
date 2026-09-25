import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, dialog, ipcMain, session, shell, type IpcMainInvokeEvent } from "electron";
import { BackendSupervisor } from "./backend-supervisor";
import { componentProxyUrlFromResolution } from "./system-proxy";
import {
  importDesktopData,
  recoverDesktopDataMigrations,
  rollbackDesktopData,
  type DesktopDataMigrationOptions
} from "./desktop-data-migration";
import { readDesktopSettings, updateDesktopSettings } from "./desktop-settings";
import {
  chooseFreshDesktopData,
  migrateLegacyDesktopData,
  prepareStartupDataMigration,
  type StartupDataMigrationState
} from "./desktop-root-migration";
import {
  createDesktopUpdater,
  getDesktopAutoUpdater,
  scheduleAutomaticUpdateCheck,
  type DesktopUpdater
} from "./desktop-updater";
import {
  createDesktopRuntimeLayout,
  desktopBackendEntrypoint,
  desktopDataRoot,
  desktopInstallRoot
} from "./runtime-layout";
import { isSafeExternalUrl, isTrustedBackendUrl } from "./window-security";

let mainWindow: BrowserWindow | undefined;
let startupMigrationWindow: BrowserWindow | undefined;
let backend: BackendSupervisor | undefined;
let backendOrigin: string | undefined;
let updater: DesktopUpdater | undefined;
let automaticUpdateTimer: NodeJS.Timeout | undefined;
let quitting = false;
let startupMigrationState: StartupDataMigrationState | undefined;
let startupMigrationResolve: ((completed: boolean) => void) | undefined;
let startupMigrationCompleted = false;

const workspaceRoot = fileURLToPath(new URL("../../..", import.meta.url));
const desktopIconPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../assets/ecommerce-toolbox.ico");
const installRoot = desktopInstallRoot(app.isPackaged, app.getPath("exe"), workspaceRoot);
const legacyDataRoot = path.join(process.env.LOCALAPPDATA || app.getPath("appData"), "EcommerceToolboxData");
const dataRoot = desktopDataRoot(app.isPackaged, app.getPath("exe"), process.env.LOCALAPPDATA, app.getPath("appData"));
const installRootWritable =
  !app.isPackaged ||
  (!desktopPathsOverlap(dataRoot, legacyDataRoot) &&
    canWriteDirectory(installRoot) &&
    canWriteDirectory(dataRoot, true));
if (installRootWritable) {
  fs.mkdirSync(path.join(dataRoot, ".runtime"), { recursive: true });
  fs.mkdirSync(path.join(dataRoot, "profile"), { recursive: true });
  fs.mkdirSync(path.join(dataRoot, "temp"), { recursive: true });
  fs.mkdirSync(path.join(dataRoot, "logs", "crash-dumps"), { recursive: true });
  app.setPath("userData", path.join(dataRoot, ".runtime"));
  app.setPath("sessionData", path.join(dataRoot, "profile"));
  app.setPath("temp", path.join(dataRoot, "temp"));
  app.setPath("crashDumps", path.join(dataRoot, "logs", "crash-dumps"));
  app.setAppLogsPath(path.join(dataRoot, "logs"));
}
app.setAppUserModelId("com.ecommercetoolbox.desktop");

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  void boot();
}

async function boot() {
  await app.whenReady();
  if (!installRootWritable) {
    dialog.showErrorBox(
      "需要重新选择安装目录",
      `当前安装目录或其 data 子目录不可由当前用户写入：\n${installRoot}\n\n请重新运行安装程序，并选择当前用户具有写入权限的目录。此版本不会通过管理员提权或改写目录权限。`
    );
    app.quit();
    return;
  }
  ipcMain.handle("desktop:get-version", () => app.getVersion());

  const layout = createDesktopRuntimeLayout({
    packaged: app.isPackaged,
    userDataRoot: dataRoot,
    resourcesPath: process.resourcesPath
  });

  try {
    startupMigrationState = await prepareStartupDataMigration({ dataRoot, legacyDataRoot });
    if (startupMigrationState.required) {
      registerStartupMigrationIpc();
      const completed = await showStartupMigrationWindow(startupMigrationState);
      if (!completed) return;
    }

    // 在后端打开任何数据库或业务文件之前恢复未完成切换，防止半迁移目录被误认为有效数据。
    await recoverDesktopDataMigrations(migrationOptions(layout));
    const componentProxyUrl = await session.defaultSession
      .resolveProxy("https://github.com")
      .then(componentProxyUrlFromResolution)
      .catch((error) => {
        console.warn("Unable to resolve the Windows system proxy for component downloads", error);
        return undefined;
      });
    backend = new BackendSupervisor({
      entrypoint: desktopBackendEntrypoint(app.isPackaged, process.resourcesPath),
      runtimeLayout: layout,
      componentProxyUrl,
      onUnexpectedExit: (message) => {
        void dialog.showErrorBox("本地服务已停止", `${message}，请重新启动应用。`);
      }
    });
    registerDesktopIpc(layout);
    backendOrigin = await backend.start();
    backend.monitorUnexpectedExit();
    createWindow(backendOrigin);
    updater = createDesktopUpdater({
      resourcesPath: process.resourcesPath,
      packaged: app.isPackaged,
      platform: process.platform,
      getWindow: () => mainWindow,
      installDownloadedUpdate,
      log: (entry, error) => console.warn(entry, error)
    });
    try {
      scheduleConfiguredUpdateCheck(updater, await readDesktopSettings(layout.configRoot));
    } catch (error) {
      console.warn("Desktop update preference is unavailable", error);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    const details = error instanceof Error ? (error.stack ?? error.message) : String(error);
    const logsRoot = path.join(dataRoot, "logs");
    fs.mkdirSync(logsRoot, { recursive: true });
    fs.appendFileSync(path.join(logsRoot, "desktop-startup.log"), `${new Date().toISOString()} ${details}\n\n`, "utf8");
    console.error("Desktop boot failed", error);
    process.stderr.write(
      `Desktop boot failed: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
    );
    dialog.showErrorBox("电商工具箱无法启动", message);
    app.exit(1);
  }
}

function registerDesktopIpc(layout: ReturnType<typeof createDesktopRuntimeLayout>) {
  const selectedLegacyDirectories = new Map<string, { path: string; expiresAt: number }>();
  const options = migrationOptions(layout);
  const assertTrustedSender = (event: IpcMainInvokeEvent) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) throw new Error("未授权的桌面调用");
  };
  const currentSettings = async () => ({
    ...(await readDesktopSettings(layout.configRoot)),
    installDirectory: installRoot,
    dataDirectory: dataRoot
  });

  ipcMain.handle("desktop:get-settings", async (event) => {
    assertTrustedSender(event);
    return currentSettings();
  });
  ipcMain.handle("desktop:update-settings", async (event, value: unknown) => {
    assertTrustedSender(event);
    if (!isSettingsUpdate(value)) throw new Error("设置参数无效");
    if (value.startAtLogin !== undefined) app.setLoginItemSettings({ openAtLogin: value.startAtLogin });
    const settings = await updateDesktopSettings(layout.configRoot, value);
    scheduleConfiguredUpdateCheck(updater ?? disabledUpdater, settings);
    return currentSettings();
  });
  ipcMain.handle("desktop:check-for-updates", async (event) => {
    assertTrustedSender(event);
    return (updater ?? disabledUpdater).checkForUpdates();
  });
  ipcMain.handle("desktop:reveal-data-directory", async (event) => {
    assertTrustedSender(event);
    await fs.promises.mkdir(dataRoot, { recursive: true });
    const error = await shell.openPath(dataRoot);
    if (error) throw new Error("无法打开用户数据目录");
  });
  ipcMain.handle("desktop:select-legacy-data-directory", async (event) => {
    assertTrustedSender(event);
    const selected = await dialog.showOpenDialog(mainWindow!, {
      title: "选择旧版电商工具箱数据目录",
      buttonLabel: "选择此目录",
      properties: ["openDirectory", "dontAddToRecent"]
    });
    if (selected.canceled || !selected.filePaths[0]) return { canceled: true };
    const selectionId = crypto.randomBytes(18).toString("base64url");
    selectedLegacyDirectories.set(selectionId, {
      path: selected.filePaths[0],
      expiresAt: Date.now() + 10 * 60_000
    });
    return { canceled: false, selectionId, displayName: path.basename(selected.filePaths[0]) };
  });
  ipcMain.handle("desktop:import-legacy-data", async (event, selectionId: unknown) => {
    assertTrustedSender(event);
    const selected = typeof selectionId === "string" ? selectedLegacyDirectories.get(selectionId) : undefined;
    selectedLegacyDirectories.delete(typeof selectionId === "string" ? selectionId : "");
    if (!selected || selected.expiresAt < Date.now()) throw new Error("历史目录选择已失效，请重新选择");
    const result = await withBackendStopped(async () => {
      const migrated = await importDesktopData(options, selected.path);
      await updateDesktopSettings(layout.configRoot, {
        lastMigration: {
          id: migrated.id,
          status: "imported",
          completedAt: new Date().toISOString(),
          files: migrated.source.files,
          bytes: migrated.source.bytes
        }
      });
      return migrated;
    });
    return result;
  });
  ipcMain.handle("desktop:rollback-data-migration", async (event, migrationId: unknown) => {
    assertTrustedSender(event);
    if (typeof migrationId !== "string") throw new Error("迁移编号无效");
    const result = await withBackendStopped(async () => {
      const rolledBack = await rollbackDesktopData(options, migrationId);
      await updateDesktopSettings(layout.configRoot, {
        lastMigration: {
          id: rolledBack.id,
          status: "rolled-back",
          completedAt: new Date().toISOString(),
          files: rolledBack.restored.files,
          bytes: rolledBack.restored.bytes
        }
      });
      return rolledBack;
    });
    return result;
  });
}

function registerStartupMigrationIpc() {
  const assertMigrationSender = (event: IpcMainInvokeEvent) => {
    if (!startupMigrationWindow || event.sender !== startupMigrationWindow.webContents) {
      throw new Error("未授权的首次启动迁移调用");
    }
  };

  ipcMain.handle("desktop:get-startup-data-migration", (event) => {
    assertMigrationSender(event);
    if (!startupMigrationState) throw new Error("首次启动迁移状态不可用");
    return startupMigrationState;
  });
  ipcMain.handle("desktop:migrate-startup-data", async (event) => {
    assertMigrationSender(event);
    if (!startupMigrationState?.required) throw new Error("当前没有待迁移的旧版数据");
    let result: Awaited<ReturnType<typeof migrateLegacyDesktopData>>;
    try {
      result = await migrateLegacyDesktopData({ dataRoot, legacyDataRoot });
    } catch (error) {
      try {
        startupMigrationState = await prepareStartupDataMigration({ dataRoot, legacyDataRoot });
        if (!startupMigrationState.required) {
          completeStartupMigration();
          return;
        }
      } catch {
        // Preserve the actionable error from the failed attempt; an incomplete
        // journal remains on disk for the next startup recovery pass.
      }
      throw error;
    }
    startupMigrationState = {
      required: false,
      destinationDirectory: dataRoot,
      sourceBytes: result.bytes,
      sourceFiles: result.files
    };
    completeStartupMigration();
    return result;
  });
  ipcMain.handle("desktop:choose-fresh-startup-data", async (event) => {
    assertMigrationSender(event);
    await chooseFreshDesktopData({ dataRoot, legacyDataRoot });
    startupMigrationState = await prepareStartupDataMigration({ dataRoot, legacyDataRoot });
    completeStartupMigration();
  });
  ipcMain.handle("desktop:exit-startup-migration", (event) => {
    assertMigrationSender(event);
    app.quit();
  });
}

async function showStartupMigrationWindow(state: StartupDataMigrationState) {
  startupMigrationState = state;
  startupMigrationCompleted = false;
  const completion = new Promise<boolean>((resolve) => {
    startupMigrationResolve = resolve;
  });
  const preload = path.join(path.dirname(fileURLToPath(import.meta.url)), "preload.cjs");
  startupMigrationWindow = new BrowserWindow({
    title: "电商工具箱 · 首次启动数据迁移",
    icon: desktopIconPath,
    width: 720,
    height: 620,
    minWidth: 620,
    minHeight: 560,
    resizable: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload,
      // The bootstrap window must not leave cache files in profile while that
      // directory is being atomically replaced by the legacy profile copy.
      session: session.fromPartition("desktop-startup-migration", { cache: false }),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });
  startupMigrationWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  startupMigrationWindow.on("closed", () => {
    startupMigrationWindow = undefined;
    if (!startupMigrationCompleted) {
      startupMigrationResolve?.(false);
      startupMigrationResolve = undefined;
      app.quit();
    }
  });
  const preloadEntry = startupMigrationHtml();
  try {
    await startupMigrationWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(preloadEntry)}`);
  } catch (error) {
    startupMigrationWindow.destroy();
    startupMigrationWindow = undefined;
    startupMigrationResolve = undefined;
    throw error;
  }
  return completion;
}

function completeStartupMigration() {
  startupMigrationCompleted = true;
  startupMigrationResolve?.(true);
  startupMigrationResolve = undefined;
}

function startupMigrationHtml() {
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

async function withBackendStopped<T>(operation: () => Promise<T>) {
  if (!backend) throw new Error("本地服务尚未启动");
  await backend.stop();
  let result: T | undefined;
  let operationError: unknown;
  try {
    result = await operation();
  } catch (error) {
    operationError = error;
  }
  try {
    backendOrigin = await backend.start();
    backend.monitorUnexpectedExit();
    if (mainWindow && backendOrigin) await mainWindow.loadURL(backendOrigin);
  } catch (restartError) {
    throw new Error(`本地服务重启失败：${message(restartError)}`);
  }
  if (operationError) throw operationError;
  return result!;
}

async function installDownloadedUpdate() {
  if (!backend) throw new Error("本地服务尚未启动");
  await backend.stop();
  quitting = true;
  getDesktopAutoUpdater().quitAndInstall();
}

function scheduleConfiguredUpdateCheck(currentUpdater: DesktopUpdater, settings: { automaticUpdateChecks: boolean }) {
  if (automaticUpdateTimer) clearTimeout(automaticUpdateTimer);
  automaticUpdateTimer = scheduleAutomaticUpdateCheck(currentUpdater, settings);
}

function migrationOptions(layout: ReturnType<typeof createDesktopRuntimeLayout>): DesktopDataMigrationOptions {
  return { dataRoot, storageRoot: layout.storageRoot, configRoot: layout.configRoot };
}

function isSettingsUpdate(value: unknown): value is { startAtLogin?: boolean; automaticUpdateChecks?: boolean } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const update = value as Record<string, unknown>;
  if (Object.keys(update).some((key) => key !== "startAtLogin" && key !== "automaticUpdateChecks")) return false;
  return (
    (update.startAtLogin === undefined || typeof update.startAtLogin === "boolean") &&
    (update.automaticUpdateChecks === undefined || typeof update.automaticUpdateChecks === "boolean")
  );
}

function message(error: unknown) {
  return error instanceof Error && error.message ? error.message : "未知错误";
}

function canWriteDirectory(directory: string, create = false) {
  const probePath = path.join(
    directory,
    `.desktop-write-check-${process.pid}-${crypto.randomBytes(6).toString("hex")}.tmp`
  );
  try {
    if (create) fs.mkdirSync(directory, { recursive: true });
    else if (!fs.statSync(directory).isDirectory()) return false;
    fs.writeFileSync(probePath, "write-check", { flag: "wx" });
    fs.unlinkSync(probePath);
    return true;
  } catch {
    try {
      fs.unlinkSync(probePath);
    } catch {
      // The failed probe is best-effort cleanup; it is never user data.
    }
    return false;
  }
}

function desktopPathsOverlap(leftPath: string, rightPath: string) {
  const left = path.resolve(leftPath).toLowerCase();
  const right = path.resolve(rightPath).toLowerCase();
  const contains = (parent: string, candidate: string) => {
    const relative = path.relative(parent, candidate);
    return !relative || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`));
  };
  return contains(left, right) || contains(right, left);
}

const disabledUpdater: DesktopUpdater = {
  isEnabled: false,
  checkForUpdates: async () => ({ enabled: false, checking: false })
};

function createWindow(origin: string) {
  const preload = path.join(path.dirname(fileURLToPath(import.meta.url)), "preload.cjs");
  mainWindow = new BrowserWindow({
    icon: desktopIconPath,
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 720,
    show: false,
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });
  if (startupMigrationWindow) {
    startupMigrationWindow.close();
    startupMigrationWindow = undefined;
  }
  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isTrustedBackendUrl(url, origin)) return;
    event.preventDefault();
    if (isSafeExternalUrl(url)) void shell.openExternal(url);
  });
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  void mainWindow.loadURL(origin);
}

app.on("window-all-closed", () => app.quit());
app.on("before-quit", (event) => {
  if (quitting) return;
  event.preventDefault();
  quitting = true;
  void (backend?.stop() ?? Promise.resolve()).finally(() => app.exit(0));
});
