/**
 * 中文模块说明：测试 frontend/src/components/components.test.ts 中的稳定行为、边界条件和回归场景
 */
// @vitest-environment happy-dom

import { defineComponent, h, nextTick, reactive } from "vue";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RouteLoading from "./RouteLoading.vue";
import ToolPageHeader from "./tool/ToolPageHeader.vue";

const route = reactive({ fullPath: "/broken" });
const push = vi.fn();

vi.mock("vue-router", () => ({
  useRoute: () => route,
  useRouter: () => ({ push })
}));

import UiErrorBoundary from "./UiErrorBoundary.vue";

beforeEach(() => {
  route.fullPath = "/broken";
  push.mockReset();
});

describe("shared UI components", () => {
  it("renders an accessible route loading state", () => {
    const wrapper = mount(RouteLoading);
    expect(wrapper.get("main").attributes()).toMatchObject({
      "aria-label": "正在加载工具",
      "aria-busy": "true"
    });
    expect(wrapper.text()).toContain("工具正在加载，请稍候");
  });

  it("renders page header props and the optional action slot", () => {
    const wrapper = mount(ToolPageHeader, {
      props: { title: "局域网快传", description: "设备间传输", kicker: "本地工具" },
      slots: { actions: '<button type="button">上传</button>' }
    });
    expect(wrapper.get("h2").text()).toBe("局域网快传");
    expect(wrapper.text()).toContain("本地工具");
    expect(wrapper.get("button").text()).toBe("上传");
  });

  it("isolates a child render error and returns to the tool home", async () => {
    const BrokenChild = defineComponent({
      setup() {
        throw new Error("render failed");
      },
      render: () => h("div")
    });
    const wrapper = mount(UiErrorBoundary, {
      slots: { default: () => (route.fullPath === "/broken" ? h(BrokenChild) : h("div", "safe route")) },
      global: {
        stubs: {
          NButton: defineComponent({
            emits: ["click"],
            template: '<button type="button" @click="$emit(\'click\')"><slot /></button>'
          }),
          TriangleAlert: true
        }
      }
    });
    await nextTick();

    expect(wrapper.get('[role="alert"]').text()).toContain("render failed");
    await wrapper.findAll("button")[1].trigger("click");
    route.fullPath = "/";
    await nextTick();
    expect(push).toHaveBeenCalledWith("/");
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });
});
