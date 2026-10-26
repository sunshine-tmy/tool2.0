// @vitest-environment happy-dom
import { defineComponent } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, expect, it, vi } from "vitest";
import type { ArchiveImportBatch, ArchiveImportPreview } from "@toolbox/shared";
import ArchiveBatchImport from "./ArchiveBatchImport.vue";
const mocks = vi.hoisted(() => ({
  preview: vi.fn(),
  create: vi.fn(),
  list: vi.fn().mockResolvedValue([]),
  get: vi.fn(),
  retry: vi.fn(),
  cancel: vi.fn(),
  remove: vi.fn(),
  error: vi.fn(),
  confirm: vi.fn().mockResolvedValue(true)
}));
vi.mock("./content-api", () => ({
  archiveImportApi: mocks,
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
  await wrapper
    .findAll("button")
    .find((button) => button.text() === "确认并开始归档")!
    .trigger("click");
  await flushPromises();
  expect(mocks.create.mock.calls[0]?.[0]).toMatchObject({
    existing: "skip",
    rows: [{ rowNumber: 3, inputUrl: preview.rows[0]!.inputUrl }]
  });
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
