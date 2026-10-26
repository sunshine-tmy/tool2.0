import { describe, expect, it } from "vitest";
import { Value } from "@sinclair/typebox/value";
import {
  ArchiveImportCreateSchema,
  ArchiveImportBatchSchema,
  ContentArchiveTaskSchema,
  XhsArchiveTaskSchema,
  ArchiveGroupInputSchema,
  ArchiveGroupAssignmentSchema,
  ContentArchiveListQuerySchema,
  ContentTranslationBatchInputSchema,
  XhsArchiveListQuerySchema
} from "../index";
const row = { rowNumber: 2, inputUrl: "https://vt.tiktok.com/AAAAA/", inputPlatform: "" };
describe("spreadsheet archive contracts", () => {
  it("keeps grouping additive and bounded without broadening legacy request contracts", () => {
    expect(Value.Check(ArchiveGroupInputSchema, { name: "商品素材" })).toBe(true);
    for (const name of ["", "x".repeat(81), "bad\nname"])
      expect(Value.Check(ArchiveGroupInputSchema, { name })).toBe(false);
    expect(Value.Check(ArchiveGroupAssignmentSchema, { groupId: null, itemIds: ["archive_123"] })).toBe(true);
    for (const itemIds of [[], ["archive_123", "archive_123"], Array.from({ length: 101 }, (_, i) => `archive_${i}`)])
      expect(Value.Check(ArchiveGroupAssignmentSchema, { groupId: "group_123", itemIds })).toBe(false);
    expect(Value.Check(ContentArchiveListQuerySchema, { groupId: "group_123" })).toBe(true);
    expect(Value.Check(XhsArchiveListQuerySchema, { groupId: "group_123" })).toBe(false);
    expect(
      Value.Check(ContentTranslationBatchInputSchema, {
        mode: "missing-or-stale",
        filter: { groupId: "ungrouped", platform: "tiktok" }
      })
    ).toBe(true);
  });
  it("accepts 1–100 raw rows, requires an explicit existing-work policy and rejects undeclared credentials", () => {
    const input = { sourceName: "作品.csv", existing: "skip", rows: [row] };
    expect(Value.Check(ArchiveImportCreateSchema, input)).toBe(true);
    expect(
      Value.Check(ArchiveImportCreateSchema, {
        ...input,
        existing: "refresh",
        rows: Array.from({ length: 100 }, (_, i) => ({ ...row, rowNumber: i + 2 }))
      })
    ).toBe(true);
    for (const invalid of [
      { ...input, rows: [] },
      { ...input, rows: Array(101).fill(row) },
      { ...input, existing: "overwrite" },
      { ...input, cookie: "secret" },
      { ...input, rows: [{ ...row, taskId: "forged_task" }] }
    ])
      expect(Value.Check(ArchiveImportCreateSchema, invalid)).toBe(false);
  });
  it("describes persisted batch progress with valid timestamps and keeps skipped outcomes out of legacy DTOs", () => {
    const task = {
      id: "task_123",
      status: "completed",
      stage: "completed",
      progress: 100,
      message: "已跳过",
      createdAt: "2026-10-26T00:00:00Z",
      updatedAt: "2026-10-26T00:00:00Z"
    };
    expect(Value.Check(ContentArchiveTaskSchema, { ...task, platform: "tiktok", skipped: true })).toBe(true);
    expect(Value.Check(XhsArchiveTaskSchema, task)).toBe(true);
    expect(Value.Check(XhsArchiveTaskSchema, { ...task, skipped: true })).toBe(false);
    expect(
      Value.Check(ArchiveImportBatchSchema, {
        id: "batch_123",
        sourceName: "file.xlsx",
        sheetName: "作品",
        existing: "skip",
        status: "interrupted",
        rows: [{ ...row, status: "failed", progress: 0, message: "需手动重试", errorCode: "ARCHIVE_INTERRUPTED" }],
        createdAt: task.createdAt,
        updatedAt: task.updatedAt
      })
    ).toBe(true);
  });
});
