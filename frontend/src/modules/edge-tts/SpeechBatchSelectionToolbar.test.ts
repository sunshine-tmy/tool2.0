// @vitest-environment happy-dom

import { shallowMount } from "@vue/test-utils";
import { NButton, NCheckbox } from "naive-ui";
import { describe, expect, it } from "vitest";
import SpeechBatchSelectionToolbar from "./SpeechBatchSelectionToolbar.vue";

describe("Speech batch multi-select toolbar", () => {
  it("shows selection counts, delegates select/delete actions and locks controls during deletion", async () => {
    const wrapper = shallowMount(SpeechBatchSelectionToolbar, {
      props: { selectedCount: 0, checked: false, indeterminate: false, disabled: false, loading: false },
      global: { renderStubDefaultSlot: true }
    });
    try {
      const remove = wrapper.getComponent(NButton);
      const checkbox = wrapper.getComponent(NCheckbox);
      expect(remove.props()).toMatchObject({ disabled: true, size: "small", secondary: true, type: "error" });
      await wrapper.setProps({ selectedCount: 2, indeterminate: true });
      expect(wrapper.text()).toContain("已选 2 个批次");
      expect(checkbox.props("indeterminate")).toBe(true);
      expect(remove.props("disabled")).toBe(false);
      checkbox.vm.$emit("update:checked", true);
      remove.vm.$emit("click");
      expect(wrapper.emitted("selectAll")).toEqual([[true]]);
      expect(wrapper.emitted("remove")).toHaveLength(1);
      await wrapper.setProps({ loading: true });
      expect(checkbox.props("disabled")).toBe(true);
      expect(remove.props("loading")).toBe(true);
    } finally {
      wrapper.unmount();
    }
  });
});
