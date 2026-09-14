// @vitest-environment happy-dom

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import LanFileListPanel from "./LanFileListPanel.vue";

const file = {
  id: "file_12345",
  originalName: "报告.pdf",
  storedName: "file_12345.pdf",
  mimeType: "application/pdf",
  extension: "pdf",
  size: 2048,
  category: "pdf" as const,
  createdAt: "2026-09-14T08:00:00.000Z",
  expiresAt: "2026-09-17T08:00:00.000Z",
  downloadCount: 3,
  previewable: true,
  previewUrl: "/api/v1/tools/lan-transfer/files/file_12345/preview",
  downloadUrl: "/api/v1/tools/lan-transfer/files/file_12345/download"
};

describe("LAN file list panel", () => {
  it("renders file metadata and emits filter, selection and file actions", async () => {
    const wrapper = mount(LanFileListPanel, {
      props: {
        canReadFiles: true,
        canManageFiles: true,
        files: [file],
        selectedIds: [],
        batchDeleting: false,
        batchDownloading: false,
        pagination: { total: 1, pageCount: 1 },
        categoryOptions: [{ label: "PDF", value: "pdf" }],
        sortOptions: [{ label: "上传时间", value: "createdAt" }],
        sortOrderOptions: [{ label: "降序", value: "desc" }],
        keyword: "",
        category: undefined,
        extension: "",
        sortBy: "createdAt",
        sortOrder: "desc",
        page: 1,
        pageSize: 10
      }
    });

    expect(wrapper.text()).toContain("报告.pdf");
    expect(wrapper.text()).toContain("2.00 KB");
    expect(wrapper.get(`a[href="${file.downloadUrl}"]`).attributes("href")).toBe(file.downloadUrl);

    const filterButton = wrapper.findAll("button").find((button) => button.text().includes("筛选"));
    await filterButton?.trigger("click");
    expect(wrapper.emitted("applyFilters")).toHaveLength(1);

    await wrapper.get('[aria-label="选择 报告.pdf"]').trigger("click");
    expect(wrapper.emitted("toggleFile")).toEqual([[file.id, true]]);

    await wrapper.get('[aria-label="预览 报告.pdf"]').trigger("click");
    expect(wrapper.emitted("preview")).toEqual([[file]]);
  });
});
