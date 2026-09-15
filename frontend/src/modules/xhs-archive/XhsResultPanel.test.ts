// @vitest-environment happy-dom

import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import type { XhsArchiveItem } from "@toolbox/shared";
import XhsResultPanel from "./XhsResultPanel.vue";

const item = {
  id: "archive-1",
  canonicalUrl: "https://www.xiaohongshu.com/explore/archive-1",
  updatedAt: "2026-09-15T00:00:00.000Z",
  warnings: [],
  author: { name: "测试作者" },
  translation: undefined
} as unknown as XhsArchiveItem;

describe("XHS result panel", () => {
  it("renders the result summary and delegates actions", async () => {
    const copyDescription = vi.fn();
    const copyCurrent = vi.fn();
    const refreshItem = vi.fn();
    const translateCurrent = vi.fn();
    const ButtonStub = defineComponent({ template: '<button v-bind="$attrs"><slot name="icon" /><slot /></button>' });
    const wrapper = mount(XhsResultPanel, {
      props: {
        current: item,
        refreshing: false,
        copyDescription,
        copyCurrent,
        zipUrl: (id: string) => `/zip/${id}`,
        refreshItem,
        translateCurrent,
        editTranslation: vi.fn(),
        resetTranslation: vi.fn(),
        hasEdited: () => false,
        formatDate: () => "刚刚"
      },
      global: {
        stubs: {
          NButton: ButtonStub,
          NTag: defineComponent({ template: "<span><slot /></span>" }),
          NAlert: defineComponent({ template: "<div><slot /></div>" }),
          MediaGallery: true,
          BilingualContent: true,
          Copy: true,
          ExternalLink: true,
          Languages: true,
          PackageOpen: true,
          RefreshCw: true
        }
      }
    });

    expect(wrapper.text()).toContain("获取结果");
    const buttons = wrapper.findAll("button");
    await buttons[0]?.trigger("click");
    await buttons[1]?.trigger("click");
    await buttons.find((button) => button.text() === "重新获取")?.trigger("click");
    await buttons.find((button) => button.text() === "生成英文")?.trigger("click");
    expect(copyDescription).toHaveBeenCalledOnce();
    expect(copyCurrent).toHaveBeenCalledWith("zh");
    expect(refreshItem).toHaveBeenCalledWith("archive-1");
    expect(translateCurrent).toHaveBeenCalledOnce();
  });
});
