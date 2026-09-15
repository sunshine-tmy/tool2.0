/**
 * 中文模块说明：前端应用层，负责 页面布局、共享组件、服务或工具能力
 */
import { AdminSessionSchema, EmptyResultSchema } from "@toolbox/shared";
import { httpClient, setAdminCsrfToken, withApiError } from "./http";

export async function authenticateAdmin(pin: string) {
  const session = await withApiError(
    () => httpClient.post("/session", AdminSessionSchema, { pin }),
    "管理员 PIN 验证失败"
  );
  setAdminCsrfToken(session.csrfToken);
  return session;
}

export async function restoreAdminSession() {
  const session = await withApiError(() => httpClient.get("/session", AdminSessionSchema), "管理员会话已失效");
  setAdminCsrfToken(session.csrfToken);
  return session;
}

export async function signOutAdmin() {
  try {
    await httpClient.delete("/session", EmptyResultSchema);
  } finally {
    setAdminCsrfToken(undefined);
  }
}
