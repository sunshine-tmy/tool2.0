/**
 * 中文模块说明：测试 apps/web/src/features/content-archive/XhsDetailDrawer.test.ts 中的稳定行为、边界条件和回归场景
 */
// @vitest-environment happy-dom

import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { NModal } from "naive-ui";
import type { ContentArchiveItem } from "@toolbox/shared";
import XhsDetailDrawer from "./XhsDetailDrawer.vue";
import BilingualContent from "./BilingualContent.vue";
import MediaGallery from "./MediaGallery.vue";

const item = {
  id: "archive-1",
  platform: "xiaohongshu",
  contentId: "content-1",
  updatedAt: "2026-09-15T00:00:00.000Z",
  author: { name: "测试作者" },
  translation: undefined
} as unknown as ContentArchiveItem;

describe("归档居中详情弹窗", () => {
  it("保留详情、复制、媒体编辑和删除操作，关闭按钮仍由页面管理开关", async () => {
    // 弹窗只负责展示，删除确认和 API 调用仍由页面容器统一负责。
    const removeItem = vi.fn();
    const ButtonStub = defineComponent({ template: '<button v-bind="$attrs"><slot name="icon" /><slot /></button>' });
    const wrapper = mount(XhsDetailDrawer, {
      props: {
        open: true,
        width: 720,
        detail: item,
        formatDate: () => "刚刚",
        removeItem,
        translateDetail: vi.fn(),
        editTranslation: vi.fn(),
        resetTranslation: vi.fn(),
        hasEdited: () => false,
        zipUrl: (id: string) => `/zip/${id}`
      },
      global: {
        stubs: {
          NButton: ButtonStub,
          MediaGallery: true,
          BilingualContent: true,
          Languages: true,
          Trash2: true
        }
      },
      attachTo: document.body
    });

    expect(wrapper.getComponent(NModal).props()).toMatchObject({ preset: "card", transformOrigin: "center" });
    expect(document.body.textContent).toContain("测试作者");
    const dialog = document.body.querySelector<HTMLElement>(".archive-detail-modal")!;
    expect(dialog.style.width).toBe("720px");
    expect(dialog.style.maxHeight).toBe("calc(100dvh - 48px)");
    wrapper.findComponent(MediaGallery).vm.$emit("editAudio", "video-123");
    expect(wrapper.emitted("editAudio")).toEqual([["video-123"]]);
    wrapper.findComponent(MediaGallery).vm.$emit("editWatermark", "video-456");
    expect(wrapper.emitted("editWatermark")).toEqual([["video-456"]]);
    wrapper.findComponent(BilingualContent).vm.$emit("copy", "抽屉标题", "标题");
    expect(wrapper.emitted("copy")).toEqual([["抽屉标题", "标题"]]);
    const deleteButton = Array.from(document.body.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("删除存档")
    );
    deleteButton?.click();
    expect(removeItem).toHaveBeenCalledOnce();
    dialog.querySelector<HTMLElement>(".n-card-header__close")!.click();
    expect(wrapper.emitted("update:open")).toEqual([[false]]);
    wrapper.unmount();
  });
});
