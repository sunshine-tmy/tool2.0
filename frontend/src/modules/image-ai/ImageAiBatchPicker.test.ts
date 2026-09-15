// @vitest-environment happy-dom

import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import ImageAiBatchPicker from "./ImageAiBatchPicker.vue";

describe("image AI batch picker", () => {
  it("releases preview object URLs when the picker is unmounted", () => {
    const createObjectUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");
    const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const wrapper = mount(ImageAiBatchPicker, {
      props: {
        title: "添加图片",
        hint: "最多 10 张",
        files: [new File(["image"], "demo.png", { type: "image/png" })],
        disabled: false,
        validateFile: () => true,
        formatBytes: () => "5 B"
      },
      global: {
        stubs: {
          NButton: defineComponent({ template: "<button><slot /></button>" }),
          NEmpty: defineComponent({ template: "<div><slot /></div>" })
        }
      }
    });

    expect(wrapper.text()).toContain("demo.png");
    expect(createObjectUrl).toHaveBeenCalledOnce();
    wrapper.unmount();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:preview");
    createObjectUrl.mockRestore();
    revokeObjectUrl.mockRestore();
  });
});
