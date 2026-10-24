import type { DesktopMigrationSummary } from "@toolbox/shared/desktop";
export function migrationStatusLabel(status: DesktopMigrationSummary["status"]) {
  return status === "imported" ? "已导入" : "已回滚";
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "medium" }).format(new Date(value));
}
