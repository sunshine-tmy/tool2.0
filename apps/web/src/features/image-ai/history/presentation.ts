import type { ImageAiOperation, ImageAiTask, ImageAiTaskStatus } from "@toolbox/shared";
export const operationOptions = [
  { label: "去水印", value: "watermark_remove" },
  { label: "变清晰", value: "enhance" },
  { label: "抠图", value: "background_remove" },
  { label: "商品图编辑", value: "product_image" }
];
export const statusOptions = [
  { label: "已完成", value: "completed" },
  { label: "处理失败", value: "failed" },
  { label: "已取消", value: "canceled" },
  { label: "等待处理", value: "pending" },
  { label: "处理中", value: "running" }
];
export function isActive(task: ImageAiTask) {
  return task.status === "pending" || task.status === "running";
}
export function taskFileNames(task: ImageAiTask) {
  return (
    task.inputs?.map((input) => input.originalName).join("、") ||
    task.results.map((result) => result.originalName).join("、")
  );
}
export function operationName(value: ImageAiOperation) {
  return operationOptions.find((option) => option.value === value)?.label ?? value;
}
export function statusName(value: ImageAiTaskStatus) {
  return statusOptions.find((option) => option.value === value)?.label ?? value;
}
export function dateLabel(value: string) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}
