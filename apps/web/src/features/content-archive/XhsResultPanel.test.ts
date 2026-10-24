/**
 * 中文模块说明：测试 apps/web/src/features/content-archive/XhsResultPanel.test.ts 中的稳定行为、边界条件和回归场景
 */
// @vitest-environment happy-dom

import { defineComponent } from "vue";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import type { ContentArchiveItem } from "@toolbox/shared";
import XhsResultPanel from "./XhsResultPanel.vue";

const item = {
  id: "archive-1",
  platform: "xiaohongshu",
  contentId: "content-1",
  canonicalUrl: "https://www.xiaohongshu.com/explore/archive-1",
  updatedAt: "2026-09-15T00:00:00.000Z",
  warnings: [],
  author: { name: "测试作者" },
  translation: undefined
} as unknown as ContentArchiveItem;

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
    const heading = wrapper.get(".result-head");
    expect(heading.element.children).toHaveLength(2);
    expect(heading.get(".result-summary .result-title").text()).toContain("已存档");
    expect(heading.get(".result-summary h3").text()).toBe("获取结果");
    expect(heading.get('[role="group"][aria-label="归档结果操作"]').findAll("button, a")).toHaveLength(9);
    const buttons = wrapper.findAll("button");
    await buttons[0]?.trigger("click");
    await buttons[1]?.trigger("click");
    await buttons.find((button) => button.text() === "重新获取")?.trigger("click");
    await buttons.find((button) => button.text() === "生成英文")?.trigger("click");
    expect(copyDescription).toHaveBeenCalledOnce();
    expect(copyCurrent).toHaveBeenCalledWith("zh");
    expect(refreshItem).toHaveBeenCalledWith("archive-1");
    expect(translateCurrent).toHaveBeenCalledOnce();
    await wrapper.setProps({ hasEdited: () => true });
    expect(wrapper.get(".result-actions").findAll("button, a")).toHaveLength(10);
    expect(wrapper.get(".result-summary p").text()).toBe("内容和媒体已保存到本机，可随时预览或下载。");
    wrapper.unmount();
  });
  it("keeps the heading above a wrapping toolbar at every viewport size without fixed minimum media columns", () => {
    const source = readFileSync(resolve("src/features/content-archive/XhsResultPanel.vue"), "utf8");
    const heading = source.match(/\.result-head\s*\{([^}]+)\}/)![1];
    const actions = source.match(/\.result-actions\s*\{([^}]+)\}/)![1];
    expect(heading).toContain("flex-direction: column;");
    expect(heading).toContain("align-items: stretch;");
    expect(actions).toContain("flex-wrap: wrap;");
    expect(actions).toContain("justify-content: flex-start;");
    expect(actions).toContain("width: 100%;");
    expect(source).toContain("grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);");
    expect(source).not.toContain("minmax(420px, 560px)");
  });
});
