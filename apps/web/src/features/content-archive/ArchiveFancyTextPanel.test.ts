// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { expect, it } from "vitest";
import Panel from "./ArchiveFancyTextPanel.vue";

it("renders the real flame thumbnail and offers an accessible disabled state", async () => {
  const wrapper = mount(Panel, { props: { disabled: false } });
  try {
    const choice = wrapper.get('button[aria-label="烈焰蓝字"]');
    expect(choice.findAll("path")).toHaveLength(6);
    expect(choice.findAll("text")).toHaveLength(5);
    await choice.trigger("click");
    expect(wrapper.emitted("apply")).toEqual([["flame-blue"]]);
    await wrapper.setProps({ active: "flame-blue", disabled: true });
    expect(choice.attributes("aria-pressed")).toBe("true");
    await choice.trigger("click");
    expect(wrapper.emitted("apply")).toHaveLength(1);
  } finally {
    wrapper.unmount();
  }
});
