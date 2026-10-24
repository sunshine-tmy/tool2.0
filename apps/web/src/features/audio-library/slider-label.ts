/** 为组件库内部实际获得焦点的滑块手柄补充名称和可读数值。 */
import type { DirectiveBinding, ObjectDirective } from "vue";
type Label = { label: string; text: string };
type SliderLabel = Label | Label[];
const labelSlider = (el: HTMLElement, { value }: DirectiveBinding<SliderLabel>) => {
  const labels = Array.isArray(value) ? value : [value];
  el.querySelectorAll('[role="slider"]').forEach((handle, index) => {
    const label = labels[index];
    if (label) {
      handle.setAttribute("aria-label", label.label);
      handle.setAttribute("aria-valuetext", label.text);
    }
  });
};
export const vSliderLabel: ObjectDirective<HTMLElement, SliderLabel> = { mounted: labelSlider, updated: labelSlider };
