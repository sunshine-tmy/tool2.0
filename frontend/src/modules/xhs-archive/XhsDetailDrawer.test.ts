/**
 * 中文模块说明：测试 frontend/src/modules/xhs-archive/XhsDetailDrawer.test.ts 中的稳定行为、边界条件和回归场景
 */
// @vitest-environment happy-dom

import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import type { XhsArchiveItem } from "@toolbox/shared";
import XhsDetailDrawer from "./XhsDetailDrawer.vue";

const item = {
  id: "archive-1",
  updatedAt: "2026-09-15T00:00:00.000Z",
  author: { name: "测试作者" },
  translation: undefined
} as unknown as XhsArchiveItem;

describe("XHS detail drawer", () => {
  it("renders detail metadata and delegates deletion", async () => {
    const removeItem = vi.fn();
    const ButtonStub = defineComponent({ template: '<button v-bind="$attrs"><slot name="icon" /><slot /></button>' });
    const DrawerStub = defineComponent({ template: "<div><slot /></div>" });
    const DrawerContentStub = defineComponent({ template: '<div><slot /><slot name="footer" /></div>' });
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
          NDrawer: DrawerStub,
          NDrawerContent: DrawerContentStub,
          "n-drawer": DrawerStub,
          "n-drawer-content": DrawerContentStub,
          MediaGallery: true,
          BilingualContent: true,
          Languages: true,
          Trash2: true
        }
      },
      attachTo: document.body
    });

    expect(document.body.textContent).toContain("测试作者");
    const deleteButton = Array.from(document.body.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("删除存档")
    );
    deleteButton?.click();
    expect(removeItem).toHaveBeenCalledOnce();
    wrapper.unmount();
  });
});
