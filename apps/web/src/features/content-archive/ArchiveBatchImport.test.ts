// @vitest-environment happy-dom
import { defineComponent } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ArchiveImportBatch, ArchiveImportPreview } from "@toolbox/shared";
import ArchiveBatchImport from "./ArchiveBatchImport.vue";
import { NInput, NSelect } from "naive-ui";
const mocks = vi.hoisted(() => ({
  preview: vi.fn(),
  create: vi.fn(),
  list: vi.fn().mockResolvedValue([]),
  get: vi.fn(),
  retry: vi.fn(),
  cancel: vi.fn(),
  remove: vi.fn(),
  profileGet: vi.fn(),
  profileRemove: vi.fn(),
  profileCancel: vi.fn(),
  error: vi.fn(),
  confirm: vi.fn().mockResolvedValue(true)
}));
vi.mock("./content-api", () => ({
  archiveImportApi: mocks,
  tiktokProfileApi: { get: mocks.profileGet, remove: mocks.profileRemove, cancel: mocks.profileCancel },
  archiveImportTemplateUrl: () => "/template.csv",
  archiveImportResultUrl: (id: string) => `/results/${id}.csv`
}));
vi.mock("naive-ui", async (original) => ({
  ...(await original<object>()),
  useMessage: () => ({ error: mocks.error })
}));
vi.mock("../../shared/composables/useConfirmDialog", () => ({ useConfirmDialog: () => mocks.confirm }));
const preview: ArchiveImportPreview = {
  sourceName: "作品.csv",
  rows: [
    {
      rowNumber: 3,
      inputUrl: "https://vt.tiktok.com/AAAAA/",
      inputPlatform: "",
      platform: "tiktok",
      url: "https://vt.tiktok.com/AAAAA/",
      status: "ready",
      progress: 0,
      message: "可以归档"
    }
  ]
};
const saved: ArchiveImportBatch = {
  ...preview,
  id: "batch_123",
  existing: "skip",
  status: "completed",
  createdAt: "2026-10-26T00:00:00Z",
  updatedAt: "2026-10-26T00:00:00Z",
  rows: [{ ...preview.rows[0]!, status: "completed", progress: 100, message: "归档完成", archiveId: "saved_123" }]
};
const wrappers: ReturnType<typeof mount>[] = [];
const profile = {
  id: "profile_123",
  username: "shop",
  phase: "completed",
  complete: true,
  batchCount: 2,
  discoveredCount: 2,
  archivedCount: 1,
  failedCount: 1,
  skippedCount: 0,
  pendingCount: 0,
  url: "https://www.tiktok.com/@shop",
  message: "已完成",
  createdAt: saved.createdAt,
  updatedAt: saved.updatedAt
};
beforeEach(() => {
  mocks.list.mockResolvedValue([]);
  mocks.confirm.mockResolvedValue(true);
  mocks.profileGet.mockResolvedValue(profile);
  mocks.profileRemove.mockResolvedValue({ removed: true });
});
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.clearAllMocks();
});
function setup() {
  const ModalStub = defineComponent({ props: { show: Boolean }, template: '<div v-if="show"><slot /></div>' });
  const wrapper = mount(ArchiveBatchImport, {
    global: {
      stubs: {
        Teleport: true,
        NModal: ModalStub,
        "n-modal": ModalStub,
        NAlert: defineComponent({ template: "<div><slot /></div>" }),
        NSpin: defineComponent({ template: "<div><slot /></div>" }),
        NSelect: true,
        NEmpty: true
      }
    }
  });
  wrappers.push(wrapper);
  return wrapper;
}
it("previews the selected spreadsheet before confirmation, exports results and opens a saved archive", async () => {
  mocks.preview.mockResolvedValue(preview);
  mocks.create.mockResolvedValue(saved);
  const wrapper = setup();
  await wrapper
    .findAll("button")
    .find((button) => button.text() === "表格批量归档")!
    .trigger("click");
  await flushPromises();
  const excel = wrapper.get('a[download="多媒体批量归档空白模板.xlsx"]');
  expect(excel.text()).toBe("下载 Excel 模板");
  expect(excel.attributes("href")).toContain("archive-import-template.xlsx");
  expect(wrapper.get('a[href="/template.csv"]').text()).toBe("下载 CSV 模板");
  const input = wrapper.get('input[type="file"]');
  Object.defineProperty(input.element, "files", { value: [new File(["links"], "作品.csv")] });
  await input.trigger("change");
  await flushPromises();
  expect(wrapper.text()).toContain("作品.csv");
  expect(wrapper.text()).toContain("可执行 1 条");
  expect(mocks.create).not.toHaveBeenCalled();
  await wrapper.setProps({
    groups: [{ id: "group_123", name: "即将删除的分组", createdAt: saved.createdAt, updatedAt: saved.updatedAt }]
  });
  const target = wrapper
    .findAllComponents(NSelect)
    .find((select) => select.attributes("aria-label") === "导入目标分组")!;
  target.vm.$emit("update:value", "group_123");
  await flushPromises();
  expect(target.props("value")).toBe("group_123");
  await wrapper.setProps({ groups: [] });
  expect(target.props("value")).toBeNull();
  await wrapper
    .findAll("button")
    .find((button) => button.text() === "确认并开始归档")!
    .trigger("click");
  await flushPromises();
  expect(mocks.create.mock.calls[0]?.[0]).toMatchObject({
    existing: "skip",
    rows: [{ rowNumber: 3, inputUrl: preview.rows[0]!.inputUrl }]
  });
  expect(mocks.create.mock.calls[0]?.[0]).not.toHaveProperty("groupId");
  expect(wrapper.text()).toContain("成功 1");
  expect(wrapper.get('a[href="/results/batch_123.csv"]').text()).toBe("导出结果 CSV");
  await wrapper
    .findAll("button")
    .find((button) => button.text() === "查看存档")!
    .trigger("click");
  expect(wrapper.emitted("openArchive")).toEqual([["saved_123"]]);
});
it("requires confirmation to delete only the batch record", async () => {
  mocks.list.mockResolvedValue([saved]);
  mocks.get.mockResolvedValue(saved);
  mocks.remove.mockResolvedValue({ removed: true });
  const wrapper = setup();
  await wrapper
    .findAll("button")
    .find((button) => button.text() === "表格批量归档")!
    .trigger("click");
  await flushPromises();
  await wrapper
    .findAll("button")
    .find((button) => button.text() === "删除批次记录")!
    .trigger("click");
  await flushPromises();
  expect(mocks.confirm).toHaveBeenCalledWith(expect.stringContaining("已归档作品及媒体不会删除"), expect.any(Object));
  expect(mocks.remove).toHaveBeenCalledWith("batch_123", expect.any(AbortSignal));
});
it("shows readable searchable batch cards and confirms cleanup of the exact owning profile and all its batches", async () => {
  const first = { ...saved, sourceName: "TikTok @shop · 第 1 批", ownerProfileId: profile.id };
  const second = { ...first, id: "batch_456", sourceName: "TikTok @shop · 第 2 批" };
  const unrelated = { ...saved, id: "manual_123", sourceName: "其他表格.xlsx" };
  mocks.list.mockResolvedValue([first, second, unrelated]);
  mocks.get.mockImplementation(async (id: string) => [first, second, unrelated].find((batch) => batch.id === id));
  const wrapper = setup();
  await wrapper
    .findAll("button")
    .find((button) => button.text() === "表格批量归档")!
    .trigger("click");
  await flushPromises();
  const cards = () => wrapper.findAll(".archive-import-history-list button");
  expect(cards()).toHaveLength(3);
  expect(cards()[0].text()).toContain(first.sourceName);
  expect(cards()[0].get("time").attributes("datetime")).toBe(first.createdAt);
  expect(wrapper.findAll("col")).toHaveLength(6);
  const calls = mocks.get.mock.calls.length;
  wrapper.getComponent(NInput).vm.$emit("update:value", "第 2 批");
  await flushPromises();
  expect(cards()).toHaveLength(1);
  expect(mocks.get).toHaveBeenCalledTimes(calls);
  await cards()[0].trigger("click");
  await flushPromises();
  expect(mocks.get).toHaveBeenLastCalledWith(second.id, expect.any(AbortSignal));
  expect(cards()[0].attributes("aria-pressed")).toBe("true");
  const cleanup = () => wrapper.findAll("button").find((button) => button.text() === "清理所属主页任务记录")!;
  mocks.confirm.mockResolvedValueOnce(false);
  await cleanup().trigger("click");
  await flushPromises();
  expect(mocks.profileRemove).not.toHaveBeenCalled();
  await cleanup().trigger("click");
  await flushPromises();
  expect(mocks.confirm).toHaveBeenLastCalledWith(
    expect.stringContaining("@shop 的主页任务及其全部批次记录"),
    expect.any(Object)
  );
  expect(mocks.profileRemove).toHaveBeenCalledExactlyOnceWith(profile.id, expect.any(AbortSignal));
  expect(mocks.remove).not.toHaveBeenCalled();
  wrapper.getComponent(NInput).vm.$emit("update:value", "");
  await flushPromises();
  expect(cards()).toHaveLength(1);
  expect(cards()[0].text()).toContain(unrelated.sourceName);
});
it("provides a direct owner link and stop action while disabling cleanup of an active profile", async () => {
  const owned = { ...saved, ownerProfileId: profile.id };
  mocks.list.mockResolvedValue([owned]);
  mocks.get.mockResolvedValue(owned);
  mocks.profileGet.mockResolvedValue({ ...profile, phase: "archiving" });
  const wrapper = setup();
  await wrapper
    .findAll("button")
    .find((button) => button.text() === "表格批量归档")!
    .trigger("click");
  await flushPromises();
  const button = (label: string) => wrapper.findAll("button").find((button) => button.text() === label)!;
  expect(button("清理所属主页任务记录").attributes("disabled")).toBeDefined();
  mocks.profileCancel.mockResolvedValue({ ...profile, phase: "cancelled" });
  mocks.profileGet.mockResolvedValue({ ...profile, phase: "cancelled" });
  await button("停止主页任务").trigger("click");
  await flushPromises();
  expect(mocks.profileCancel).toHaveBeenCalledWith(profile.id, expect.any(AbortSignal));
  expect(button("清理所属主页任务记录").attributes("disabled")).toBeUndefined();
  await button("打开所属主页任务").trigger("click");
  expect(wrapper.emitted("openProfile")).toEqual([[profile.id]]);
});
