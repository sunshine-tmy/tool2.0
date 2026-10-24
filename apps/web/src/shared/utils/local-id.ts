/**
 * 中文模块说明：前端应用层，负责 页面布局、共享组件、服务或工具能力
 */
let fallbackSequence = 0;

export function createLocalId(prefix: string) {
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  fallbackSequence = (fallbackSequence + 1) % Number.MAX_SAFE_INTEGER;
  return `${prefix}-${Date.now()}-${fallbackSequence}-${Math.random().toString(36).slice(2, 10)}`;
}
