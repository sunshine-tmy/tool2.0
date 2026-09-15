/**
 * 中文模块说明：测试 frontend/src/utils/batch-selection.test.ts 中的稳定行为、边界条件和回归场景
 */
import { describe, expect, it } from "vitest";
import { getPageSelectionState, pruneSelectedIds, togglePageSelection, toggleSelectedId } from "./batch-selection";

describe("batch selection", () => {
  it("toggles a single id without duplicating it", () => {
    expect(toggleSelectedId([], "file-1", true)).toEqual(["file-1"]);
    expect(toggleSelectedId(["file-1"], "file-1", true)).toEqual(["file-1"]);
    expect(toggleSelectedId(["file-1", "file-2"], "file-1", false)).toEqual(["file-2"]);
  });

  it("selects and clears only ids on the current page", () => {
    expect(togglePageSelection(["old"], ["file-1", "file-2"], true)).toEqual(["old", "file-1", "file-2"]);
    expect(togglePageSelection(["old", "file-1", "file-2"], ["file-1", "file-2"], false)).toEqual(["old"]);
  });

  it("reports current page selection state", () => {
    expect(getPageSelectionState([], ["file-1"])).toEqual({ checked: false, indeterminate: false });
    expect(getPageSelectionState(["file-1"], ["file-1", "file-2"])).toEqual({
      checked: false,
      indeterminate: true
    });
    expect(getPageSelectionState(["file-1", "file-2"], ["file-1", "file-2"])).toEqual({
      checked: true,
      indeterminate: false
    });
  });

  it("removes ids that are no longer visible", () => {
    expect(pruneSelectedIds(["file-1", "gone"], ["file-1", "file-2"])).toEqual(["file-1"]);
  });
});
