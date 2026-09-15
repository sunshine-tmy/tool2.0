/**
 * 中文模块说明：测试 frontend/src/modules/lan-transfer/paste-upload.test.ts 中的稳定行为、边界条件和回归场景
 */
import { describe, expect, it } from "vitest";
import { filesFromClipboard, isEditablePasteTarget } from "./paste-upload";

describe("LAN transfer clipboard upload helpers", () => {
  it("extracts all clipboard files", () => {
    const image = new File(["image"], "clipboard.png", { type: "image/png" });
    const document = new File(["document"], "manual.pdf", { type: "application/pdf" });
    const files = { 0: image, 1: document, length: 2 } as ArrayLike<File>;

    expect(filesFromClipboard({ files })).toEqual([image, document]);
    expect(filesFromClipboard(undefined)).toEqual([]);
  });

  it("does not take over paste inside text entry controls", () => {
    expect(isEditablePasteTarget({ tagName: "INPUT" } as unknown as EventTarget)).toBe(true);
    expect(isEditablePasteTarget({ tagName: "textarea" } as unknown as EventTarget)).toBe(true);
    expect(isEditablePasteTarget({ isContentEditable: true } as unknown as EventTarget)).toBe(true);
    expect(
      isEditablePasteTarget({
        closest: (selector: string) => (selector.includes("contenteditable") ? {} : null)
      } as unknown as EventTarget)
    ).toBe(true);
    expect(isEditablePasteTarget({ tagName: "DIV", closest: () => null } as unknown as EventTarget)).toBe(false);
  });
});
