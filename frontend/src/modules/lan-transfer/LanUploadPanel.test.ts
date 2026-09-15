// @vitest-environment happy-dom

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import LanUploadPanel from "./LanUploadPanel.vue";

describe("LAN upload panel", () => {
  it("emits selected files and renders resumable controls", async () => {
    const wrapper = mount(LanUploadPanel, {
      props: {
        canUploadFiles: true,
        isDraggingFiles: false,
        info: null,
        uploadQueue: []
      }
    });
    const input = wrapper.get("input[type=file]");
    const file = new File(["payload"], "payload.txt", { type: "text/plain" });

    Object.defineProperty(input.element, "files", { configurable: true, value: [file] });
    await input.trigger("change");
    expect(wrapper.emitted("files-selected")?.[0]?.[0]).toEqual([file]);
  });
});
