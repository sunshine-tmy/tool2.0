import { describe, expect, it } from "vitest";
import { shouldShowPagination } from "./pagination";

describe("lan transfer pagination", () => {
  it("shows pagination controls whenever there are listed files", () => {
    expect(shouldShowPagination(0)).toBe(false);
    expect(shouldShowPagination(1)).toBe(true);
    expect(shouldShowPagination(6)).toBe(true);
  });
});
