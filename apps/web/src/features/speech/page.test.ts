// @vitest-environment happy-dom

import { defineComponent, onMounted, onUnmounted, ref } from "vue";
import { flushPromises, mount, shallowMount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import Page from "./page.vue";

vi.mock("naive-ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("naive-ui")>()),
  useMessage: () => ({ success: vi.fn(), error: vi.fn() })
}));
vi.mock("../../shared/composables/useConfirmDialog", () => ({ useConfirmDialog: () => vi.fn() }));
vi.mock("../../shared/composables/useTaskEvents", () => ({
  useTaskEvents: () => ({ task: ref(), error: ref() })
}));
vi.mock("./edge-tts/api", () => ({
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
  it("retains both engine drafts and mounts each engine once across KeepAlive switches", async () => {
    const counts = { mounted: 0, unmounted: 0 };
    const panel = (name: string) =>
      defineComponent({
        name,
        setup() {
          const draft = ref("");
          onMounted(() => {
            counts.mounted++;
          });
          onUnmounted(() => {
            counts.unmounted++;
          });
          return { draft };
        },
        template: '<input v-model="draft" :aria-label="$options.name" />'
      });
    const wrapper = mount(Page, {
      global: {
        stubs: {
          ToolLayout: defineComponent({ template: "<main><slot /></main>" }),
          ToolPageHeader: true,
          ChatterboxPanel: panel("ChatterboxDraft"),
          EdgeTtsPanel: panel("EdgeDraft")
        }
      }
    });
    try {
      const tabs = wrapper.findAll('[role="tab"]');
      await wrapper.get("input").setValue("克隆草稿");
      await tabs[1].trigger("click");
      await wrapper.get("input").setValue("在线草稿");
      await tabs[0].trigger("click");
      expect(wrapper.get<HTMLInputElement>("input").element.value).toBe("克隆草稿");
      await tabs[1].trigger("click");
      expect(wrapper.get<HTMLInputElement>("input").element.value).toBe("在线草稿");
      expect(counts).toEqual({ mounted: 2, unmounted: 0 });
    } finally {
      wrapper.unmount();
    }
    expect(counts).toEqual({ mounted: 2, unmounted: 2 });
  });
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
