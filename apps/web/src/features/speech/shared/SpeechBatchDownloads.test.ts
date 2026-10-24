// @vitest-environment happy-dom

import { mount } from "@vue/test-utils";
import { NButton } from "naive-ui";
import { describe, expect, it } from "vitest";
import SpeechBatchDownloads from "./SpeechBatchDownloads.vue";

const batch = {
  archiveUrl: "/batch.zip",
  combinedAudioUrl: "/combined.mp3",
  subtitleUrl: "/original.srt",
  translationSubtitleUrl: "/chinese.srt",
  bilingualSubtitleUrl: "/bilingual.srt"
};

describe("Shared speech batch downloads", () => {
  it("keeps only ZIP in batch lists while retaining all downloads for detail views", async () => {
    const wrapper = mount(SpeechBatchDownloads, { props: { batch, compact: true, archiveOnly: true } });
    try {
      expect(wrapper.findAll("a")).toHaveLength(1);
      expect(wrapper.get("a").attributes("title")).toBe("下载全部 ZIP");
      await wrapper.setProps({ archiveOnly: false, compact: false, toolbar: true });
      expect(wrapper.findAll("a")).toHaveLength(5);
    } finally {
      wrapper.unmount();
    }
  });
  it("uses uniform component-library buttons in both batch detail toolbars", () => {
    const wrapper = mount(SpeechBatchDownloads, { props: { batch, toolbar: true } });
    try {
      const buttons = wrapper.findAllComponents(NButton);
      expect(buttons).toHaveLength(5);
      expect(buttons[0].props("type")).toBe("primary");
      buttons.forEach((button, index) => {
        expect(button.props()).toMatchObject({ size: "small", tag: "a" });
        expect(button.attributes("href")).toBe(Object.values(batch)[index]);
        expect(button.find("svg").exists()).toBe(true);
      });
      expect(wrapper.find(".download-button").exists()).toBe(false);
    } finally {
      wrapper.unmount();
    }
  });
  it("uses the same labeled icons and primary ZIP action for both speech engines", () => {
    const wrapper = mount(SpeechBatchDownloads, { props: { batch } });
    try {
      const links = wrapper.findAll("a");
      expect(links).toHaveLength(5);
      expect(wrapper.get(".download-button.primary").text()).toBe("下载全部 ZIP");
      links.forEach((link, index) => {
        expect(link.find("svg").exists()).toBe(true);
        expect(link.attributes("href")).toBe(Object.values(batch)[index]);
        expect(link.attributes("aria-label")).toBe(link.text());
        expect(link.classes()).toContain("download-button");
      });
    } finally {
      wrapper.unmount();
    }
  });

  it("uses compact icon links in history and hides downloads that are not ready", () => {
    const wrapper = mount(SpeechBatchDownloads, {
      props: { batch: { archiveUrl: batch.archiveUrl, subtitleUrl: batch.subtitleUrl }, compact: true }
    });
    try {
      const links = wrapper.findAll("a");
      expect(links).toHaveLength(2);
      expect(wrapper.find(".download-button").exists()).toBe(false);
      expect(links.map((link) => link.attributes("title"))).toEqual(["下载全部 ZIP", "下载原文 SRT"]);
      links.forEach((link) => {
        expect(link.text()).toBe("");
        expect(link.find("svg").exists()).toBe(true);
        expect(link.attributes("aria-label")).toBe(link.attributes("title"));
      });
    } finally {
      wrapper.unmount();
    }
  });
});
