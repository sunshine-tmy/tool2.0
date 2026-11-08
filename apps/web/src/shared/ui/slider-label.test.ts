// @vitest-environment happy-dom
import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { vSliderLabel } from "./slider-label";

describe("slider handle labels", () => {
  it("names the focusable handle and refreshes its readable value", async () => {
    const view = mount(
      defineComponent({
        directives: { sliderLabel: vSliderLabel },
        props: { value: { type: Number, required: true } },
        template: `<div v-slider-label="{ label: '背景音乐音量', text: value + '%' }">
          <span role="slider" tabindex="0"></span>
        </div>`
      }),
      { props: { value: 50 } }
    );
    expect(view.get('[role="slider"]').attributes("aria-label")).toBe("背景音乐音量");
    expect(view.get('[role="slider"]').attributes("aria-valuetext")).toBe("50%");
    await view.setProps({ value: 25 });
    expect(view.get('[role="slider"]').attributes("aria-valuetext")).toBe("25%");
    view.unmount();
  });

  it("assigns separate names and values to range handles", () => {
    const view = mount(
      defineComponent({
        directives: { sliderLabel: vSliderLabel },
        template: `<div v-slider-label="[
          { label: '选段起点', text: '2 秒' }, { label: '选段终点', text: '8 秒' }
        ]"><span role="slider"></span><span role="slider"></span></div>`
      })
    );
    expect(view.findAll('[role="slider"]').map((handle) => handle.attributes("aria-label"))).toEqual([
      "选段起点",
      "选段终点"
    ]);
    expect(view.findAll('[role="slider"]').map((handle) => handle.attributes("aria-valuetext"))).toEqual([
      "2 秒",
      "8 秒"
    ]);
    view.unmount();
  });
});
