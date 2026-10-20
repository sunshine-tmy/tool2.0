// @vitest-environment happy-dom

import { mount } from "@vue/test-utils";
import { NButton } from "naive-ui";
import { describe, expect, it } from "vitest";
import SpeechDetailItemActions from "./SpeechDetailItemActions.vue";
import SaveToAudioLibrary from "../audio-library/SaveToAudioLibrary.vue";

describe.each(["chatterbox", "edge-tts"] as const)("%s detail action toolbar", (engine) => {
  it("uses matching library buttons, small icon buttons and a component-library download link", async () => {
    const item = { id: "item-1", status: "completed", attempt: 2, downloadUrl: "/audio.mp3" };
    const wrapper = mount(SpeechDetailItemActions, {
      props: {
        engine,
        batchId: "batch-1",
        item,
        disableMoveUp: false,
        disableMoveDown: false,
        disableRegenerate: false,
        disableRemove: false,
        regenerating: false
      },
      global: { stubs: { SaveToAudioLibrary: true } }
    });
    try {
      expect(wrapper.getComponent(SaveToAudioLibrary).props()).toMatchObject({
        engine,
        toolbar: true,
        size: "small",
        items: [item]
      });
      const buttons = wrapper.findAllComponents(NButton);
      expect(buttons).toHaveLength(5);
      buttons.forEach((button) => {
        expect(button.props("size")).toBe("small");
        expect(button.find("svg").exists()).toBe(true);
      });
      expect(wrapper.get("a").attributes("href")).toBe("/audio.mp3");
      expect(wrapper.get("a").classes()).toContain("n-button");
      expect(wrapper.find(".download-button").exists()).toBe(false);
      expect(wrapper.get('[aria-label="生成与删除"]').text()).toContain("重新生成");
      for (const label of ["上移", "下移", "重新生成", "删除"]) {
        await buttons.find((button) => button.text() === label)!.trigger("click");
      }
      expect(wrapper.emitted("move")).toEqual([[-1], [1]]);
      expect(wrapper.emitted("regenerate")).toHaveLength(1);
      expect(wrapper.emitted("remove")).toHaveLength(1);

      await wrapper.setProps({
        disableMoveUp: true,
        disableMoveDown: true,
        disableRegenerate: true,
        disableRemove: true,
        regenerating: true
      });
      for (const label of ["上移", "下移", "重新生成", "删除"]) {
        const button = buttons.find((button) => button.text() === label)!;
        expect(button.props("disabled")).toBe(true);
        await button.trigger("click");
      }
      expect(buttons.find((button) => button.text() === "重新生成")!.props("loading")).toBe(true);
      expect(wrapper.emitted("move")).toHaveLength(2);
      expect(wrapper.emitted("regenerate")).toHaveLength(1);
      expect(wrapper.emitted("remove")).toHaveLength(1);
      await wrapper.setProps({ item: { id: "item-1", status: "queued", attempt: 3 } });
      expect(wrapper.find("a").exists()).toBe(false);
    } finally {
      wrapper.unmount();
    }
  });
});
