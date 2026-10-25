/** Application assembly step; called directly on the original Fastify instance. */
import path from "node:path";
import { type AppConfig } from "../config";
import { XhsAuthManager } from "../domains/content-archive/providers/xiaohongshu/auth";
import { XhsRuntimeManager } from "../domains/content-archive/providers/xiaohongshu/runtime";
import { XhsTranslationRuntime } from "../domains/content-archive/core/translation-runtime";
import { XhsArchiveStore } from "../domains/content-archive/compat/xhs/store";
import { bundledComponentCatalogForRuntime } from "../modules/components/catalog";
import { ComponentManager, type ComponentManagerOptions } from "../modules/components/component-manager";
import { createTaskStore } from "../tasks/task-store";
import { createRemoteFetch, type AddressResolver } from "../security/remote-fetch";
import { openToolboxDatabase } from "../database/legacy-migration";
import { FileMetadataRepository } from "../database/file-metadata";
import { configureDesktopCapabilityRuntime } from "../runtime/desktop-capability-runtime";
import { createDesktopComponentSelfTest } from "../modules/components/desktop-component-self-test";
import { DouyinRuntimeManager } from "../domains/content-archive/providers/douyin/douyin-runtime";
import { TikTokRuntime } from "../domains/content-archive/providers/tiktok/runtime";
import { DiagnosticsService } from "../modules/diagnostics/service";

export async function createAppServices(config: AppConfig, remoteAddressResolver?: AddressResolver) {
  const { database } = await openToolboxDatabase(config);
  const fileMetadata = new FileMetadataRepository(database, config.storageRoot);
  const taskStore = createTaskStore(1000, database);
  const remoteFetch = createRemoteFetch({ resolver: remoteAddressResolver });
  const tiktokRuntime = new TikTokRuntime({ proxy: config.tiktokHttpsProxy, resolver: remoteAddressResolver });
  const xhsStore = new XhsArchiveStore(config, database, fileMetadata);
  let stopCapabilityBeforeUninstall: (componentId: string) => Promise<void> = async () => undefined;
  let refreshDesktopCapabilities: NonNullable<ComponentManagerOptions["onAfterMutation"]> = async () => undefined;
  const xhsRuntimeServices: {
    runtime?: XhsRuntimeManager;
    auth?: XhsAuthManager;
    translationRuntime?: XhsTranslationRuntime;
  } = {};
  const diagnosticsState: { service?: DiagnosticsService } = {};
  const componentManager = new ComponentManager({
    root: path.join(config.runtime.runtimeRoot, "packages"),
    catalog: bundledComponentCatalogForRuntime(),
    selfTest: config.desktopManagedCapabilities ? createDesktopComponentSelfTest() : undefined,
    onBeforeUninstall: async (componentId) => {
      await stopCapabilityBeforeUninstall(componentId);
      if (componentId === "xhs-archive") await xhsRuntimeServices.runtime?.stop();
      if (componentId === "xhs-translation") await xhsRuntimeServices.translationRuntime?.stop();
      if (componentId === "xhs-browser") await xhsRuntimeServices.auth?.stop();
      if (componentId === "xhs-browser" || componentId === "douyin-archive") await douyinRuntime?.stop();
    },
    onAfterMutation: (componentId, operation) => refreshDesktopCapabilities(componentId, operation),
    isInUse: (componentId, taskToolIds) =>
      Boolean(diagnosticsState.service?.isBusy(true)) ||
      taskStore
        .list()
        .some(
          (task) => taskToolIds.includes(task.toolId) && (task.status === "pending" || task.status === "running")
        ) ||
      (componentId === "xhs-browser" && Boolean(xhsRuntimeServices.auth?.isActive())) ||
      (["xhs-browser", "douyin-archive"].includes(componentId) && Boolean(douyinRuntime?.isActive()))
  });
  const douyinRuntime: DouyinRuntimeManager = new DouyinRuntimeManager(componentManager, {
    installationMode: config.desktopManagedCapabilities ? "managed" : "automatic",
    installTimeoutMs: config.xhsInstallTimeoutMs
  });
  const desktopCapabilityRuntime = await configureDesktopCapabilityRuntime(config, componentManager);
  stopCapabilityBeforeUninstall = desktopCapabilityRuntime.beforeUninstall;
  refreshDesktopCapabilities = desktopCapabilityRuntime.afterMutation;
  xhsRuntimeServices.runtime = new XhsRuntimeManager(config, componentManager);
  xhsRuntimeServices.auth = new XhsAuthManager(config, componentManager);
  xhsRuntimeServices.translationRuntime = new XhsTranslationRuntime(config, componentManager);
  const xhsRuntime = xhsRuntimeServices.runtime;
  const xhsAuth = xhsRuntimeServices.auth;
  const xhsTranslationRuntime = xhsRuntimeServices.translationRuntime;
  const diagnosticService = new DiagnosticsService(
    config,
    database,
    componentManager,
    (id) => desktopCapabilityRuntime.afterMutation(id, "install"),
    () => Boolean(xhsAuth.isActive() || douyinRuntime.isActive())
  );
  diagnosticsState.service = diagnosticService;
  return {
    database,
    fileMetadata,
    taskStore,
    remoteFetch,
    xhsStore,
    componentManager,
    douyinRuntime,
    tiktokRuntime,
    desktopCapabilityRuntime,
    xhsRuntime,
    xhsAuth,
    xhsTranslationRuntime,
    diagnosticService
  };
}
export type AppServices = Awaited<ReturnType<typeof createAppServices>>;
