// @vitest-environment happy-dom
import { nextTick } from "vue";
import { flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AudioLibraryItemView, AudioLibraryList } from "@toolbox/shared";
import { mountComposable } from "../../__tests__/mount-composable";
import { useAudioLibraryCollection } from "./useAudioLibraryCollection";
import { useAudioLibraryGroups } from "./useAudioLibraryGroups";
import { useAudioLibraryItems } from "./useAudioLibraryItems";
import { useAudioLibraryTransfers } from "./useAudioLibraryTransfers";
import { audioLibraryPlayer as player } from "./player";
import { formatBytes, formatDuration, groupOptions, formatDate } from "./presentation";
import { rememberGroup, storedGroup } from "./preferences";

const mock = vi.hoisted(() => ({
  list: vi.fn(),
  edit: vi.fn(),
  group: vi.fn(),
  removeGroup: vi.fn(),
  move: vi.fn(),
  undo: vi.fn(),
  upload: vi.fn(),
  restore: vi.fn(),
  confirm: vi.fn(),
  message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() }
}));
vi.mock("./api", () => ({ audioLibraryApi: mock }));
vi.mock("naive-ui", async (original) => ({
  ...(await original<typeof import("naive-ui")>()),
  useMessage: () => mock.message
}));
vi.mock("../../shared/composables/useConfirmDialog", () => ({ useConfirmDialog: () => mock.confirm }));

