/**
 * 中文模块说明：测试 apps/web/src/features/lan-transfer/LanFileListPanel.test.ts 中的稳定行为、边界条件和回归场景
 */
// @vitest-environment happy-dom

import { mount } from "@vue/test-utils";
import { NCheckbox, NInput, NPagination, NSelect } from "naive-ui";
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

    await wrapper.setProps({ selectedIds: [file.id], pagination: { total: 30, pageCount: 3 } });
    const inputs = wrapper.findAllComponents(NInput);
    inputs[0]!.vm.$emit("update:value", "报告");
    inputs[1]!.vm.$emit("update:value", "pdf");
    const selects = wrapper.findAllComponents(NSelect);
    selects[0]!.vm.$emit("update:value", "pdf");
    selects[1]!.vm.$emit("update:value", "size");
    selects[2]!.vm.$emit("update:value", "asc");
    wrapper.findAllComponents(NCheckbox)[0]!.vm.$emit("update:checked", true);
    const pagination = wrapper.getComponent(NPagination);
    pagination.vm.$emit("update:page", 2);
    pagination.vm.$emit("update:page-size", 20);
    for (const [event, value] of [
      ["keyword", "报告"],
      ["extension", "pdf"],
      ["category", "pdf"],
      ["sortBy", "size"],
      ["sortOrder", "asc"],
      ["page", 2],
      ["pageSize", 20]
    ] as const) {
      expect(wrapper.emitted(`update:${event}`)).toEqual([[value]]);
    }
    expect(wrapper.emitted("toggleAll")).toEqual([[true]]);
    expect(wrapper.emitted("pageChange")).toEqual([[]]);
    expect(wrapper.emitted("pageSizeChange")).toEqual([[20]]);
    for (const [label, event] of [
      ["重置", "resetFilters"],
      ["批量下载", "downloadSelected"],
      ["批量删除", "deleteSelected"]
    ] as const) {
      await wrapper
        .findAll("button")
        .find((button) => button.text().includes(label))!
        .trigger("click");
      expect(wrapper.emitted(event)).toEqual([[]]);
    }
    for (const [label, event] of [
      [`复制 ${file.originalName} 的下载链接`, "copyLink"],
      [`将 ${file.originalName} 保留 30 天`, "extendExpiry"],
      [`删除 ${file.originalName}`, "deleteFile"]
    ] as const) {
      await wrapper.get(`[aria-label="${label}"]`).trigger("click");
      expect(wrapper.emitted(event)).toEqual([[file]]);
    }
    await wrapper.setProps({ canManageFiles: false });
    expect(wrapper.find(`[aria-label="删除 ${file.originalName}"]`).exists()).toBe(false);
    expect(wrapper.text()).not.toContain("批量删除");
    wrapper.unmount();
  });
});
