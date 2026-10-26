// @vitest-environment happy-dom
import { defineComponent } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { NInput, NSelect } from "naive-ui";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ArchiveGroup } from "@toolbox/shared/archive";
import ArchiveGroups from "./ArchiveGroups.vue";
const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  save: vi.fn(),
  assign: vi.fn(),
  remove: vi.fn(),
  confirm: vi.fn(),
  error: vi.fn(),
  success: vi.fn()
}));
vi.mock("./content-api", () => ({ archiveGroupApi: mocks }));
vi.mock("naive-ui", async (original) => ({
  ...(await original<object>()),
  useMessage: () => ({ error: mocks.error, success: mocks.success })
}));
vi.mock("../../shared/composables/useConfirmDialog", () => ({ useConfirmDialog: () => mocks.confirm }));
let records: ArchiveGroup[];
const wrappers: ReturnType<typeof mount>[] = [];
const group = (name = "素材", id = "group_123"): ArchiveGroup => ({
  id,
  name,
  createdAt: "2026-10-26T00:00:00Z",
  updatedAt: "2026-10-26T00:00:00Z"
});
beforeEach(() => {
  vi.resetAllMocks();
  records = [group()];
  mocks.list.mockImplementation(async () => [...records]);
  mocks.save.mockImplementation(async (name: string, id?: string) => {
    const result = group(name, id ?? "group_new");
    records = [...records.filter((entry) => entry.id !== result.id), result];
    return result;
  });
  mocks.remove.mockImplementation(async (id: string) => {
    records = records.filter((entry) => entry.id !== id);
    return { removed: true };
  });
  mocks.assign.mockResolvedValue({ updated: 1 });
  mocks.confirm.mockResolvedValue(true);
});
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()));
function setup(groupId = "all") {
  const Modal = defineComponent({
    props: { show: Boolean },
    template: '<div v-if="show"><slot /><slot name="footer" /></div>'
  });
  const wrapper = mount(ArchiveGroups, {
    props: { groupId, selectedIds: ["archive_123"] },
    global: { stubs: { NModal: Modal, "n-modal": Modal, Teleport: true } }
  });
  wrappers.push(wrapper);
  return wrapper;
}
async function click(wrapper: ReturnType<typeof setup>, label: string) {
  await wrapper
    .findAll("button")
    .find((button) => button.text() === label)!
    .trigger("click");
  await flushPromises();
}
it("creates and renames groups, moves only the explicit selection, and ungroups without deleting media", async () => {
  const wrapper = setup();
  await flushPromises();
  expect(wrapper.emitted("loaded")?.[0]?.[0]).toEqual([group()]);
  await click(wrapper, "新建分组");
  wrapper.getComponent(NInput).vm.$emit("update:value", "新品");
  await flushPromises();
  await click(wrapper, "保存分组");
  expect(mocks.save).toHaveBeenCalledWith("新品", undefined, expect.any(AbortSignal));
  expect(wrapper.emitted("update:groupId")?.at(-1)).toEqual(["group_new"]);
  await wrapper.setProps({ groupId: "group_new" });
  await click(wrapper, "重命名分组");
  wrapper.getComponent(NInput).vm.$emit("update:value", "新品素材");
  await flushPromises();
  await click(wrapper, "保存分组");
  expect(mocks.save).toHaveBeenLastCalledWith("新品素材", "group_new", expect.any(AbortSignal));
  wrapper.findAllComponents(NSelect)[1]!.vm.$emit("update:value", "group_new");
  await flushPromises();
  await click(wrapper, "移动所选 1");
  expect(mocks.assign).toHaveBeenLastCalledWith(
    { groupId: "group_new", itemIds: ["archive_123"] },
    expect.any(AbortSignal)
  );
  wrapper.findAllComponents(NSelect)[1]!.vm.$emit("update:value", "ungrouped");
  await flushPromises();
  await click(wrapper, "移动所选 1");
  expect(mocks.assign).toHaveBeenLastCalledWith({ groupId: null, itemIds: ["archive_123"] }, expect.any(AbortSignal));
  expect(wrapper.emitted("changed")).toHaveLength(2);
  mocks.confirm.mockResolvedValueOnce(false);
  await click(wrapper, "删除分组");
  expect(mocks.remove).not.toHaveBeenCalled();
  await click(wrapper, "删除分组");
  expect(mocks.confirm).toHaveBeenCalledWith(
    expect.stringContaining("作品、媒体、翻译和截帧均保留"),
    expect.any(Object)
  );
  expect(mocks.remove).toHaveBeenCalledWith("group_new", expect.any(AbortSignal));
  expect(wrapper.emitted("update:groupId")?.at(-1)).toEqual(["all"]);
});
it("reports request errors and refuses late results or UI updates after unmount", async () => {
  const wrapper = setup("group_123");
  await flushPromises();
  mocks.save.mockRejectedValueOnce(new Error("write failed"));
  await click(wrapper, "重命名分组");
  await click(wrapper, "保存分组");
  expect(mocks.error).toHaveBeenCalledOnce();
  mocks.remove.mockRejectedValueOnce(new Error("delete failed"));
  await click(wrapper, "删除分组");
  expect(mocks.error).toHaveBeenCalledTimes(2);
  mocks.assign.mockRejectedValueOnce(new Error("move failed"));
  wrapper.findAllComponents(NSelect)[1]!.vm.$emit("update:value", "group_123");
  await flushPromises();
  await click(wrapper, "移动所选 1");
  expect(mocks.error).toHaveBeenCalledTimes(3);
  mocks.list.mockRejectedValueOnce(new Error("load failed"));
  await click(wrapper, "刷新分组");
  expect(mocks.error).toHaveBeenCalledTimes(4);
  let resolve!: (groups: ArchiveGroup[]) => void;
  mocks.list.mockReturnValueOnce(
    new Promise<ArchiveGroup[]>((done) => {
      resolve = done;
    })
  );
  const loaded = vi.fn();
  await wrapper.setProps({ onLoaded: loaded });
  await click(wrapper, "刷新分组");
  const signal = mocks.list.mock.calls.at(-1)?.[0] as AbortSignal;
  wrapper.unmount();
  wrappers.splice(wrappers.indexOf(wrapper), 1);
  expect(signal.aborted).toBe(true);
  resolve([group("迟到结果")]);
  await flushPromises();
  expect(loaded).not.toHaveBeenCalled();
});
