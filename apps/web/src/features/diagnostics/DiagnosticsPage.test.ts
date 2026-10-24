// @vitest-environment happy-dom
import { mount, flushPromises } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import DiagnosticsPage from "./DiagnosticsPage.vue";
const mock = vi.hoisted(() => ({
  snapshot: vi.fn(),
  start: vi.fn(),
  get: vi.fn(),
  cancel: vi.fn(),
  report: vi.fn(),
  restart: vi.fn()
}));
vi.mock("../../shared/http/diagnostics", () => ({ diagnosticsApi: mock }));
vi.mock("vue-router", () => ({
  useRoute: () => ({ query: { module: "edge-tts" } }),
  useRouter: () => ({ push: vi.fn() })
}));
vi.mock("../../shell/ToolLayout.vue", () => ({ default: { template: "<main><slot /></main>" } }));
vi.mock("naive-ui", async (original) => ({
  ...(await original<typeof import("naive-ui")>()),
  useDialog: () => ({ warning: vi.fn() }),
  useMessage: () => ({ success: vi.fn(), error: vi.fn() })
}));
const run = {
  id: "test-run",
  depth: "light",
  startedAt: "2026-10-20T01:00:00Z",
  state: "completed",
  phase: "检查完成",
  checks: [
    {
      id: "optional",
      title: "可选能力",
      category: "capability",
      status: "not-installed",
      code: "OPTIONAL_NOT_INSTALLED",
      message: "尚未安装",
      impact: "仅影响此功能",
      suggestion: "按需安装",
      modules: []
    }
  ],
  elapsedMs: 100,
  events: []
};
afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
});
describe("diagnostic page", () => {
  it("shows neutral uninstalled capabilities and real elapsed time", async () => {
    mock.snapshot.mockResolvedValue(run);
    const wrapper = mount(DiagnosticsPage);
    await flushPromises();
    expect(wrapper.text()).toContain("基础服务正常");
    expect(wrapper.text()).toContain("0.1 秒");
    expect(wrapper.text()).not.toContain("发现 1 项");
    wrapper.unmount();
  });
  it("remains available without the backend and gives an honest local diagnostic instruction", async () => {
    mock.snapshot.mockRejectedValue(new Error("connection refused"));
    const wrapper = mount(DiagnosticsPage);
    await flushPromises();
    expect(wrapper.text()).toContain("基础服务暂不可用");
    expect(wrapper.text()).toContain("pnpm run doctor");
    expect(wrapper.text()).toContain("无法据此知道后端退出原因");
    wrapper.unmount();
  });
});
