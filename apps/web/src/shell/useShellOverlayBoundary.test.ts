// @vitest-environment happy-dom
import { defineComponent, h, ref } from "vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useShellOverlayBoundary } from "./useShellOverlayBoundary";

const callbacks: ResizeObserverCallback[] = [];
const observe = vi.fn(),
  disconnect = vi.fn();
const wrappers: VueWrapper[] = [];
let bottom: number;
beforeEach(() => {
  bottom = 106;
  callbacks.length = 0;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        callbacks.push(callback);
      }
      observe = observe;
      disconnect = disconnect;
    }
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({ bottom }) as DOMRect);
});
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  document.documentElement.style.removeProperty("--shell-overlay-top");
});
function setup(desktop = false) {
  const wrapper = mount(
    defineComponent({
      setup() {
        const header = ref<HTMLElement>();
        useShellOverlayBoundary(header);
        return () =>
          h("main", [
            desktop ? h("div", { class: "desktop-window-titlebar" }) : null,
            h("header", { ref: header }, "工具栏")
          ]);
      }
    })
  );
  wrappers.push(wrapper);
  return wrapper;
}
const inset = () => document.documentElement.style.getPropertyValue("--shell-overlay-top");
describe("弹窗头部边界", () => {
  it("uses the actual desktop titlebar + header bottom and follows window/titlebar geometry changes", () => {
    const wrapper = setup(true);
    expect(inset()).toBe("106px");
    expect(observe).toHaveBeenCalledWith(wrapper.get("header").element);
    expect(observe).toHaveBeenCalledWith(wrapper.get(".desktop-window-titlebar").element);
    bottom = 148.25;
    callbacks[0]([], {} as ResizeObserver);
    expect(inset()).toBe("149px");
    bottom = 108;
    window.dispatchEvent(new Event("resize"));
    expect(inset()).toBe("108px");
  });
  it("supports browser/mobile headers without adding a desktop titlebar offset", () => {
    bottom = 64;
    setup();
    expect(inset()).toBe("64px");
    expect(observe).toHaveBeenCalledTimes(1);
    bottom = 112;
    callbacks[0]([], {} as ResizeObserver);
    expect(inset()).toBe("112px");
    bottom = Number.NaN;
    callbacks[0]([], {} as ResizeObserver);
    expect(inset()).toBe("112px");
  });
  it("cleans observation/global state and prevents a leaving route from overwriting the new shell", () => {
    const old = setup();
    bottom = 64;
    const current = setup();
    bottom = 500;
    callbacks[0]([], {} as ResizeObserver);
    expect(inset()).toBe("64px");
    old.unmount();
    wrappers.splice(wrappers.indexOf(old), 1);
    expect(inset()).toBe("64px");
    current.unmount();
    wrappers.splice(wrappers.indexOf(current), 1);
    expect(inset()).toBe("");
    expect(disconnect).toHaveBeenCalledTimes(2);
    window.dispatchEvent(new Event("resize"));
    expect(inset()).toBe("");
  });
});
