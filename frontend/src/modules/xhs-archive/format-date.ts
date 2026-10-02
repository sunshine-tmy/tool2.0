/** 中文模块说明：安全格式化归档时间，兼容旧存档中的缺失或异常日期。 */

const archiveDateFormatter = new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" });

export function formatArchiveDate(value: string | null | undefined): string {
  if (typeof value !== "string" || !value.trim()) return "未知";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "未知";
  return archiveDateFormatter.format(timestamp);
}
