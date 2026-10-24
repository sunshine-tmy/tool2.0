import { effectScope, nextTick, ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import { useSpeechBatchSelection } from "./useSpeechBatchSelection";

function setup() {
  const batches = ref([{ id: "one" }, { id: "two" }, { id: "three" }]);
  const blocked = ref(false);
  const options = {
    batches,
    blocked: () => blocked.value,
    remove: vi.fn().mockResolvedValue({ removed: true }),
    onRemoved: vi.fn(),
    reload: vi.fn().mockResolvedValue(undefined),
    confirm: vi.fn().mockResolvedValue(true),
    message: { success: vi.fn(), warning: vi.fn() }
  };
  const scope = effectScope();
  const selection = scope.run(() => useSpeechBatchSelection(options))!;
  return { ...options, selection, blocked, stop: () => scope.stop() };
}

describe("Shared speech batch selection", () => {
  it("supports individual, indeterminate and whole-page selection without duplicate or off-page IDs", async () => {
    const p = setup();
    try {
      p.selection.toggleBatchSelection("one", true);
      p.selection.toggleBatchSelection("one", true);
      p.selection.toggleBatchSelection("off-page", true);
      expect(p.selection.selectedBatchIds.value).toEqual(["one"]);
      expect(p.selection.somePageBatchesSelected.value).toBe(true);
      p.selection.toggleAllPageBatches(true);
      expect(p.selection.allPageBatchesSelected.value).toBe(true);
      expect(p.selection.somePageBatchesSelected.value).toBe(false);
      p.selection.toggleBatchSelection("two", false);
      expect(p.selection.selectedBatchIds.value).toEqual(["one", "three"]);
      p.batches.value = [{ id: "three" }, { id: "four" }];
      await nextTick();
      expect(p.selection.selectedBatchIds.value).toEqual(["three"]);
      p.batches.value = [{ id: "five" }];
      await nextTick();
      expect(p.selection.selectedBatchIds.value).toEqual([]);
    } finally {
      p.stop();
    }
  });

  it("requires confirmation and keeps selection when cancelled", async () => {
    const p = setup();
    try {
      await p.selection.removeSelectedBatches();
      expect(p.confirm).not.toHaveBeenCalled();
      p.selection.toggleAllPageBatches(true);
      p.confirm.mockResolvedValue(false);
      await p.selection.removeSelectedBatches();
      expect(p.remove).not.toHaveBeenCalled();
      expect(p.selection.selectedBatchIds.value).toHaveLength(3);
      expect(p.selection.deletingBatches.value).toBe(false);
      expect(p.confirm).toHaveBeenCalledWith(
        expect.stringContaining("3 个批次"),
        expect.objectContaining({ danger: true })
      );
    } finally {
      p.stop();
    }
  });

  it("deletes only selected IDs, reports partial failure and preserves rejected active batches for retry", async () => {
    const p = setup();
    try {
      p.selection.toggleAllPageBatches(true);
      p.remove.mockImplementation(async (id: string) => {
        if (id === "two") throw new Error("正在生成，不能删除");
        p.batches.value = p.batches.value.filter((batch) => batch.id !== id);
        return { removed: true };
      });
      await p.selection.removeSelectedBatches();
      expect(p.remove.mock.calls.map(([id]) => id)).toEqual(["one", "two", "three"]);
      expect(p.selection.selectedBatchIds.value).toEqual(["two"]);
      expect(p.onRemoved.mock.calls.map(([id]) => id)).toEqual(["one", "three"]);
      expect(p.message.warning).toHaveBeenCalledWith(expect.stringContaining("已删除 2 个批次，1 个失败"));
      expect(p.reload).toHaveBeenCalledOnce();
      p.remove.mockResolvedValue({ removed: true });
      await p.selection.removeSelectedBatches();
      expect(p.selection.selectedBatchIds.value).toEqual([]);
      expect(p.message.success).toHaveBeenCalledWith("已删除 1 个批次");
    } finally {
      p.stop();
    }
  });

  it("locks selection and duplicate submissions while confirmation or deletion is pending", async () => {
    const p = setup();
    try {
      p.blocked.value = true;
      p.selection.toggleAllPageBatches(true);
      expect(p.selection.selectedBatchIds.value).toEqual([]);
      p.blocked.value = false;
      p.selection.toggleBatchSelection("one", true);
      let confirm!: (value: boolean) => void;
      p.confirm.mockImplementation(
        () =>
          new Promise<boolean>((resolve) => {
            confirm = resolve;
          })
      );
      const pending = p.selection.removeSelectedBatches();
      p.selection.toggleAllPageBatches(false);
      p.selection.toggleBatchSelection("two", true);
      await p.selection.removeSelectedBatches();
      expect(p.selection.selectedBatchIds.value).toEqual(["one"]);
      expect(p.confirm).toHaveBeenCalledOnce();
      confirm(true);
      await pending;
      expect(p.remove).toHaveBeenCalledExactlyOnceWith("one");
    } finally {
      p.stop();
    }
  });
});
