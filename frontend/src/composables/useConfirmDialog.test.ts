import { beforeEach, describe, expect, it, vi } from "vitest";
import { useConfirmDialog } from "./useConfirmDialog";

const { warning } = vi.hoisted(() => ({ warning: vi.fn() }));

vi.mock("naive-ui", () => ({
  useDialog: () => ({ warning })
}));

describe("useConfirmDialog", () => {
  beforeEach(() => warning.mockReset());

  it("uses a destructive component dialog and resolves true after confirmation", async () => {
    const confirmAction = useConfirmDialog();
    const result = confirmAction("确定删除？", { title: "删除文件" });
    const options = warning.mock.calls[0][0];

    expect(options).toMatchObject({
      title: "删除文件",
      content: "确定删除？",
      positiveText: "确认",
      negativeText: "取消",
      positiveButtonProps: { type: "error" },
      closable: false,
      maskClosable: false,
      closeOnEsc: false
    });

    options.onPositiveClick();
    await expect(result).resolves.toBe(true);
  });

  it("resolves false after cancellation", async () => {
    const confirmAction = useConfirmDialog();
    const result = confirmAction("确定取消？", { positiveText: "确认取消", danger: false });
    const options = warning.mock.calls[0][0];

    expect(options.positiveText).toBe("确认取消");
    expect(options.positiveButtonProps).toEqual({ type: "primary" });
    options.onNegativeClick();
    await expect(result).resolves.toBe(false);
  });
});
