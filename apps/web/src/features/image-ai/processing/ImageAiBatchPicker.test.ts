/**
 * 中文模块说明：测试 apps/web/src/features/image-ai/processing/ImageAiBatchPicker.test.ts 中的稳定行为、边界条件和回归场景
 */
// @vitest-environment happy-dom

import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import ImageAiBatchPicker from "./ImageAiBatchPicker.vue";

describe("image AI batch picker", () => {
  it("validates a new selection, caps it at ten, removes only the requested file and releases replaced previews", async () => {
    const create = vi.spyOn(URL, "createObjectURL").mockImplementation((file) => `blob:${(file as File).name}`);
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const original = new File(["old"], "old.png", { type: "image/png" });
    const wrapper = mount(ImageAiBatchPicker, {
      props: {
        title: "图片",
        hint: "十张",
        files: [original],
        disabled: false,
        validateFile: (file) => file.type === "image/png",
        formatBytes: String
      }
    });
    try {
      const next = Array.from({ length: 12 }, (_, index) => new File(["image"], `${index}.png`, { type: "image/png" }));
      const input = wrapper.get<HTMLInputElement>('input[type="file"]');
      Object.defineProperty(input.element, "files", {
        configurable: true,
        value: [new File(["bad"], "bad.txt"), ...next]
      });
      await input.trigger("change");
      expect(wrapper.emitted("change")?.[0]).toEqual([next.slice(0, 10)]);
      expect(input.element.value).toBe("");
      await wrapper.setProps({ files: next.slice(0, 2) });
      expect(revoke).toHaveBeenCalledWith("blob:old.png");
      await wrapper.get("button").trigger("click");
      expect(wrapper.emitted("change")?.[1]).toEqual([[next[1]]]);
      await wrapper.setProps({ disabled: true });
      expect(input.element.disabled).toBe(true);
    } finally {
      wrapper.unmount();
      create.mockRestore();
      revoke.mockRestore();
    }
  });
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