function item(id = "one"): AudioLibraryItemView {
  return {
    id,
    title: id,
    revision: 1,
    language: "ms",
    foreignText: "Text",
    chineseText: "中文",
    note: "",
    groupId: null,
    fileName: "one.wav",
    mimeType: "audio/wav",
    bytes: 100,
    duration: 1,
    sha256: "a".repeat(64),
    source: { kind: "upload" },
    createdAt: "2026-10-24",
    updatedAt: "2026-10-24",
    audioUrl: "/one.wav",
    available: true
  };
}
function list(items = [item()]): AudioLibraryList {
  return {
    libraryId: "library",
    revision: 1,
    items,
    groups: [{ id: "g", name: "分组", parentId: null }],
    total: items.length,
    totalItems: items.length,
    page: 1,
    pageSize: 20,
    usedBytes: 100,
    reservedBytes: 0,
    maxBytes: 10000
  };
}
const wrappers: Array<{ unmount(): void }> = [];
function setup() {
  const mounted = mountComposable(() => {
    const collection = useAudioLibraryCollection();
    const items = useAudioLibraryItems(collection);
    const groups = useAudioLibraryGroups(collection, items.run);
    const refreshQueue = vi.fn().mockResolvedValue(undefined);
    const transfers = useAudioLibraryTransfers(collection, refreshQueue);
    return { collection, items, groups, transfers, refreshQueue };
  });
  wrappers.push(mounted.wrapper);
  return mounted;
}
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  player.clear();
  mock.list.mockResolvedValue(list());
  mock.confirm.mockResolvedValue(true);
  mock.move.mockResolvedValue({ ok: true, undoToken: "undo" });
  mock.undo.mockResolvedValue({ ok: true });
  mock.group.mockResolvedValue({});
  mock.removeGroup.mockResolvedValue({ ok: true });
  mock.edit.mockImplementation(async (_id, draft) => ({ ...item(), ...draft, revision: 2 }));
  mock.upload.mockResolvedValue({ item: item(), existing: false });
  mock.restore.mockResolvedValue({ added: 2, skipped: 1 });
});
afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount();
  player.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("audio library state ownership", () => {
  it("keeps only the latest list response and ignores late responses after unmount", async () => {
    let first!: (value: AudioLibraryList) => void;
    mock.list.mockImplementationOnce(
      () =>
        new Promise<AudioLibraryList>((resolve) => {
          first = resolve;
        })
    );
    const { state, wrapper } = setup();
    await state.collection.load();
    first(list([item("old")]));
    await flushPromises();
    expect(state.collection.data.value?.items[0].id).toBe("one");
    let last!: (value: AudioLibraryList) => void;
    mock.list.mockImplementationOnce(
      () =>
        new Promise<AudioLibraryList>((resolve) => {
          last = resolve;
        })
    );
    const pending = state.collection.load();
    wrapper.unmount();
    last(list([item("late")]));
    await pending;
    expect(state.collection.data.value?.items[0].id).toBe("one");
  });
  it("owns keyword debounce and releases it when leaving, without clearing the application player", async () => {
    vi.useFakeTimers();
    const { state, wrapper } = setup();
    await flushPromises();
    player.add([item()]);
    state.collection.keyword.value = "first";
    await nextTick();
    state.collection.keyword.value = "second";
    await nextTick();
    await vi.advanceTimersByTimeAsync(250);
    expect(mock.list).toHaveBeenLastCalledWith(expect.objectContaining({ keyword: "second", page: 1 }));
    state.collection.keyword.value = "never";
    await nextTick();
    const calls = mock.list.mock.calls.length;
    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(250);
    expect(mock.list).toHaveBeenCalledTimes(calls);
    expect(player.queue).toHaveLength(1);
  });
  it("keeps filter, group selection, page selection and latest error semantics", async () => {
    const { state } = setup();
    await flushPromises();
    const c = state.collection;
    c.selectAll(true);
    expect(c.selected.value).toEqual(["one"]);
    c.toggleItem("one", false);
    expect(c.selected.value).toEqual([]);
    c.selectGroup(["g"]);
    await flushPromises();
    expect(c.groupId.value).toBe("g");
    c.chooseView("incomplete");
    await flushPromises();
    expect(c.groupId.value).toBeNull();
    c.language.value = "en";
    c.source.value = "upload";
    c.sort.value = "title";
    await flushPromises();
    expect(mock.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ view: "incomplete", language: "en", source: "upload", sort: "title" })
    );
    mock.list.mockRejectedValueOnce(new Error("list failed"));
    await c.load();
    expect(c.error.value).toContain("REQUEST_FAILED");
    await c.load();
    expect(c.error.value).toBe("");
  });
  it("saves detail revisions into existing queue entries without replacing the singleton", async () => {
    const { state } = setup();
    await flushPromises();
    player.add([item()]);
    state.items.openDetail(item());
    state.items.draft.title = "updated";
    await state.items.saveDetail();
    expect(mock.edit).toHaveBeenCalledWith("one", expect.objectContaining({ title: "updated", revision: 1 }));
    expect(player.queue[0].item).toMatchObject({ title: "updated", revision: 2 });
  });
  it("owns group creation, moves, undo expiry and group deletion without deleting audio", async () => {
    vi.useFakeTimers();
    const { state } = setup();
    await flushPromises();
    const g = state.groups;
    g.newGroup();
    g.groupDraft.name = "new";
    await g.saveGroup();
    expect(mock.group).toHaveBeenCalledWith("new", null, undefined);
    state.collection.selectGroup(["g"]);
    await flushPromises();
    g.editGroup();
    expect(g.groupDraft.name).toBe("分组");
    g.openMove(["one"]);
    g.moveTarget.value = "g";
    await g.moveItems();
    expect(storedGroup()).toBe("g");
    expect(g.recentOptions.value).toEqual([{ label: "分组", value: "g" }]);
    await g.undoMove();
    expect(mock.undo).toHaveBeenCalledWith("undo");
    await g.moveItems();
    await vi.advanceTimersByTimeAsync(15000);
    expect(g.undoToken.value).toBe("");
    await g.deleteGroup();
    expect(mock.removeGroup).toHaveBeenCalledWith("g");
    expect(state.collection.groupId.value).toBeNull();
  });
  it("keeps duplicate uploads explicit, serial and guarded against repeated clicks", async () => {
    const { state } = setup();
    await flushPromises();
    const t = state.transfers;
    const file = new File(["wav"], "voice.wav", { type: "audio/wav" });
    const input = { files: [file], value: "selected" };
    t.selectFiles({ target: input } as unknown as Event);
    expect(input.value).toBe("");
    expect(t.uploads.value).toHaveLength(1);
    let finish!: (value: { item: AudioLibraryItemView; existing: boolean }) => void;
    mock.upload.mockImplementationOnce((_file, _fields, progress) => {
      progress(30);
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    const pending = t.uploadAll();
    await t.uploadAll();
    expect(mock.upload).toHaveBeenCalledTimes(1);
    expect(t.uploads.value[0].message).toContain("30%");
    finish({ item: item(), existing: true });
    await pending;
    await t.uploadAll();
    expect(mock.upload).toHaveBeenCalledTimes(1);
    expect(t.uploads.value[0].duplicate).toBe(true);
    await t.uploadDuplicate(t.uploads.value[0]);
    expect(mock.upload).toHaveBeenCalledTimes(2);
    expect(mock.upload.mock.calls[1][1]).toMatchObject({ keepDuplicate: "true" });
  });
  it("retains failed upload drafts for retry, rejects oversized audio, and restores backups only after confirmation", async () => {
    const { state } = setup();
    await flushPromises();
    const t = state.transfers;
    const file = new File(["wav"], "voice.wav");
    t.selectFiles({ target: { files: [file], value: "" } } as unknown as Event);
    mock.upload.mockRejectedValueOnce(new Error("upload failed"));
    await t.uploadAll();
    expect(t.uploads.value[0].failed).toBe(true);
    await t.uploadAll();
    expect(t.uploads.value[0].done).toBe(true);
    const huge = new File(["x"], "huge.wav");
    Object.defineProperty(huge, "size", { value: 101 * 1024 ** 2 });
    t.selectFiles({ target: { files: [huge], value: "" } } as unknown as Event);
    expect(t.uploads.value).toHaveLength(1);
    const event = () => ({ target: { files: [new File(["zip"], "backup.zip")], value: "" } }) as unknown as Event;
    mock.confirm.mockResolvedValueOnce(false);
    await t.restoreBackup(event());
    expect(mock.restore).not.toHaveBeenCalled();
    await t.restoreBackup(event());
    expect(state.refreshQueue).toHaveBeenCalledOnce();
    expect(mock.message.success).toHaveBeenCalledWith("恢复新增 2 条，跳过已有 1 条");
  });
  it("keeps display units, group hierarchy, invalid dates and storage keys compatible", () => {
    expect([formatBytes(1), formatBytes(1024), formatBytes(1024 ** 2), formatBytes(1024 ** 3)]).toEqual([
      "1 B",
      "1.0 KiB",
      "1.0 MiB",
      "1.00 GiB"
    ]);
    expect(formatDuration(NaN)).toBe("—");
    expect(formatDuration(61)).toBe("1:01");
    expect(formatDate("bad")).toBe("—");
    expect(
      groupOptions([
        { id: "g", name: "父", parentId: null },
        { id: "c", name: "子", parentId: "g" }
      ])
    ).toEqual([
      { label: "父", value: "g" },
      { label: "父 / 子", value: "c" }
    ]);
    rememberGroup("g");
    expect(storedGroup()).toBe("g");
    rememberGroup(null);
    expect(storedGroup()).toBeNull();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(storedGroup()).toBeNull();
  });
});
