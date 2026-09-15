/**
 * 中文模块说明：测试 packages/shared/src/__tests__/xhs-text.test.ts 中的稳定行为、边界条件和回归场景
 */
import { describe, expect, it } from "vitest";
import { normalizeXhsText } from "../xhs-text";

describe("Xiaohongshu text helpers", () => {
  it("converts known custom emoji placeholders to Unicode emoji", () => {
    expect(normalizeXhsText("[彩虹R]起名思路 [气球R]字库 [玫瑰R]案例 [合十R]")).toBe("🌈起名思路 🎈字库 🌹案例 🙏");
  });

  it("preserves unknown placeholders and existing emoji", () => {
    expect(normalizeXhsText("原有🌿 [未知表情R] 保持不变")).toBe("原有🌿 [未知表情R] 保持不变");
  });
});
