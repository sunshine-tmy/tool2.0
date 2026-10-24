import { expect, it } from "vitest";
import type { ImageAiHistoryQuery } from "@toolbox/shared";
import { defaultProductImageRecipe } from "@toolbox/shared";
import { listImageAiHistory } from "../domains/image-ai/history/query";
import type { StoredImageAiTask } from "../domains/image-ai/types";

function stored(id = "history-001"): StoredImageAiTask {
  return {
    id,
    operation: "background_remove",
    status: "completed",
    progress: 100,
    queuePosition: null,
    inputs: [
      { path: "private/input.png", originalName: "商品.JPG", mimetype: "image/jpeg", size: 10, width: 8, height: 6 }
    ],
    results: [
      {
        id: `${id}-1`,
        originalName: "商品.JPG",
        outputName: "cutout.png",
        outputPath: "private/output.png",
        downloadUrl: `/api/v1/tools/image-ai/tasks/${id}/files/${id}-1`,
        width: 8,
        height: 6,
        provider: "birefnet-general",
        model: "synthetic",
        warnings: []
      }
    ],
    warnings: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    expiresAt: null
  };
}

it("keeps empty defaults and explicit pagination metadata", () => {
  expect(listImageAiHistory([], {})).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
  expect(listImageAiHistory([], { page: 7, pageSize: 3 })).toEqual({ items: [], total: 0, page: 7, pageSize: 3 });
});

it.each(["watermark_remove", "enhance", "background_remove", "product_image"] as const)(
  "filters %s without changing other operations",
  (operation) => {
    const record = stored();
    record.operation = operation;
    const other = stored("other-001");
    other.operation = operation === "enhance" ? "background_remove" : "enhance";
    expect(listImageAiHistory([other, record], { operation }).items.map((item) => item.id)).toEqual([record.id]);
  }
);

it.each(["pending", "running", "completed", "failed", "canceled"] as const)(
  "keeps %s as its domain state and combines filters",
  (status) => {
    const record = stored();
    record.status = status;
    const query = { status, keyword: " HISTORY-001 ", operation: "background_remove" as const };
    expect(listImageAiHistory([record], query).items[0]?.status).toBe(status);
    expect(listImageAiHistory([record], { ...query, operation: "enhance" }).total).toBe(0);
  }
);

it("matches any input filename and retains trim, locale case conversion and empty keyword semantics", () => {
  const record = stored();
  record.inputs.push({ ...record.inputs[0], originalName: "中文 Product.PNG" });
  for (const keyword of ["PRODUCT", " 中文 ", "HISTORY-001", "   "]) {
    expect(listImageAiHistory([record], { keyword }).items.map((item) => item.id)).toEqual([record.id]);
  }
  expect(listImageAiHistory([record], { keyword: "absent" }).total).toBe(0);
});

it.each([
  [1, ["newest-001"]],
  [2, ["history-ZZZ"]],
  [4, []]
] as const)("keeps descending dates, identity tie-break and page %s", (page, ids) => {
  const first = stored("history-AAA"),
    second = stored("history-ZZZ"),
    newest = stored("newest-001");
  newest.createdAt = "2026-02-01T00:00:00Z";
  const result = listImageAiHistory([first, newest, second], { page, pageSize: 1 });
  expect(result.items.map((item) => item.id)).toEqual(ids);
  expect(result).toMatchObject({ total: 3, page, pageSize: 1 });
});

it("does not mutate input order, records or query, and keeps the existing path-free shallow projection", () => {
  const first = stored("history-AAA"),
    second = stored("history-ZZZ");
  first.recipe = defaultProductImageRecipe();
  first.source = { taskId: "source-001", resultId: "source-001-1" };
  const records = Object.freeze([Object.freeze(first), Object.freeze(second)]);
  const before = structuredClone(records);
  const query: ImageAiHistoryQuery = Object.freeze({ page: 1, pageSize: 20 });
  const result = listImageAiHistory(records, query);
  expect(records).toEqual(before);
  const item = result.items.find((value) => value.id === first.id)!;
  expect(JSON.stringify(result)).not.toContain("private/");
  expect(item).not.toBe(first);
  expect(item.recipe).toBe(first.recipe);
  expect(item.source).toBe(first.source);
  expect(item.results[0].warnings).toBe(first.results[0].warnings);
  expect(item.warnings).not.toBe(first.warnings);
});

it("consumes a single-pass iterable once per call instead of materializing or caching state early", () => {
  const records = new Map<string, StoredImageAiTask>();
  records.set("first", stored("first-001"));
  expect(listImageAiHistory(records.values(), {}).total).toBe(1);
  records.set("second", stored("second-001"));
  expect(listImageAiHistory(records.values(), {}).total).toBe(2);
  const iterator = records.values();
  expect(listImageAiHistory(iterator, {}).total).toBe(2);
  expect(iterator.next().done).toBe(true);
});
