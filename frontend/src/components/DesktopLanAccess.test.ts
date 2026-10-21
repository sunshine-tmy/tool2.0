// @vitest-environment happy-dom
import { mount, flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DesktopLanAccess from "./DesktopLanAccess.vue";

const mocks = vi.hoisted(() => ({ get: vi.fn(), copy: vi.fn(), success: vi.fn(), warning: vi.fn() }));
vi.mock("../services/lan-access", () => ({ lanAccessApi: { get: mocks.get } }));
vi.mock("../utils/clipboard", () => ({ copyTextToClipboard: mocks.copy }));
vi.mock("naive-ui", async (original) => ({
  ...(await original<typeof import("naive-ui")>()),
  useMessage: () => mocks
}));
beforeEach(() => {
  mocks.get.mockResolvedValue({
    status: "ready",
    urls: ["http://192.168.1.241:54321/"],
    port: 54321,
    toolCount: 6,
    message: "业务模块可用"
  });
  mocks.copy.mockResolvedValue(undefined);
});
afterEach(() => vi.clearAllMocks());

describe("desktop LAN address entry", () => {
  it("shows and copies the actual port and explains shared data and host requirements", async () => {
    const wrapper = mount(DesktopLanAccess, { props: { mode: "panel" } });
    try {
      await flushPromises();
      expect(wrapper.get("input").element.value).toBe("http://192.168.1.241:54321/");
      expect(wrapper.text()).toContain("访客可操作主机上的业务数据");
      expect(wrapper.text()).toContain("不会自动修改防火墙");
      await wrapper
        .findAll("button")
        .find((button) => button.text().includes("复制地址"))!
        .trigger("click");
      await flushPromises();
      expect(mocks.copy).toHaveBeenCalledWith("http://192.168.1.241:54321/");
      expect(mocks.success).toHaveBeenCalled();
    } finally {
      wrapper.unmount();
    }
  });
  it("refreshes after network changes and removes stale addresses on failures", async () => {
    const wrapper = mount(DesktopLanAccess, { props: { mode: "panel" } });
    try {
      await flushPromises();
      mocks.get.mockResolvedValueOnce({
        status: "no-network",
        urls: [],
        port: 54321,
        toolCount: 6,
        message: "未检测到局域网地址"
      });
      await wrapper.get('[aria-label="刷新局域网地址"]').trigger("click");
      await flushPromises();
      expect(wrapper.find("input").exists()).toBe(false);
      expect(wrapper.text()).toContain("未检测到局域网地址");
      mocks.get.mockRejectedValueOnce(new Error("offline"));
      await wrapper.get('[aria-label="刷新局域网地址"]').trigger("click");
      await flushPromises();
      expect(wrapper.text()).toContain("读取局域网地址失败");
    } finally {
      wrapper.unmount();
    }
  });
  it("does not fetch until the topbar popover is opened", () => {
    const wrapper = mount(DesktopLanAccess);
    try {
      expect(wrapper.find('[aria-label="局域网访问"]').exists()).toBe(true);
      expect(mocks.get).not.toHaveBeenCalled();
    } finally {
      wrapper.unmount();
    }
  });
});
