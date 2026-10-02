// @vitest-environment happy-dom
/** 确保原图保持在左侧、处理结果显示在分隔线右侧，滑块与标签方向一致。 */
import { nextTick } from "vue";
import { mount } from "@vue/test-utils";
import { NSlider } from "naive-ui";
import { describe, expect, it, vi } from "vitest";
import BeforeAfterCompare from "./BeforeAfterCompare.vue";

describe("处理前后图片对比", () => {
  it("左侧显示原图、右侧显示处理结果，并同步滑块方向", async () => {
    const wrapper = mount(BeforeAfterCompare, {
      props: { beforeUrl: "/original.png", afterUrl: "/enhanced.png" }
    });

    expect(wrapper.get(".compare-before-image").attributes("src")).toBe("/original.png");
    expect(wrapper.get(".compare-after-layer img").attributes("src")).toBe("/enhanced.png");
    expect(wrapper.get(".compare-label.before").text()).toBe("处理前");
    expect(wrapper.get(".compare-label.after").text()).toBe("处理后");
    expect(wrapper.findAll(".compare-slider-row span").map((label) => label.text())).toEqual(["处理前", "处理后"]);
    expect(wrapper.get(".compare-after-layer").attributes("style")).toContain("inset(0 0 0 50%)");

    wrapper.findComponent(NSlider).vm.$emit("update:value", 35);
    await nextTick();
    expect(wrapper.get(".compare-after-layer").attributes("style")).toContain("inset(0 0 0 35%)");
    expect(wrapper.get(".compare-divider").attributes("style")).toContain("left: 35%");

    vi.spyOn(wrapper.get(".compare-stage").element, "getBoundingClientRect").mockReturnValue({
      left: 100,
      width: 800
    } as DOMRect);
    const divider = wrapper.get(".compare-divider");
    await divider.trigger("pointerdown", { clientX: 300, pointerId: 1, pointerType: "mouse", button: 0 });
    await divider.trigger("pointermove", { clientX: 700, pointerId: 1, pointerType: "mouse", button: 0 });
    expect(divider.attributes("aria-valuenow")).toBe("75");
    expect(wrapper.get(".compare-after-layer").attributes("style")).toContain("inset(0 0 0 75%)");
    expect(divider.attributes("style")).toContain("left: 75%");

    await divider.trigger("pointerup", { pointerId: 1 });
    await divider.trigger("pointermove", { clientX: 900, pointerId: 1 });
    expect(divider.attributes("aria-valuenow")).toBe("75");
  });
});
