/**
 * 中文模块说明：测试 frontend/src/modules/lan-transfer/pagination.test.ts 中的稳定行为、边界条件和回归场景
 */
import { describe, expect, it } from "vitest";
import { shouldShowPagination } from "./pagination";

describe("lan transfer pagination", () => {
  it("shows pagination controls whenever there are listed files", () => {
    expect(shouldShowPagination(0)).toBe(false);
    expect(shouldShowPagination(1)).toBe(true);
    expect(shouldShowPagination(6)).toBe(true);
  });
});
