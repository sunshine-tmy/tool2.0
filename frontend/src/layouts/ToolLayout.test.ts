// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mount, flushPromises } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import ToolLayout from "./ToolLayout.vue";

vi.mock("naive-ui", async (original) => ({
  ...(await original<typeof import("naive-ui")>()),
  useMessage: () => ({ error: vi.fn(), success: vi.fn() })
}));
vi.mock("../services/diagnostics", async () => ({
  diagnosticConnection: (await import("vue")).ref("online"),
  localDiagnosticsAvailable: true,
  diagnosticsApi: { snapshot: vi.fn(async () => ({ checks: [] })) }
}));
vi.mock("../services/http", () => ({
  httpClient: { get: vi.fn(async () => ({ deploymentMode: "local" })) },
  formatApiError: () => "服务异常",
  isApiErrorCancelled: () => false
}));

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  document.body.classList.remove("sidebar-drawer-active");
});
async function layout(compact = false) {
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: compact,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }));
  const router = createRouter({
    history: createMemoryHistory(),
    routes: ["/", "/settings", "/settings/diagnostics", "/:pathMatch(.*)*"].map((path) => ({
      path,
      component: { template: "<div />" }
    }))
  });
  await router.push("/settings/diagnostics");
  await router.isReady();
  const wrapper = mount(ToolLayout, { global: { plugins: [router] }, slots: { default: "诊断内容" } });
  await flushPromises();
  return { wrapper, router };
}

describe("application shell header layout", () => {
  it("keeps the desktop LAN panel behind a lazy import instead of expanding the shared entry bundle", () => {
    const source = readFileSync(resolve("src/layouts/ToolLayout.vue"), "utf8");
    expect(source).toMatch(/defineAsyncComponent\(\(\) => import\("\.\.\/components\/DesktopLanAccess\.vue"\)\)/);
    expect(source).not.toMatch(/import\s+DesktopLanAccess\s+from/);
  });
  it("keeps all settings, admin and status controls in one grid cell", async () => {
    const { wrapper, router } = await layout();
    try {
      expect(wrapper.get(".topbar").element.children).toHaveLength(3);
      const actions = wrapper.get(".topbar-actions");
      expect(actions.findAll("button")).toHaveLength(3);
      expect(actions.text()).toContain("基础服务正常");
      expect(wrapper.get(".sidebar-head").find(".sidebar-count").text()).toBe("8");
      expect(wrapper.get(".sidebar-head").find('[aria-label="本地服务与管理员会话"]').exists()).toBe(false);
      await actions.get('[aria-label="桌面设置"]').trigger("click");
      await flushPromises();
      expect(router.currentRoute.value.path).toBe("/settings");
    } finally {
      wrapper.unmount();
    }
  });
  it("retains compact sidebar controls without mixing them with the count badge", async () => {
    const { wrapper } = await layout(true);
    try {
      await wrapper.get('[aria-label="打开工具菜单"]').trigger("click");
      await flushPromises();
      expect(wrapper.classes()).toContain("sidebar-drawer-open");
      expect(wrapper.get(".sidebar-head-actions").find('[aria-label="关闭工具菜单"]').exists()).toBe(true);
      expect(wrapper.get(".sidebar-count").element.children).toHaveLength(0);
    } finally {
      wrapper.unmount();
    }
  });
  it("scopes badge styling and gives the responsive header a dedicated action group", () => {
    const foundation = readFileSync(resolve("src/styles/global.css"), "utf8");
    const components = readFileSync(resolve("src/styles/redesign.css"), "utf8");
    expect(foundation + components).not.toContain(".sidebar-head span");
    expect(components).toContain(".topbar-actions {");
    expect(components).toContain("grid-template-columns: minmax(220px, var(--sidebar-width)) minmax(0, 1fr) auto;");
    expect(components).toMatch(/\.topbar-actions\s*\{\s*grid-column: 2;\s*grid-row: 1;/);
  });
});
