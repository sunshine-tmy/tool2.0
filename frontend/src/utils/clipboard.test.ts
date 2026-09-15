/**
 * 中文模块说明：测试 frontend/src/utils/clipboard.test.ts 中的稳定行为、边界条件和回归场景
 */
import { describe, expect, it, vi } from "vitest";
import { copyTextToClipboard } from "./clipboard";

describe("copyTextToClipboard", () => {
  it("uses navigator clipboard when writeText is available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    await copyTextToClipboard("http://192.168.1.241:5173", {
      clipboard: { writeText }
    });

    expect(writeText).toHaveBeenCalledWith("http://192.168.1.241:5173");
  });

  it("falls back to textarea copy when navigator clipboard is unavailable", async () => {
    const textarea = {
      value: "",
      style: {},
      focus: vi.fn(),
      select: vi.fn()
    } as unknown as Node & {
      value: string;
      style: { position: string; left: string; top: string };
      focus: () => void;
      select: () => void;
    };
    const appendChild = vi.fn();
    const removeChild = vi.fn();
    const execCommand = vi.fn().mockReturnValue(true);

    await copyTextToClipboard("lan-url", {
      documentRef: {
        body: {
          appendChild,
          removeChild
        },
        createElement: vi.fn().mockReturnValue(textarea),
        execCommand
      }
    });

    expect(textarea.value).toBe("lan-url");
    expect(appendChild).toHaveBeenCalledWith(textarea);
    expect(textarea.select).toHaveBeenCalled();
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(removeChild).toHaveBeenCalledWith(textarea);
  });
});
