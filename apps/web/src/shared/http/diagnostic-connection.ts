import { ref } from "vue";
/** 与 HTTP 错误共享的轻量状态，避免诊断客户端和 HTTP 客户端循环依赖。 */
export const diagnosticConnection = ref<"checking" | "online" | "offline" | "partial">("checking");
