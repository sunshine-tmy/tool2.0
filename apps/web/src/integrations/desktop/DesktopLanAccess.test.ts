// @vitest-environment happy-dom
import { mount, flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NPopover, NSelect } from "naive-ui";
import DesktopLanAccess from "./DesktopLanAccess.vue";

const mocks = vi.hoisted(() => ({ get: vi.fn(), copy: vi.fn(), qr: vi.fn(), success: vi.fn(), warning: vi.fn() }));
vi.mock("./lan-access", () => ({ lanAccessApi: { get: mocks.get } }));
vi.mock("../../shared/utils/clipboard", () => ({ copyTextToClipboard: mocks.copy }));
vi.mock("qrcode", () => ({ default: { toDataURL: mocks.qr } }));
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
  mocks.qr.mockReset().mockResolvedValue("data:image/png;base64,Zmlyc3Q=");
});
afterEach(() => vi.clearAllMocks());

describe("desktop LAN address entry", () => {
  it("shows and copies the actual port and explains shared data and host requirements", async () => {
    const wrapper = mount(DesktopLanAccess, { props: { mode: "panel" } });
    try {
      await flushPromises();
      expect(wrapper.get("input").element.value).toBe("http://192.168.1.241:54321/");
      expect(mocks.qr).toHaveBeenCalledWith("http://192.168.1.241:54321/", {
        width: 180,
        margin: 4,
        errorCorrectionLevel: "M"
      });
      expect(wrapper.get('img[alt="局域网访问二维码"]').attributes("src")).toBe("data:image/png;base64,Zmlyc3Q=");
      expect(wrapper.text()).toContain("手机扫码访问");
      expect(wrapper.text()).toContain("手机与电脑连接同一 Wi-Fi");
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
      expect(wrapper.find('img[alt="局域网访问二维码"]').exists()).toBe(false);
      expect(wrapper.text()).toContain("未检测到局域网地址");
      mocks.get.mockRejectedValueOnce(new Error("offline"));
      await wrapper.get('[aria-label="刷新局域网地址"]').trigger("click");
      await flushPromises();
      expect(wrapper.text()).toContain("读取局域网地址失败");
      expect(wrapper.find('img[alt="局域网访问二维码"]').exists()).toBe(false);
      expect(mocks.qr).toHaveBeenCalledTimes(1);
    } finally {
      wrapper.unmount();
    }
  });
  it("does not fetch or generate a QR code until the topbar popover is opened", async () => {
    const wrapper = mount(DesktopLanAccess);
    try {
      expect(wrapper.find('[aria-label="局域网访问"]').exists()).toBe(true);
      expect(mocks.get).not.toHaveBeenCalled();
      expect(mocks.qr).not.toHaveBeenCalled();
      wrapper.getComponent(NPopover).vm.$emit("update:show", true);
      await flushPromises();
      expect(mocks.get).toHaveBeenCalledTimes(1);
      expect(mocks.qr).toHaveBeenCalledTimes(1);
    } finally {
      wrapper.unmount();
    }
  });
  it("updates the QR code and copied address together when switching network interfaces", async () => {
    const secondUrl = "http://10.0.0.8:54321/";
    mocks.get.mockResolvedValueOnce({ urls: ["http://192.168.1.241:54321/", secondUrl] });
    const wrapper = mount(DesktopLanAccess, { props: { mode: "panel" } });
    try {
      await flushPromises();
      expect(wrapper.get("img").attributes("src")).toBe("data:image/png;base64,Zmlyc3Q=");
      let finish!: (value: string) => void;
      mocks.qr.mockReturnValueOnce(new Promise<string>((resolve) => (finish = resolve)));
      wrapper.getComponent(NSelect).vm.$emit("update:value", secondUrl);
      await flushPromises();
      expect(wrapper.find("img").exists()).toBe(false);
      expect(wrapper.text()).toContain("正在生成二维码");
      finish("data:image/png;base64,c2Vjb25k");
      await flushPromises();
      expect(mocks.qr).toHaveBeenLastCalledWith(secondUrl, expect.any(Object));
      expect(wrapper.get("img").attributes("src")).toBe("data:image/png;base64,c2Vjb25k");
      await wrapper
        .findAll("button")
        .find((button) => button.text().includes("复制地址"))!
        .trigger("click");
      expect(mocks.copy).toHaveBeenLastCalledWith(secondUrl);
    } finally {
      wrapper.unmount();
    }
  });
  it.each(["success", "failure"] as const)(
    "ignores a stale QR generation %s after changing addresses",
    async (outcome) => {
      const secondUrl = "http://10.0.0.8:54321/";
      mocks.get.mockResolvedValueOnce({ urls: ["http://192.168.1.241:54321/", secondUrl] });
      let finish!: (value: string) => void;
      let fail!: (reason: Error) => void;
      mocks.qr.mockReturnValueOnce(
        new Promise<string>((resolve, reject) => {
          finish = resolve;
          fail = reject;
        })
      );
      const wrapper = mount(DesktopLanAccess, { props: { mode: "panel" } });
      try {
        await flushPromises();
        mocks.qr.mockResolvedValueOnce("data:image/png;base64,c2Vjb25k");
        wrapper.getComponent(NSelect).vm.$emit("update:value", secondUrl);
        await flushPromises();
        expect(wrapper.get("img").attributes("src")).toBe("data:image/png;base64,c2Vjb25k");
        if (outcome === "success") finish("data:image/png;base64,c3RhbGU=");
        else fail(new Error("stale failure"));
        await flushPromises();
        expect(wrapper.get("img").attributes("src")).toBe("data:image/png;base64,c2Vjb25k");
        expect(wrapper.text()).not.toContain("二维码生成失败");
      } finally {
        wrapper.unmount();
      }
    }
  );
  it("keeps copying available when QR generation fails", async () => {
    mocks.qr.mockRejectedValueOnce(new Error("encoding failed"));
    const wrapper = mount(DesktopLanAccess, { props: { mode: "panel" } });
    try {
      await flushPromises();
      expect(wrapper.find("img").exists()).toBe(false);
      expect(wrapper.text()).toContain("二维码生成失败，请复制地址访问");
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
});
