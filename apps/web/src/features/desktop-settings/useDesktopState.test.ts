// @vitest-environment happy-dom
import { flushPromises } from "@vue/test-utils";
import { markRaw } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentJob, ComponentPackageStatus } from "@toolbox/shared";
import { mountComposable } from "../../__tests__/mount-composable";
import { useDesktopPreferences } from "./useDesktopPreferences";
import { useDesktopCapabilities } from "./useDesktopCapabilities";
import { useDesktopCleanup } from "./useDesktopCleanup";
const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  revealDataDirectory: vi.fn(),
  checkForUpdates: vi.fn(),
  selectLegacyDataDirectory: vi.fn(),
  importLegacyData: vi.fn(),
  rollbackDataMigration: vi.fn(),
  list: vi.fn(),
  getJob: vi.fn(),
  install: vi.fn(),
  reinstall: vi.fn(),
  uninstall: vi.fn(),
  importOffline: vi.fn(),
  cancel: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  confirm: vi.fn(),
  message: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }
}));
vi.mock("naive-ui", async (original) => ({
  ...(await original<typeof import("naive-ui")>()),
  useMessage: () => mocks.message
}));
vi.mock("vue-router", () => ({ useRoute: () => ({ query: { component: "ffmpeg" } }) }));
vi.mock("../../shared/composables/useConfirmDialog", () => ({ useConfirmDialog: () => mocks.confirm }));
vi.mock("../../integrations/desktop/capabilities", () => ({
  componentApi: mocks,
  subscribeComponentJob: mocks.subscribe
}));
vi.mock("../../shared/http/http", () => ({
  httpClient: { get: mocks.get, post: mocks.post },
  formatApiError: (_e: unknown, fallback: string) => fallback,
  isApiErrorCancelled: () => false
}));
function component(overrides: Partial<ComponentPackageStatus> = {}): ComponentPackageStatus {
  return {
    id: "ffmpeg",
    moduleId: "ffmpeg",
    displayName: "FFmpeg",
    groupId: "shared",
    purpose: "媒体",
    taskToolIds: ["edge-tts"],
    dependencyIds: [],
    dependentIds: [],
    installConditions: [],
    version: "1",
    platform: "win32-x64",
    downloadBytes: 3,
    installedBytes: 10,
    installed: false,
    state: "not-installed",
    health: "unknown",
    licenseName: "MIT",
    licenseUrl: "https://example.test/license",
    ...overrides
  };
}
function job(overrides: Partial<ComponentJob> = {}): ComponentJob {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    componentId: "ffmpeg",
    operation: "install",
    state: "running",
    phase: "downloading",
    progress: { downloadedBytes: 0, totalDownloadBytes: 3, processedFiles: 0, totalFiles: 1, percentage: 0 },
    createdAt: "2026-10-24T00:00:00.000Z",
    updatedAt: "2026-10-24T00:00:00.000Z",
    ...overrides
  };
}
const wrappers: Array<{ unmount(): void }> = [];
const TestAbortController = AbortController;
function setup<T>(create: () => T) {
  const result = mountComposable(create);
  wrappers.push(result.wrapper);
  return result;
}
beforeEach(() => {
  // happy-dom's controller is an ordinary class; real browsers keep this host object non-reactive.
  vi.stubGlobal(
    "AbortController",
    class extends TestAbortController {
      constructor() {
        super();
        markRaw(this);
      }
    }
  );
  vi.clearAllMocks();
  mocks.confirm.mockResolvedValue(true);
  mocks.list.mockResolvedValue([component()]);
  mocks.subscribe.mockReturnValue(mocks.unsubscribe);
  for (const fn of [mocks.install, mocks.reinstall, mocks.uninstall, mocks.importOffline, mocks.cancel, mocks.getJob])
    fn.mockResolvedValue(job());
  mocks.get.mockResolvedValue([]);
  mocks.post.mockResolvedValue([]);
  mocks.getSettings.mockResolvedValue({ startAtLogin: false, lastMigration: { id: "migration", status: "imported" } });
  mocks.updateSettings.mockImplementation(async (value) => value);
  mocks.checkForUpdates.mockResolvedValue({ enabled: true });
  mocks.selectLegacyDataDirectory.mockResolvedValue({
    selectionId: "selection",
    displayName: "旧数据",
    canceled: false
  });
  Object.defineProperty(window, "toolboxDesktop", { configurable: true, value: mocks });
});
afterEach(() => {
  for (const w of wrappers.splice(0)) w.unmount();
  delete window.toolboxDesktop;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("desktop state ownership", () => {
  it("keeps preference updates and controlled migration identifiers behind the existing bridge", async () => {
    const { state } = setup(useDesktopPreferences);
    await state.loadSettings();
    await state.saveStartAtLogin(true);
    await state.saveAutomaticUpdateChecks(false);
    expect(mocks.updateSettings.mock.calls).toEqual([[{ startAtLogin: true }], [{ automaticUpdateChecks: false }]]);
    await state.revealDataDirectory();
    await state.checkForUpdates();
    await state.selectLegacyDirectory();
    expect(mocks.importLegacyData).toHaveBeenCalledWith("selection");
    await state.loadSettings();
    await state.rollbackMigration();
    expect(mocks.rollbackDataMigration).toHaveBeenCalledWith("migration");
  });
  it("does not migrate on canceled selection or confirmation, and remains inert without the bridge", async () => {
    const { state } = setup(useDesktopPreferences);
    mocks.selectLegacyDataDirectory.mockResolvedValueOnce({ canceled: true });
    await state.selectLegacyDirectory();
    mocks.confirm.mockResolvedValueOnce(false);
    await state.selectLegacyDirectory();
    expect(mocks.importLegacyData).not.toHaveBeenCalled();
    delete window.toolboxDesktop;
    const web = setup(useDesktopPreferences).state;
    await web.loadSettings();
    await web.saveStartAtLogin(true);
    expect(web.settings.value).toBeUndefined();
  });
  it("filters cleanup to fixed low-risk log/temp IDs and requires both confirmations", async () => {
    const category = { label: "日志", risk: "low", requiresStop: false, defaults: false, files: 2, bytes: 100 };
    mocks.get.mockResolvedValue([
      { ...category, id: "logs" },
      { ...category, id: "models" },
      { ...category, id: "temp", risk: "high" }
    ]);
    const { state } = setup(useDesktopCleanup);
    await state.loadCleanup();
    expect(state.cleanupCategories.value.map((x) => x.id)).toEqual(["logs"]);
    expect(state.selectedCleanupIds.value).toEqual([]);
    state.selectedCleanupIds.value = ["logs"];
    mocks.confirm.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await state.executeCleanup();
    expect(mocks.post).not.toHaveBeenCalled();
    mocks.post.mockResolvedValue([{ files: 1, skippedFiles: 1 }]);
    await state.executeCleanup();
    expect(mocks.confirm).toHaveBeenCalledTimes(4);
    expect(mocks.post).toHaveBeenCalledWith("/maintenance/cleanup", expect.anything(), { ids: ["logs"] });
    expect(mocks.message.warning).toHaveBeenCalledWith(expect.stringContaining("被占用文件已跳过"));
  });
  it("restores active capability jobs without duplicate subscriptions and releases them on unmount", async () => {
    mocks.list.mockResolvedValue([component({ activeJobId: job().id })]);
    const { state, wrapper } = setup(useDesktopCapabilities);
    await state.loadComponents();
    await state.loadComponents();
    expect(mocks.subscribe).toHaveBeenCalledTimes(1);
    expect(state.componentGroups.value[0].items[0].id).toBe("ffmpeg");
    expect(state.componentTotalLabel.value).toContain("已审核 1 项");
    const onError = mocks.subscribe.mock.calls[0][2] as () => void;
    onError();
    expect(state.componentsNotice.value).toContain("自动重连");
    wrapper.unmount();
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
  });
  it("keeps install/reinstall confirmation, dependency refusal and terminal job cleanup", async () => {
    const { state } = setup(useDesktopCapabilities);
    mocks.confirm.mockResolvedValueOnce(false);
    await state.installComponent(component());
    expect(mocks.install).not.toHaveBeenCalled();
    await state.installComponent(component());
    expect(mocks.install).toHaveBeenCalledWith("ffmpeg");
    const update = mocks.subscribe.mock.calls[0][1] as (value: ComponentJob) => void;
    update(job({ state: "completed" }));
    await flushPromises();
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
    expect(state.componentJobs.value).toEqual({});
    await state.reinstallComponent(component());
    expect(mocks.reinstall).toHaveBeenCalledWith("ffmpeg");
    await state.uninstallComponent(component({ dependentIds: ["edge-tts"] }));
    expect(mocks.uninstall).not.toHaveBeenCalled();
    await state.uninstallComponent(component({ retired: true }));
    expect(mocks.uninstall).toHaveBeenCalledWith("ffmpeg");
    await state.cancelComponentJob(job());
    expect(mocks.cancel).toHaveBeenCalledWith(job().id);
  });
  it("validates complete offline archives and owns upload cancellation on page departure", async () => {
    const { state, wrapper } = setup(useDesktopCapabilities);
    const input = document.createElement("input");
    state.offlineArchiveInput.value = input;
    const click = vi.spyOn(input, "click").mockImplementation(() => undefined);
    state.selectOfflineImport(component());
    expect(click).toHaveBeenCalledOnce();
    const selection = (files: File[]) => ({ currentTarget: { files, value: "selected" } }) as unknown as Event;
    await state.handleOfflineArchiveSelection(selection([new File(["zip"], "bad.zip")]));
    expect(mocks.importOffline).not.toHaveBeenCalled();
    state.selectOfflineImport(component());
    await state.handleOfflineArchiveSelection(selection([new File(["x"], "partial.tar.gz")]));
    expect(mocks.importOffline).not.toHaveBeenCalled();
    let complete!: (value: ComponentJob) => void;
    mocks.importOffline.mockImplementationOnce((_id, _files, options) => {
      options.onProgress(50);
      return new Promise((resolve) => {
        complete = resolve;
      });
    });
    state.selectOfflineImport(component());
    const pending = state.handleOfflineArchiveSelection(selection([new File(["abc"], "complete.tar.gz")]));
    await flushPromises();
    expect(state.offlineUpload.value?.progress).toBe(50);
    const signal = mocks.importOffline.mock.calls[0][2].signal as AbortSignal;
    state.cancelOfflineImport(component());
    expect(signal.aborted).toBe(true);
    wrapper.unmount();
    // Rejection represents the transport honoring abort; no installation starts.
    complete(job({ state: "cancelled" }));
    await pending;
    expect(state.offlineUpload.value).toBeUndefined();
  });
});
