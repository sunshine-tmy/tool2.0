/**
 * 中文模块说明：测试 frontend/src/modules/lan-transfer/LanNotePanel.test.ts 中的稳定行为、边界条件和回归场景
 */
// @vitest-environment happy-dom

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
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

    const copyButton = wrapper.findAll("button").find((button) => button.text().includes("复制文字"));
    await copyButton?.trigger("click");
    expect(wrapper.emitted("copy-content")).toEqual([[note]]);

    const publishButton = wrapper.findAll("button").find((button) => button.text().includes("发布图文"));
    await publishButton?.trigger("click");
    expect(wrapper.emitted("publish")).toHaveLength(1);
  });
});
