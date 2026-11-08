// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mount, flushPromises } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import ToolLayout from "./ToolLayout.vue";
import { diagnosticConnection } from "../shared/http/diagnostics";

vi.mock("naive-ui", async (original) => ({
  ...(await original<typeof import("naive-ui")>()),
  useMessage: () => ({ error: vi.fn(), success: vi.fn() })
}));
vi.mock("../shared/http/diagnostics", async () => ({
  diagnosticConnection: (await import("vue")).ref("online"),
  localDiagnosticsAvailable: true,
  diagnosticsApi: { snapshot: vi.fn(async () => ({ checks: [] })) }
}));
vi.mock("../shared/http/http", () => ({
  httpClient: { get: vi.fn(async () => ({ deploymentMode: "local" })) },
  formatApiError: () => "服务异常",
  isApiErrorCancelled: () => false
}));

afterEach(() => {
  vi.restoreAllMocks();
  diagnosticConnection.value = "online";
  localStorage.clear();
  document.body.classList.remove("sidebar-drawer-active");
  delete window.toolboxDesktop;
});
async function layout(compact = false, path = "/settings/diagnostics") {
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
  await router.push(path);
  await router.isReady();
  const wrapper = mount(ToolLayout, {
    global: { plugins: [router], stubs: { DesktopLanAccess: true } },
    slots: { default: "诊断内容" }
  });
  await flushPromises();
  return { wrapper, router };
}

describe("application shell header layout", () => {
  it("uses homepage navigation instead of keeping a second global sidebar on desktop", async () => {
    Object.defineProperty(window, "toolboxDesktop", {
      configurable: true,
      value: {}
    });
    const { wrapper, router } = await layout();
    try {
      expect(wrapper.find(".sidebar").exists()).toBe(false);
      const entry = wrapper.get('.workspace-breadcrumb a[href="/"]');
      await entry.trigger("click");
      await flushPromises();
      expect(router.currentRoute.value.path).toBe("/");
    } finally {
      wrapper.unmount();
    }
  });
  it("keeps modal masks, transparent hit surfaces and service drawers below the measured header", () => {
    const css = readFileSync(resolve("src/styles/components/shell.css"), "utf8");
    expect(css).toMatch(
      /\.n-modal-mask,\s*\.n-modal-body-wrapper,\s*body > \.n-drawer-container\s*\{\s*top: var\(--shell-overlay-top, 0px\) !important;/
    );
    expect(css).not.toMatch(/\.topbar\s*\{[^}]*z-index:\s*\d{4,}/s);
  });
  it("reserves only the native overlay height for the desktop drag strip and leaves browser layout unchanged", async () => {
    const browser = await layout();
    try {
      expect(browser.wrapper.find(".desktop-window-titlebar").exists()).toBe(false);
      expect(browser.wrapper.classes()).not.toContain("has-desktop-titlebar");
    } finally {
      browser.wrapper.unmount();
    }
    Object.defineProperty(window, "toolboxDesktop", {
      configurable: true,
      value: {}
    });
    const desktop = await layout();
    try {
      expect(desktop.wrapper.classes()).toContain("has-desktop-titlebar");
      const titlebar = desktop.wrapper.get(".desktop-window-titlebar");
      expect(titlebar.text()).toBe("电商工具箱");
      expect(titlebar.attributes("aria-hidden")).toBe("true");
      expect(titlebar.element.nextElementSibling).toBe(desktop.wrapper.get(".topbar").element);
    } finally {
      desktop.wrapper.unmount();
    }
  });
  it("keeps loaded content and the diagnostic action available when the service warning appears, then removes the warning on recovery", async () => {
    diagnosticConnection.value = "offline";
    const { wrapper, router } = await layout(false, "/settings/data-backup");
    try {
      const content = wrapper.get(".content");
      expect(content.text()).toContain("本地服务暂不可用，已加载的内容不会被清除。");
      expect(content.text()).toContain("诊断内容");
      await content.get(".shell-service-warning button").trigger("click");
      await flushPromises();
      expect(router.currentRoute.value).toMatchObject({
        path: "/settings/diagnostics",
        query: { module: "data-backup" }
      });
      expect(content.text()).toContain("诊断内容");
      await router.push("/settings/data-backup");
      diagnosticConnection.value = "online";
      await flushPromises();
      expect(content.find(".shell-service-warning").exists()).toBe(false);
      expect(content.text()).toContain("诊断内容");
    } finally {
      wrapper.unmount();
    }
  });
  it("keeps the desktop LAN panel behind a lazy import instead of expanding the shared entry bundle", () => {
    const source = readFileSync(resolve("src/shell/ToolLayout.vue"), "utf8");
    expect(source).toMatch(
      /defineAsyncComponent\(\(\) => import\("\.\.\/integrations\/desktop\/DesktopLanAccess\.vue"\)\)/
    );
    expect(source).not.toMatch(/import\s+DesktopLanAccess\s+from/);
  });
  it("keeps all settings, admin and status controls in one grid cell", async () => {
    const { wrapper, router } = await layout();
    try {
      expect(wrapper.get(".topbar").element.children).toHaveLength(3);
      const actions = wrapper.get(".topbar-actions");
      expect(actions.findAll("button")).toHaveLength(3);
      expect(actions.text()).toContain("基础服务正常");
      expect(wrapper.find(".sidebar").exists()).toBe(false);
      expect(wrapper.find('.brand[href="/"]').exists()).toBe(true);
      expect(wrapper.find('.workspace-breadcrumb a[href="/"]').exists()).toBe(true);
      await actions.get('[aria-label="桌面设置"]').trigger("click");
      await flushPromises();
      expect(router.currentRoute.value.path).toBe("/settings");
    } finally {
      wrapper.unmount();
    }
  });
  it("keeps homepage and service access on compact layouts without an obsolete drawer", async () => {
    const { wrapper } = await layout(true);
    try {
      expect(wrapper.find(".sidebar-toggle").exists()).toBe(false);
      expect(wrapper.find(".sidebar-backdrop").exists()).toBe(false);
      expect(wrapper.get('.workspace-breadcrumb a[href="/"]').text()).toContain("返回首页");
      expect(wrapper.get(".topbar-actions").text()).toContain("基础服务正常");
    } finally {
      wrapper.unmount();
    }
  });
  it("scopes badge styling and gives the responsive header a dedicated action group", () => {
    const foundation = readFileSync(resolve("src/styles/foundation/shell.css"), "utf8");
    const components =
      readFileSync(resolve("src/styles/components/shell.css"), "utf8") +
      readFileSync(resolve("src/styles/components/responsive.css"), "utf8");
    expect(foundation + components).not.toContain(".sidebar-head span");
    expect(components).toContain(".topbar-actions {");
    expect(components).toContain("grid-template-columns: minmax(220px, var(--sidebar-width)) minmax(0, 1fr) auto;");
    expect(components).toMatch(/\.topbar-actions\s*\{\s*grid-column: 2;\s*grid-row: 1;/);
  });
});
