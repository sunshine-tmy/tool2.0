/**
 * 中文模块说明：前端应用层，负责 页面布局、共享组件、服务或工具能力
 */
import { AdminSessionSchema, EmptyResultSchema } from "@toolbox/shared";
import { httpClient, setAdminCsrfToken, withApiError } from "./http";

export async function authenticateAdmin(pin: string) {
  // 登录响应中的 CSRF token 只保存在内存，管理员 Cookie 由后端以 HttpOnly 方式维护。
  const session = await withApiError(
    () => httpClient.post("/session", AdminSessionSchema, { pin }),
    "管理员 PIN 验证失败"
  );
  setAdminCsrfToken(session.csrfToken);
  return session;
}

export async function restoreAdminSession() {
  // 恢复会话不重新提交 PIN；失败时清理逻辑由调用方将页面权限恢复为访客态。
  const session = await withApiError(() => httpClient.get("/session", AdminSessionSchema), "管理员会话已失效");
  setAdminCsrfToken(session.csrfToken);
  return session;
}

export async function signOutAdmin() {
  try {
    // 无论服务端注销是否成功，都清除前端 CSRF token，避免继续携带过期写权限。
    await httpClient.delete("/session", EmptyResultSchema);
  } finally {
    setAdminCsrfToken(undefined);
  }
}
