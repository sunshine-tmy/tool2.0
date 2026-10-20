// @vitest-environment happy-dom

import { ref } from "vue";
import { flushPromises, shallowMount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import Page from "./page.vue";

vi.mock("naive-ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("naive-ui")>()),
  useMessage: () => ({ success: vi.fn(), error: vi.fn() })
}));
vi.mock("../../composables/useConfirmDialog", () => ({ useConfirmDialog: () => vi.fn() }));
vi.mock("../../composables/useTaskEvents", () => ({
  useTaskEvents: () => ({ task: ref(), error: ref() })
}));
vi.mock("./api", () => ({
  edgeTtsApi: {
    health: vi.fn().mockResolvedValue({ available: true }),
    voices: vi.fn().mockResolvedValue({ voices: [] }),
    list: vi.fn().mockResolvedValue({
      tasks: [],
      pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 }
    })
  }
}));

describe("Multilingual speech default engine", () => {
  it("opens reference voice cloning by default and allows switching to and from online voices", async () => {
    const wrapper = shallowMount(Page, { global: { renderStubDefaultSlot: true } });
    await flushPromises();
    const tabs = wrapper.findAll('[role="tab"]');
    expect(tabs[0].text()).toContain("参考音色克隆");
    expect(tabs[1].text()).toContain("在线自然音色");
    expect(tabs[0].attributes("aria-selected")).toBe("true");
    expect(wrapper.findComponent({ name: "ChatterboxPanel" }).exists()).toBe(true);

    await tabs[1].trigger("click");
    expect(tabs[1].attributes("aria-selected")).toBe("true");
    expect(wrapper.findComponent({ name: "ChatterboxPanel" }).exists()).toBe(false);
    expect(wrapper.findComponent({ name: "EdgeTtsPanel" }).exists()).toBe(true);

    await tabs[0].trigger("click");
    expect(tabs[0].attributes("aria-selected")).toBe("true");
    expect(wrapper.findComponent({ name: "ChatterboxPanel" }).exists()).toBe(true);
    wrapper.unmount();
  });
});
