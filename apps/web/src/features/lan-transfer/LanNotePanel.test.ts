/**
 * 中文模块说明：测试 apps/web/src/features/lan-transfer/LanNotePanel.test.ts 中的稳定行为、边界条件和回归场景
 */
// @vitest-environment happy-dom

import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { NCheckbox, NInput, NPagination } from "naive-ui";
import LanNotePanel from "./LanNotePanel.vue";

const note = {
  id: "note_123456",
  title: "收货码",
  content: "A1B2C3",
  images: [
    {
      id: "image_123456",
      originalName: "截图.png",
      storedName: "image_123456.png",
      mimeType: "image/png",
      extension: "png",
      size: 2048,
      createdAt: "2026-09-14T08:00:00.000Z",
      previewUrl: "/preview.png",
      downloadUrl: "/download.png"
    }
  ],
  createdAt: "2026-09-14T08:00:00.000Z",
  updatedAt: "2026-09-14T08:00:00.000Z",
  expiresAt: "2026-09-17T08:00:00.000Z"
};

describe("LAN note panel", () => {
  it("renders note content and emits selection and content actions", async () => {
    const wrapper = mount(LanNotePanel, {
      props: {
        info: {
          lanUrls: [],
          retentionDays: 3,
          maxFileBytes: 1024,
          maxStorageBytes: 4096,
          usedBytes: 2048,
          noteCount: 1,
          reservedUploadBytes: 0,
          pinRequired: false,
          guestMode: "full",
          authenticated: true
        },
        canUpload: true,
        canRead: true,
        canManage: true,
        title: "",
        content: "",
        images: [],
        publishing: false,
        notes: [note],
        selectedIds: [],
        pageSelection: { checked: false, indeterminate: false },
        batchDeleting: false,
        pagination: { page: 1, pageSize: 20, total: 1, pageCount: 1 }
      }
    });

    expect(wrapper.text()).toContain("收货码");
    expect(wrapper.text()).toContain("A1B2C3");
    expect(wrapper.text()).toContain("截图.png · 2.0 KB");

    await wrapper.get('[aria-label="选择 收货码"]').trigger("click");
    expect(wrapper.emitted("toggle-note")).toEqual([[note.id, true]]);

    const copyTitleButton = wrapper.findAll("button").find((button) => button.text().includes("复制标题"));
    await copyTitleButton?.trigger("click");
    expect(wrapper.emitted("copy-title")).toEqual([[note]]);

    const copyBodyButton = wrapper.findAll("button").find((button) => button.text().includes("复制正文"));
    await copyBodyButton?.trigger("click");
    expect(wrapper.emitted("copy-content")).toEqual([[note]]);

    const publishButton = wrapper.findAll("button").find((button) => button.text().includes("发布图文"));
    await publishButton?.trigger("click");
    expect(wrapper.emitted("publish")).toHaveLength(1);

    const image = new File(["image"], "商品.png", { type: "image/png" });
    await wrapper.setProps({
      images: [{ id: "draft", file: image, previewUrl: "/draft.png" }],
      selectedIds: [note.id],
      pagination: { page: 1, pageSize: 20, total: 30, pageCount: 2 }
    });
    const inputs = wrapper.findAllComponents(NInput);
    inputs[0]!.vm.$emit("update:value", "新标题");
    inputs[1]!.vm.$emit("update:value", "新正文");
    expect(wrapper.emitted("update:title")).toEqual([["新标题"]]);
    expect(wrapper.emitted("update:content")).toEqual([["新正文"]]);
    const fileInput = wrapper.get<HTMLInputElement>('input[type="file"]');
    const picker = vi.spyOn(fileInput.element, "click");
    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("添加图片"))!
      .trigger("click");
    expect(picker).toHaveBeenCalledOnce();
    Object.defineProperty(fileInput.element, "files", { value: [image], configurable: true });
    await fileInput.trigger("change");
    expect(wrapper.emitted("select-images")).toEqual([[[image]]]);
    expect(fileInput.element.value).toBe("");
    await wrapper.get(".lan-note-composer").trigger("paste");
    expect(wrapper.emitted("paste")).toHaveLength(1);
    wrapper.findAllComponents(NCheckbox)[0]!.vm.$emit("update:checked", true);
    expect(wrapper.emitted("toggle-all")).toEqual([[true]]);
    wrapper.getComponent(NPagination).vm.$emit("update:page", 2);
    wrapper.getComponent(NPagination).vm.$emit("update:page-size", 50);
    expect(wrapper.emitted("page-change")).toEqual([[2]]);
    expect(wrapper.emitted("page-size-change")).toEqual([[50]]);
    for (const [label, event, argument] of [
      ["移除", "remove-image", 0],
      ["保留30天", "extend-expiry", note],
      ["复制链接", "copy-image-link", note.images[0]!.previewUrl],
      ["批量删除", "delete-selected", undefined]
    ] as const) {
      await wrapper
        .findAll("button")
        .find((button) => button.text().includes(label))!
        .trigger("click");
      expect(wrapper.emitted(event)).toEqual([argument === undefined ? [] : [argument]]);
    }
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "删除")!
      .trigger("click");
    expect(wrapper.emitted("delete-note")).toEqual([[note]]);
    await wrapper.setProps({ canManage: false, canUpload: false });
    expect(wrapper.find(".lan-note-composer").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("保留30天");
    expect(wrapper.text()).not.toContain("批量删除");
    picker.mockRestore();
    wrapper.unmount();
  });
});
