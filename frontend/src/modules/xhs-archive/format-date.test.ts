/** 归档旧数据中的异常时间不能导致列表或详情组件崩溃。 */
import { describe, expect, it } from "vitest";
import { formatArchiveDate } from "./format-date";

describe("formatArchiveDate", () => {
  it("正常日期按中文日期时间格式显示", () => {
    expect(formatArchiveDate("2026-10-01T00:00:00.000Z")).toContain("2026");
  });

  it.each([undefined, "", "unavailable", "2026-99-99"])("异常或缺失日期显示“未知”：%s", (value) => {
    expect(() => formatArchiveDate(value)).not.toThrow();
    expect(formatArchiveDate(value)).toBe("未知");
  });
});
