// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { DOMWrapper, flushPromises, mount } from "@vue/test-utils";
import ServiceStatusPopover from "./ServiceStatusPopover.vue";

let view: ReturnType<typeof mount> | undefined;
afterEach(() => {
  view?.unmount();
  document.body.innerHTML = "";
});

describe("service status popover", () => {
  it("opens details on click, keeps refresh inside, and updates the dot status", async () => {
    view = mount(ServiceStatusPopover, {
      attachTo: document.body,
      props: { status: "partial", title: "推理服务可用", summary: "4/5 模型可用", loading: false }
    });
    expect(document.querySelector(".service-status-details")).toBeNull();
    const trigger = view.get("button");
    expect(trigger.classes()).toContain("is-partial");
    expect(trigger.text()).toBe("");
    await trigger.trigger("click");
    await flushPromises();
    await vi.waitFor(() => expect(document.querySelector(".service-status-details")).not.toBeNull());
    const details = new DOMWrapper(document.querySelector(".service-status-details")!);
    expect(details.text()).toContain("4/5 模型可用");
    expect(trigger.attributes("aria-expanded")).toBe("true");
    await details.get("button").trigger("click");
    expect(view.emitted("refresh")).toHaveLength(1);
    await view.setProps({ status: "loading", loading: true });
    expect(trigger.classes()).toContain("is-loading");
    expect(details.get("button").attributes("disabled")).toBeDefined();
  });
});
