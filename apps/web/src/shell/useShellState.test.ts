// @vitest-environment happy-dom
import { nextTick, reactive, ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountComposable } from "../__tests__/mount-composable";
import { useShellNavigation } from "./useShellNavigation";
import { useShellServices } from "./useShellServices";
import { useDesktopCapabilityHint } from "../integrations/desktop/useDesktopCapabilityHint";
import { diagnosticConnection } from "../shared/http/diagnostics";
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  snapshot: vi.fn(),
  restore: vi.fn(),
  authenticate: vi.fn(),
  signOut: vi.fn(),
  list: vi.fn(),
  readiness: vi.fn(),
  message: { success: vi.fn(), error: vi.fn() }
}));
const route = reactive({ path: "/tools/image-ai" });
vi.mock("vue-router", () => ({ useRoute: () => route }));
vi.mock("naive-ui", async (original) => ({
  ...(await original<typeof import("naive-ui")>()),
  useMessage: () => mocks.message
}));
vi.mock("../shared/http/http", () => ({
  httpClient: { get: mocks.get },
  formatApiError: () => "会话失败",
  isApiErrorCancelled: () => false
}));
vi.mock("../shared/http/admin-session", () => ({
  restoreAdminSession: mocks.restore,
  authenticateAdmin: mocks.authenticate,
  signOutAdmin: mocks.signOut
}));
vi.mock("../shared/http/diagnostics", () => ({
  diagnosticConnection: ref("online"),
  localDiagnosticsAvailable: true,
  diagnosticsApi: { snapshot: mocks.snapshot }
}));
vi.mock("../integrations/desktop/capabilities", () => ({
  componentApi: { list: mocks.list }
}));
vi.mock("../integrations/desktop/capability-readiness", () => ({
  getToolComponentReadiness: mocks.readiness
}));
const wrappers: Array<{ unmount(): void }> = [];
function setup<T>(create: () => T) {
  const result = mountComposable(create);
  wrappers.push(result.wrapper);
  return result;
}
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  route.path = "/tools/image-ai";
  diagnosticConnection.value = "online";
  mocks.get.mockResolvedValue({ deploymentMode: "lan" });
  mocks.snapshot.mockResolvedValue({ checks: [] });
  mocks.restore.mockResolvedValue(undefined);
  mocks.list.mockImplementation(async () => []);
  mocks.readiness.mockReturnValue({
    registered: true,
    missing: [],
    unresolvedIds: []
  });
});
afterEach(() => {
  for (const w of wrappers.splice(0)) w.unmount();
  document.body.classList.remove("sidebar-drawer-active");
  delete window.toolboxDesktop;
  vi.useRealTimers();
  vi.restoreAllMocks();
});
describe("shell state ownership", () => {
  it("retains runtime IDs and records initial and subsequent tool visits without a second navigation state", async () => {
    const { state, wrapper } = setup(useShellNavigation);
    expect(state.iconByTool["video-subtitle"]).toBeDefined();
    state.startNavigation();
    expect(localStorage.getItem("toolbox:last-tool")).toBe("/tools/image-ai");
    route.path = "/tools/audio-library";
    await nextTick();
    expect(localStorage.getItem("toolbox:last-tool")).toBe("/tools/audio-library");
    route.path = "/";
    await nextTick();
    expect(localStorage.getItem("toolbox:last-tool")).toBe("/tools/audio-library");
    wrapper.unmount();
    route.path = "/tools/base64";
    await nextTick();
    expect(localStorage.getItem("toolbox:last-tool")).toBe("/tools/audio-library");
  });
  it("does not interrupt navigation when preference storage is unavailable", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked storage");
    });
    const { state } = setup(useShellNavigation);
    expect(() => state.startNavigation()).not.toThrow();
    route.path = "/tools/base64";
    await expect(nextTick()).resolves.toBeUndefined();
  });
  it("keeps diagnostic polling owned by the shell and clears its timer on route teardown", async () => {
    vi.useFakeTimers();
    const { state, wrapper } = setup(useShellServices);
    state.startDiagnostics();
    await flushPromises();
    expect(mocks.snapshot).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(15000);
    expect(mocks.snapshot).toHaveBeenLastCalledWith(true);
    expect(mocks.snapshot).toHaveBeenCalledTimes(2);
    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(30000);
    expect(mocks.snapshot).toHaveBeenCalledTimes(2);
  });
  it("restores LAN admin only once, validates explicit login and preserves sign-out errors", async () => {
    const { state } = setup(useShellServices);
    state.openServiceDrawer();
    await flushPromises();
    await state.loadServiceStatus();
    expect(mocks.restore).toHaveBeenCalledOnce();
    expect(state.adminAuthenticated.value).toBe(true);
    expect(state.apiState.value).toBe("online");
    state.adminPin.value = "12";
    await state.loginAdmin();
    expect(mocks.authenticate).not.toHaveBeenCalled();
    state.adminPin.value = "1234";
    await state.loginAdmin();
    expect(mocks.authenticate).toHaveBeenCalledWith("1234");
    expect(state.adminPin.value).toBe("");
    mocks.signOut.mockRejectedValueOnce(new Error("offline"));
    await state.logoutAdmin();
    expect(state.adminError.value).toBe("会话失败");
    expect(state.adminAuthenticated.value).toBe(true);
    await state.logoutAdmin();
    expect(state.adminAuthenticated.value).toBe(false);
  });
  it("keeps service errors local and maps shared diagnostic states without suppressing page use", async () => {
    const { state } = setup(useShellServices);
    mocks.get.mockRejectedValueOnce(new Error("offline"));
    await state.loadServiceStatus();
    expect(state.apiState.value).toBe("offline");
    expect(state.serviceCheckedAt.value).not.toBe("");
    for (const [value, label] of [
      ["offline", "基础服务异常"],
      ["checking", "正在启动"],
      ["partial", "部分能力不可用"],
      ["online", "基础服务正常"]
    ] as const) {
      diagnosticConnection.value = value;
      expect(state.serviceStatusLabel.value).toBe(label);
    }
  });
  it("keeps capability guidance desktop-only and distinguishes checking, missing, unavailable and ready", async () => {
    expect(setup(useDesktopCapabilityHint).state.desktopCapabilityHint.value).toBeUndefined();
    Object.defineProperty(window, "toolboxDesktop", {
      configurable: true,
      value: {}
    });
    const { state } = setup(useDesktopCapabilityHint);
    route.path = "/tools/edge-tts";
    expect(state.desktopCapabilityHint.value?.heading).toBe("正在读取能力状态");
    mocks.readiness.mockReturnValueOnce({
      registered: false,
      missing: [],
      unresolvedIds: []
    });
    await state.loadDesktopComponentStatuses();
    expect(state.desktopCapabilityHint.value?.heading).toBe("尚无已审核安装包");
    mocks.readiness.mockReturnValueOnce({
      registered: true,
      missing: [{ installed: false, displayName: "图片 CPU" }],
      unresolvedIds: ["python-312"]
    });
    await state.loadDesktopComponentStatuses();
    expect(state.desktopCapabilityHint.value?.message).toContain("python-312");
    mocks.list.mockRejectedValueOnce(new Error("offline"));
    await state.loadDesktopComponentStatuses();
    expect(state.desktopCapabilityHint.value?.heading).toBe("暂时无法读取能力状态");
    await state.loadDesktopComponentStatuses();
    expect(state.desktopCapabilityHint.value).toBeUndefined();
  });
});
