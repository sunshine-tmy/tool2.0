/**
 * 中文模块说明：图片压缩前端模块，负责上传、压缩参数和结果展示
 */
export function createImageItemId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `image-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
