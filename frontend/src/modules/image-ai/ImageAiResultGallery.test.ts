// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import type { ImageAiTask } from "@toolbox/shared";
import Gallery from "./ImageAiResultGallery.vue";
import BeforeAfterCompare from "./BeforeAfterCompare.vue";

describe("saved image result gallery", () => {
  it("uses the original input index for partially successful saved batches and labels permanent retention", () => {
    const task = {
      id: "saved-task-123",
      operation: "background_remove",
      results: [
        {
          id: "saved-task-123-3",
          originalName: "third.png",
          outputName: "third-cutout.png",
          downloadUrl: "/result.png",
          width: 20,
          height: 20,
          model: "BiRefNet"
        }
      ]
    } as ImageAiTask;
    const wrapper = mount(Gallery, {
      props: { task, sourceFiles: [], persistedSources: true, checkerboard: true },
      global: { stubs: { BeforeAfterCompare: true, NButton: true } }
    });
    expect(wrapper.findComponent(BeforeAfterCompare).props("beforeUrl")).toBe(
      "/api/v1/tools/image-ai/tasks/saved-task-123/inputs/3"
    );
    expect(wrapper.text()).toContain("手动删除前长期保留");
    expect(wrapper.text()).not.toContain("24 小时");
    wrapper.unmount();
  });
});
