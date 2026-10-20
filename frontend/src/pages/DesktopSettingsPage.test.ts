// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mount, flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DesktopSettingsPage from "./DesktopSettingsPage.vue";

const mocks = vi.hoisted(() => ({ settings: vi.fn(), components: vi.fn(), cleanup: vi.fn(), push: vi.fn() }));
vi.mock("vue-router", () => ({ useRoute: () => ({ query: {} }) }));
vi.mock("../layouts/ToolLayout.vue", () => ({ default: { template: "<main><slot /></main>" } }));
vi.mock("../services/lan-access", () => ({
  lanAccessApi: {
    get: vi.fn(async () => ({
      status: "ready",
      urls: ["http://192.168.1.2:5173/"],
      port: 5173,
      toolCount: 8,
      message: "可使用业务模块"
    }))
  }
}));
vi.mock("../composables/useConfirmDialog", () => ({ useConfirmDialog: () => vi.fn() }));
vi.mock("../services/components", () => ({ componentApi: { list: mocks.components }, subscribeComponentJob: vi.fn() }));
vi.mock("../services/http", () => ({
  httpClient: { get: mocks.cleanup },
  formatApiError: (_cause: unknown, fallback: string) => fallback,
  isApiErrorCancelled: () => false
}));
vi.mock("naive-ui", async (original) => ({
  ...(await original<typeof import("naive-ui")>()),
  useMessage: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() })
}));

function renderPage() {
  return mount(DesktopSettingsPage, {
    global: {
      mocks: { $router: { push: mocks.push } },
      stubs: { transition: false, NCode: true }
    }
  });
}

beforeEach(() => {
  mocks.settings.mockResolvedValue({
    platform: "win32",
    startAtLogin: false,
    automaticUpdateChecks: true,
    updateChecksSupported: true,
    installDirectory: "<APP_ROOT>",
    dataDirectory: "<DATA_ROOT>",
    dataDirectoryDescription: "应用数据"
  });
  mocks.components.mockResolvedValue([]);
  mocks.cleanup.mockResolvedValue([]);
  Object.defineProperty(window, "toolboxDesktop", {
    configurable: true,
    value: { getSettings: mocks.settings }
  });
});
afterEach(() => {
  delete window.toolboxDesktop;
  vi.clearAllMocks();
});

describe("desktop settings section spacing", () => {
  it("keeps diagnostic and desktop cards in one spacing container despite the hidden file input", async () => {
    const wrapper = renderPage();
    try {
      await flushPromises();
      const panels = wrapper.findAll(".desktop-settings-main > .workspace-panel");
      expect(panels.map((panel) => panel.get("h3").text())).toEqual([
        "启动与环境诊断",
        "局域网访问",
        "启动与更新",
        "存储位置",
        "存储清理",
        "能力管理",
        "导入旧版数据"
      ]);
      expect(wrapper.get(".desktop-settings-main > .offline-archive-input").attributes("type")).toBe("file");
      await panels[0].get("button").trigger("click");
      expect(mocks.push).toHaveBeenCalledWith("/settings/diagnostics");
    } finally {
      wrapper.unmount();
    }
  });

  it("keeps settings errors in the same container without removing the diagnostic entry", async () => {
    mocks.settings.mockRejectedValueOnce(new Error("unavailable"));
    const wrapper = renderPage();
    try {
      await flushPromises();
      expect(wrapper.get(".desktop-settings-main > .settings-alert").text()).toContain("读取桌面设置失败");
      expect(wrapper.findAll(".desktop-settings-main > .workspace-panel")).toHaveLength(6);
    } finally {
      wrapper.unmount();
    }
  });

  it("uses page-local gap rather than relying on adjacent cards and avoids doubled margins", () => {
    const source = readFileSync(resolve("src/pages/DesktopSettingsPage.vue"), "utf8");
    expect(source).toMatch(
      /\.desktop-settings-main\s*\{\s*display: flex;\s*flex-direction: column;\s*gap: var\(--space-4, 16px\);/
    );
    expect(source).toMatch(
      /\.desktop-settings-main > \.workspace-panel,\s*\.desktop-settings-main > \.settings-alert\s*\{\s*margin: 0;/
    );
    expect(source).toMatch(/\.panel-heading:only-child\s*\{\s*margin-bottom: 0;/);
  });
});
