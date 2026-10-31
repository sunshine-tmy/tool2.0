// @vitest-environment happy-dom
import { defineComponent, isProxy } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useDataBackup, collectBackupPreferences, applyBackupPreferences } from "./useDataBackup";
import Page from "./page.vue";
import type { BackupState, BackupPreview } from "@toolbox/shared/system";
const mocks = vi.hoisted(() => ({
  state: vi.fn(),
  select: vi.fn(),
  preview: vi.fn(),
  export: vi.fn(),
  import: vi.fn(),
  cancel: vi.fn(),
  rollback: vi.fn(),
  remove: vi.fn(),
  confirm: vi.fn()
}));
vi.mock("../../shared/composables/useConfirmDialog", () => ({ useConfirmDialog: () => mocks.confirm }));
vi.mock("../../shell/ToolLayout.vue", () => ({ default: { template: "<main><slot /></main>" } }));
const wrappers: Array<{ unmount(): void }> = [];
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.state.mockResolvedValue({ operations: [], restorePoints: [] });
  mocks.confirm.mockResolvedValue(true);
  Object.defineProperty(window, "toolboxDesktop", {
    configurable: true,
    value: {
      getDataBackupState: mocks.state,
      selectDataBackup: mocks.select,
      previewDataBackup: mocks.preview,
      exportModuleData: mocks.export,
      importModuleData: mocks.import,
      cancelDataBackup: mocks.cancel,
      rollbackModuleData: mocks.rollback,
      deleteDataRestorePoint: mocks.remove
    }
  });
});
afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount();
  delete window.toolboxDesktop;
  vi.restoreAllMocks();
});
function render() {
  const wrapper = mount(defineComponent({ setup: useDataBackup, template: "<div/>" }));
  wrappers.push(wrapper);
  return wrapper.vm;
}
it("renders the real backup page with progress, total counts and invalid restore-point protection", async () => {
  mocks.state.mockResolvedValue({
    preflight: {
      id: "preflight",
      phase: "预检文件",
      files: 2,
      totalFiles: 3,
      bytes: 0,
      totalBytes: 0,
      cancelable: true
    },
    operations: Array.from({ length: 11 }, (_, index) => ({
      id: `op_${index}`,
      type: "export",
      status: "failed",
      phase: "失败",
      startedAt: "2026-10-30T00:00:00Z",
      restorePointId: "point"
    })),
    restorePoints: [
      {
        id: "point",
        createdAt: "2026-10-30T00:00:00Z",
        modules: ["content-archive"],
        bytes: 123,
        problem: "清单损坏，已保留"
      }
    ]
  });
  const wrapper = mount(Page, { global: { mocks: { $router: { push: vi.fn() } } } });
  wrappers.push(wrapper);
  await flushPromises();
  expect(wrapper.text()).toContain("预检文件");
  expect(wrapper.text()).toContain("共 11 条操作");
  expect(wrapper.text()).toContain("共 1 个恢复点");
  const restoreButton = wrapper.findAll("button").find((button) => button.text() === "恢复到此状态")!;
  expect(restoreButton.attributes("disabled")).toBeDefined();
  expect(wrapper.text()).toContain("清单损坏，已保留");
  await wrapper
    .findAll("button")
    .find((button) => button.text() === "取消操作")!
    .trigger("click");
  await flushPromises();
  expect(mocks.cancel).toHaveBeenCalledWith("preflight");
});
it("explains desktop availability when any required native method is missing", async () => {
  delete window.toolboxDesktop!.previewDataBackup;
  const wrapper = mount(Page, { global: { mocks: { $router: { push: vi.fn() } } } });
  wrappers.push(wrapper);
  await flushPromises();
  expect(wrapper.text()).toContain("请在支持此功能的桌面客户端中操作");
  expect(mocks.state).not.toHaveBeenCalled();
});
it("keeps restore-point and operation pagination independent with totals on every page", async () => {
  mocks.state.mockResolvedValue({
    operations: Array.from({ length: 11 }, (_, index) => ({
      id: `op_${index}`,
      type: "export",
      status: "completed",
      phase: `操作 ${index + 1}`,
      startedAt: "2026-10-30T00:00:00Z"
    })),
    restorePoints: Array.from({ length: 11 }, (_, index) => ({
      id: `point_${index}`,
      createdAt: "2026-10-30T00:00:00Z",
      modules: ["content-archive"],
      bytes: 123,
      problem: `恢复点 ${index + 1} 需要检查`
    }))
  });
  const wrapper = mount(Page, { global: { mocks: { $router: { push: vi.fn() } } } });
  wrappers.push(wrapper);
  await flushPromises();
  const panels = wrapper.findAll(".workspace-panel");
  const operations = panels.find((panel) => panel.find('[aria-label="操作记录分页"]').exists())!;
  const points = panels.find((panel) => panel.find('[aria-label="恢复点分页"]').exists())!;
  expect(operations.findAll(".backup-record")).toHaveLength(10);
  expect(points.findAll(".backup-record")).toHaveLength(10);
  for (const [panel, label, total, lastRecord] of [
    [operations, "操作记录分页", "共 11 条操作", "操作 11"],
    [points, "恢复点分页", "共 11 个恢复点", "恢复点 11 需要检查"]
  ] as const) {
    const pagination = panel.get(`nav[aria-label="${label}"]`);
    await pagination
      .findAll(".n-pagination-item--clickable")
      .find((item) => item.text() === "2")!
      .trigger("click");
    await flushPromises();
    expect(pagination.text()).toContain(total);
    expect(panel.findAll(".backup-record")).toHaveLength(1);
    expect(panel.get(".backup-record").text()).toContain(lastRecord);
    if (panel === operations) expect(points.findAll(".backup-record")).toHaveLength(10);
    else expect(operations.get(".backup-record").text()).toContain("操作 11");
  }
});
const preview: BackupPreview = {
  planId: "plan",
  expiresAt: "2030-01-01",
  mode: "merge",
  createdAt: "2026-01-01",
  appVersion: "1",
  modules: [],
  requiredBytes: 1,
  warnings: []
};
it.each(["export", "preview"] as const)(
  "sends a cloneable module-selection snapshot through the %s desktop boundary",
  async (action) => {
    const vm = render();
    await flushPromises();
    const selections = ["content-archive", "audio-library"] as const;
    const transported: unknown[] = [];
    if (action === "export") {
      vm.exportModules = [...selections];
      expect(isProxy(vm.exportModules)).toBe(true);
      mocks.export.mockImplementation(async (input: unknown) => {
        transported.push(structuredClone(input));
        return { canceled: true };
      });
      await vm.exportData();
    } else {
      vm.selection = { canceled: false, selectionId: "selection" };
      vm.importModules = [...selections];
      expect(isProxy(vm.importModules)).toBe(true);
      mocks.preview.mockImplementation(async (input: unknown) => {
        transported.push(structuredClone(input));
        return preview;
      });
      await vm.inspect();
    }
    expect(vm.error).toBe("");
    expect(transported).toEqual([expect.objectContaining({ modules: [...selections] })]);
    const modules = (action === "export" ? mocks.export : mocks.preview).mock.calls[0][0].modules;
    expect(isProxy(modules)).toBe(false);
    (action === "export" ? vm.exportModules : vm.importModules).pop();
    expect(modules).toEqual(selections);
  }
);
it("exports selected modules and only allowlisted client preferences", async () => {
  localStorage.setItem("toolbox:media-archive:view-mode", "list");
  localStorage.setItem("ADMIN_PIN", "never-export");
  const vm = render();
  await flushPromises();
  vm.exportModules = ["content-archive"];
  mocks.export.mockResolvedValue({ canceled: false, operationId: "op" });
  await vm.exportData();
  expect(mocks.export).toHaveBeenCalledWith({
    modules: ["content-archive"],
    preferences: { "archive.view": "list" },
    clientPreferences: { "archive.view": "list" }
  });
  expect(JSON.stringify(mocks.export.mock.calls)).not.toContain("never-export");
});
it("previews selected package modules and invalidates the plan when mode changes", async () => {
  const vm = render();
  await flushPromises();
  mocks.select.mockResolvedValue({
    canceled: false,
    selectionId: "selection",
    displayName: "backup.zip",
    modules: [{ id: "speech", records: 1, files: 1, bytes: 1, expired: 0 }]
  });
  await vm.selectFile();
  await flushPromises();
  mocks.preview.mockResolvedValue(preview);
  await vm.inspect();
  expect(vm.preview).toEqual(preview);
  expect(mocks.preview).toHaveBeenCalledWith({ selectionId: "selection", modules: ["speech"], mode: "merge" });
  vm.mode = "replace";
  await flushPromises();
  expect(vm.preview).toBeUndefined();
});
it("does not publish a late preview after selections change or after unmount", async () => {
  const vm = render();
  await flushPromises();
  vm.selection = { canceled: false, selectionId: "selection" };
  vm.importModules = ["speech"];
  let resolve!: (value: BackupPreview) => void;
  mocks.preview.mockReturnValue(
    new Promise<BackupPreview>((done) => {
      resolve = done;
    })
  );
  const pending = vm.inspect();
  vm.mode = "replace";
  resolve(preview);
  await pending;
  expect(vm.preview).toBeUndefined();
});
it("requires confirmation before import and leaves cancellation without writes", async () => {
  const vm = render();
  await flushPromises();
  vm.preview = preview;
  mocks.confirm.mockResolvedValue(false);
  await vm.restore();
  expect(mocks.import).not.toHaveBeenCalled();
  mocks.confirm.mockResolvedValue(true);
  await vm.restore();
  expect(mocks.import).toHaveBeenCalledWith("plan", {});
});
it("restores preferences once using the target API namespace and strips unrecognized data", () => {
  const state: BackupState = {
    restorePoints: [],
    operations: [
      {
        id: "op",
        type: "import",
        status: "completed",
        phase: "done",
        files: 1,
        totalFiles: 1,
        bytes: 1,
        totalBytes: 1,
        cancelable: false,
        startedAt: "2026-01-01",
        preferences: {
          "archive.view": "list",
          "audio.lastGroup": "group123",
          "audio.player": JSON.stringify({
            queue: [{ entryId: "entry", itemId: "item123" }],
            volume: 0.5,
            mode: "single"
          }),
          ADMIN_PIN: "bad"
        }
      }
    ]
  };
  expect(applyBackupPreferences(state)).toBe(true);
  expect(applyBackupPreferences(state)).toBe(false);
  expect(localStorage.getItem("ADMIN_PIN")).toBeNull();
  expect(collectBackupPreferences()).toMatchObject({ "archive.view": "list", "audio.lastGroup": "group123" });
  expect(JSON.parse(localStorage.getItem("toolbox-audio-player:/api/v1")!)).not.toHaveProperty("playing");
});
it("confirms rollback and restore-point deletion independently and reports native failures without writes", async () => {
  const vm = render();
  await flushPromises();
  vm.state = {
    operations: [],
    restorePoints: [{ id: "point", createdAt: "2026-10-30", modules: ["speech"], bytes: 10 }]
  };
  await vm.rollback("absent");
  expect(mocks.confirm).not.toHaveBeenCalled();
  mocks.confirm.mockResolvedValue(false);
  await vm.rollback("point");
  await vm.deletePoint("point");
  expect(mocks.rollback).not.toHaveBeenCalled();
  expect(mocks.remove).not.toHaveBeenCalled();
  mocks.confirm.mockResolvedValue(true);
  mocks.rollback.mockRejectedValue(new Error("重启失败，恢复点保留"));
  await vm.rollback("point");
  expect(vm.error).toContain("恢复点保留");
  await vm.deletePoint("point");
  expect(mocks.remove).toHaveBeenCalledWith("point");
  vm.state = {
    operations: Array.from({ length: 11 }, (_, index) => ({
      id: String(index),
      type: "export",
      status: "failed",
      phase: "失败",
      startedAt: "2026-10-30",
      files: 0,
      totalFiles: 0,
      bytes: 0,
      totalBytes: 0,
      cancelable: false
    })),
    restorePoints: Array.from({ length: 21 }, (_, index) => ({
      id: String(index),
      modules: [],
      createdAt: "2026-10-30",
      bytes: 0
    }))
  };
  await flushPromises();
  vm.pointsPage = 3;
  vm.historyPage = 2;
  await vm.refresh();
  await flushPromises();
  expect(vm.pointsPage).toBe(1);
  expect(vm.historyPage).toBe(1);
  mocks.cancel.mockRejectedValue(new Error("正在安全提交"));
  await vm.cancel("active");
  expect(vm.error).toBe("正在安全提交");
});
it("retains current selection when a file dialog is canceled, disables repeat writes while busy and stops late responses after unmount", async () => {
  const vm = render();
  await flushPromises();
  vm.selection = { canceled: false, selectionId: "kept" };
  mocks.select.mockResolvedValue({ canceled: true });
  await vm.selectFile();
  expect(vm.selection.selectionId).toBe("kept");
  vm.includePreferences = false;
  mocks.export.mockResolvedValue({ canceled: true });
  await vm.exportData();
  expect(mocks.export).toHaveBeenCalledWith(expect.not.objectContaining({ preferences: expect.anything() }));
  vm.state = {
    operations: [],
    restorePoints: [],
    preflight: { id: "active", phase: "扫描", files: 0, totalFiles: 0, bytes: 0, totalBytes: 0, cancelable: true }
  };
  mocks.export.mockClear();
  await vm.exportData();
  await vm.deletePoint("point");
  expect(mocks.export).not.toHaveBeenCalled();
  vm.state = { operations: [], restorePoints: [] };
  let resolve!: (value: BackupPreview) => void;
  mocks.preview.mockReturnValue(
    new Promise<BackupPreview>((done) => {
      resolve = done;
    })
  );
  const pending = vm.inspect();
  wrappers.at(-1)!.unmount();
  wrappers.pop();
  resolve(preview);
  await pending;
  expect(vm.preview).toBeUndefined();
});
