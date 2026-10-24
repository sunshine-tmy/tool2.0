// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ImageAiTask } from "@toolbox/shared";
import { mountComposable } from "../../../__tests__/mount-composable";
import { useImageAiHistoryDetail } from "./useImageAiHistoryDetail";
const mock = vi.hoisted(() => ({ getTask: vi.fn() }));
vi.mock("../api", () => ({ imageAiApi: mock }));
function task(id: string): ImageAiTask {
  return {
    id,
    operation: "enhance",
    status: "completed",
    progress: 100,
    queuePosition: null,
    createdAt: "2026-10-24",
    updatedAt: "2026-10-24",
    expiresAt: null,
    warnings: [],
    results: []
  };
}
const wrappers: Array<{ unmount(): void }> = [];
function setup() {
  const result = mountComposable(useImageAiHistoryDetail);
  wrappers.push(result.wrapper);
  return result;
}
beforeEach(() => vi.clearAllMocks());
afterEach(() => wrappers.splice(0).forEach((w) => w.unmount()));
describe("image history detail lifecycle", () => {
  it("keeps a later task when an earlier detail request returns last", async () => {
    let first!: (value: ImageAiTask) => void;
    mock.getTask
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            first = resolve;
          })
      )
      .mockResolvedValueOnce(task("new"));
    const { state } = setup();
    const old = state.viewTask("old");
    await state.viewTask("new");
    first(task("old"));
    await old;
    expect(state.selectedTask.value?.id).toBe("new");
    expect(state.viewedTaskId.value).toBe("new");
    expect(state.loadingDetail.value).toBe(false);
  });
  it("invalidates a deleted detail without closing unrelated previews or resurrecting late results", async () => {
    let resolve!: (value: ImageAiTask) => void;
    mock.getTask.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    const { state } = setup();
    const pending = state.viewTask("one");
    state.closeRemoved("other");
    expect(state.detailOpen.value).toBe(true);
    state.closeRemoved("one");
    expect(state.detailOpen.value).toBe(false);
    resolve(task("one"));
    await pending;
    expect(state.selectedTask.value).toBeUndefined();
  });
  it("ignores success/error after unmount and exposes retry errors only to the current live preview", async () => {
    const { state, wrapper } = setup();
    mock.getTask.mockRejectedValueOnce(new Error("failure"));
    await state.viewTask("one");
    expect(state.detailError.value).toContain("读取处理记录详情失败");
    let resolve!: (value: ImageAiTask) => void;
    mock.getTask.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    const pending = state.viewTask("two");
    wrapper.unmount();
    resolve(task("two"));
    await pending;
    expect(state.selectedTask.value).toBeUndefined();
  });
});
