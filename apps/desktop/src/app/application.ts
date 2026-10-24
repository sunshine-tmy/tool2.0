import { createDesktopMaintenance } from "./maintenance";
import { createDesktopQuitFlow } from "./quit-flow";
import { createDesktopPaths } from "../data/desktop-paths";
import { createBusinessWindow } from "../windows/business-window";
import { createStartupMigrationFlow } from "./startup-migration-flow";
import { registerDesktopIpc } from "../ipc/register-desktop-ipc";
import { app, type BrowserWindow, ipcMain, session } from "electron";
import { BackendSupervisor } from "../backend/backend-supervisor";
import { componentProxyUrlFromResolution } from "../backend/system-proxy";
import { recoverDesktopDataMigrations, type DesktopDataMigrationOptions } from "../data/desktop-data-migration";
import { readDesktopSettings } from "../data/desktop-settings";
import { prepareStartupDataMigration } from "../data/desktop-root-migration";
import { createDesktopUpdater, scheduleAutomaticUpdateCheck, type DesktopUpdater } from "../updates/desktop-updater";
import { createDesktopRuntimeLayout, desktopBackendEntrypoint } from "../runtime-layout";
import { StartupDiagnostics } from "./startup-diagnostics";
import { configureApplicationMenu } from "./application-menu";
type DesktopApplicationOptions = {
  preloadPath: string;
  desktopIconPath?: string;
  installRoot: string;
  dataRoot: string;
  legacyDataRoot: string;
};
export function createDesktopApplication(options: DesktopApplicationOptions) {
  const { preloadPath, desktopIconPath, installRoot, dataRoot, legacyDataRoot } = options;
  let mainWindow: BrowserWindow | undefined;
  let backend: BackendSupervisor | undefined;
  let backendOrigin: string | undefined;
  let updater: DesktopUpdater | undefined;
  let automaticUpdateTimer: NodeJS.Timeout | undefined;
  let quitting = false;
  let desktopOperationInProgress = false;
  let audioPlaybackActive = false;
  let startupDiagnostics: StartupDiagnostics | undefined;
  let desktopIpcRegistered = false;
  let versionIpcRegistered = false;

  const { initializeDesktopPaths } = createDesktopPaths({
    installRoot,
    dataRoot,
    legacyDataRoot,
    packaged: app.isPackaged,
    platform: process.platform
  });
  const startupMigration = createStartupMigrationFlow({
    preload: preloadPath,
    desktopIconPath,
    dataRoot,
    legacyDataRoot,
    isOperation: () => desktopOperationInProgress,
    setOperation: (active) => {
      desktopOperationInProgress = active;
    }
  });
  const { withBackendStopped, installDownloadedUpdate } = createDesktopMaintenance({
    getBackend: () => backend,
    getMainWindow: () => mainWindow,
    getBackendOrigin: () => backendOrigin,
    setBackendOrigin: (origin) => {
      backendOrigin = origin;
    },
    isOperation: () => desktopOperationInProgress,
    setOperation: (active) => {
      desktopOperationInProgress = active;
    },
    isPlaybackActive: () => audioPlaybackActive,
    setQuitting: (active) => {
      quitting = active;
    }
  });
  const quitFlow = createDesktopQuitFlow({
    getBackend: () => backend,
    getMainWindow: () => mainWindow,
    clearMainWindow: () => {
      mainWindow = undefined;
    },
    isOperation: () => desktopOperationInProgress,
    isPlaybackActive: () => audioPlaybackActive,
    setPlaybackActive: (active) => {
      audioPlaybackActive = active;
    },
    isQuitting: () => quitting,
    setQuitting: (active) => {
      quitting = active;
    },
    clearAutomaticUpdateTimer: () => {
      if (automaticUpdateTimer) clearTimeout(automaticUpdateTimer);
    }
  });

  async function boot() {
    let pathError: unknown;
    try {
      initializeDesktopPaths();
    } catch (error) {
      pathError = error;
    }
    await app.whenReady();
    startupDiagnostics ??= new StartupDiagnostics({
      dataRoot,
      preload: preloadPath,
      retry: boot
    });
    startupDiagnostics.show();
    startupDiagnostics.stage("storage");
    if (pathError) {
      startupDiagnostics.fail(pathError);
      return;
    }
    configureApplicationMenu();
    if (!versionIpcRegistered) {
      ipcMain.handle("desktop:get-version", () => app.getVersion());
      versionIpcRegistered = true;
    }

    const layout = createDesktopRuntimeLayout({
      packaged: app.isPackaged,
      userDataRoot: dataRoot,
      resourcesPath: process.resourcesPath
    });

    try {
      startupDiagnostics.stage("migration");
      desktopOperationInProgress = true;
      try {
        startupMigration.setState(
          process.platform === "win32"
            ? await prepareStartupDataMigration({ dataRoot, legacyDataRoot })
            : { required: false, destinationDirectory: dataRoot, sourceBytes: 0, sourceFiles: 0 }
        );
      } finally {
        desktopOperationInProgress = false;
      }
      if (startupMigration.getState()!.required) {
        startupMigration.registerIpc();
        const completed = await startupMigration.show(startupMigration.getState()!);
        if (!completed) return;
      }

      // 在后端打开任何数据库或业务文件之前恢复未完成切换，防止半迁移目录被误认为有效数据。
      desktopOperationInProgress = true;
      try {
        await recoverDesktopDataMigrations(migrationOptions(layout));
      } finally {
        desktopOperationInProgress = false;
      }
      startupDiagnostics.stage("proxy");
      const componentProxyUrl = await session.defaultSession
        .resolveProxy("https://github.com")
        .then(componentProxyUrlFromResolution)
        .catch((error) => {
          console.warn("Unable to resolve the system proxy for component downloads", error);
          return undefined;
        });
      startupDiagnostics.stage("process");
      backend = new BackendSupervisor({
        entrypoint: desktopBackendEntrypoint(app.isPackaged, process.resourcesPath),
        runtimeLayout: layout,
        componentProxyUrl,
        bootId: startupDiagnostics.bootId,
        onUnexpectedExit: (message) => {
          startupDiagnostics?.fail(new Error(message), false);
        },
        onStage: (stage) => startupDiagnostics?.stage(stage === "storage" ? "directories" : stage),
        onShutdownStage: quitFlow.showStage
      });
      if (!desktopIpcRegistered) {
        registerDesktopIpc({
          layout,
          installRoot,
          dataRoot,
          getMainWindow: () => mainWindow,
          getBackendOrigin: () => backendOrigin,
          getUpdater: () => updater ?? disabledUpdater,
          setPlaybackActive: (active) => {
            audioPlaybackActive = active;
          },
          scheduleConfiguredUpdateCheck,
          withBackendStopped,
          migrationOptions: migrationOptions(layout)
        });
        desktopIpcRegistered = true;
      }
      backendOrigin = await backend.start();
      backend.monitorUnexpectedExit();
      startupDiagnostics.stage("window");
      await createBusinessWindow({
        origin: backendOrigin,
        preload: preloadPath,
        desktopIconPath,
        getMainWindow: () => mainWindow,
        onCreated: (window) => {
          mainWindow = window;
        },
        closeStartupMigration: startupMigration.closeForMainWindow,
        isQuitting: () => quitting
      });
      startupDiagnostics.ready();
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
      startupDiagnostics.fail(error, backend?.startupTerminated ?? true);
    }
  }
  function scheduleConfiguredUpdateCheck(currentUpdater: DesktopUpdater, settings: { automaticUpdateChecks: boolean }) {
    if (automaticUpdateTimer) clearTimeout(automaticUpdateTimer);
    automaticUpdateTimer = scheduleAutomaticUpdateCheck(currentUpdater, settings);
  }
  function migrationOptions(layout: ReturnType<typeof createDesktopRuntimeLayout>): DesktopDataMigrationOptions {
    return { dataRoot, storageRoot: layout.storageRoot, configRoot: layout.configRoot };
  }
  const disabledUpdater: DesktopUpdater = {
    isEnabled: false,
    checkForUpdates: async () => ({ enabled: false, checking: false })
  };
  function focusMainWindow() {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
  return { boot, focusMainWindow, beforeQuit: quitFlow.beforeQuit };
}
