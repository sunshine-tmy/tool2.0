import { describe, expect, it } from "vitest";
import { fail, ok } from "../api-response";

describe("api response helpers", () => {
  it("creates a success envelope with data and message", () => {
    expect(ok({ count: 2 }, "loaded")).toEqual({
      success: true,
      message: "loaded",
      data: { count: 2 }
    });
  });

  it("creates a failure envelope with an error code", () => {
    expect(fail("INVALID_IMAGE", "Unsupported image type", { ext: "gif" })).toEqual({
      success: false,
      message: "Unsupported image type",
      error: {
        code: "INVALID_IMAGE",
        message: "Unsupported image type",
        details: { ext: "gif" }
      }
    });
  });
});
