import { describe, expect, it } from "vitest";
import { Value } from "@sinclair/typebox/value";
import { ImageAiHistoryQuerySchema, ImageAiHistorySchema, ImageAiInputParamsSchema } from "../image-ai";

describe("image AI history contract", () => {
  it("bounds pagination and permits only fixed filters and input indexes", () => {
    expect(
      Value.Check(ImageAiHistoryQuerySchema, {
        page: 1,
        pageSize: 20,
        operation: "background_remove",
        status: "completed",
        keyword: "商品"
      })
    ).toBe(true);
    for (const query of [
      { page: 0 },
      { pageSize: 51 },
      { operation: "arbitrary" },
      { keyword: "x".repeat(101) },
      { filePath: "C:/private" }
    ])
      expect(Value.Check(ImageAiHistoryQuerySchema, query)).toBe(false);
    expect(Value.Check(ImageAiInputParamsSchema, { taskId: "image-task-123", inputIndex: 1 })).toBe(true);
    for (const inputIndex of [0, 11, 1.5])
      expect(Value.Check(ImageAiInputParamsSchema, { taskId: "image-task-123", inputIndex })).toBe(false);
    expect(Value.Check(ImageAiInputParamsSchema, { taskId: "../private", inputIndex: 1 })).toBe(false);
  });
  it("validates empty history and forbids unknown response fields", () => {
    expect(Value.Check(ImageAiHistorySchema, { items: [], page: 1, pageSize: 20, total: 0 })).toBe(true);
    expect(Value.Check(ImageAiHistorySchema, { items: [], page: 1, pageSize: 20, total: 0, root: "C:/private" })).toBe(
      false
    );
  });
});
