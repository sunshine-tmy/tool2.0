import { httpClient, setAdminCsrfToken, withApiError } from "./http";

type AdminSession = { csrfToken: string; expiresInSeconds: number };

export async function authenticateAdmin(pin: string) {
  const session = await withApiError(() => httpClient.post<AdminSession>("/session", { pin }), "管理员 PIN 验证失败");
  setAdminCsrfToken(session.csrfToken);
  return session;
}

export async function restoreAdminSession() {
  const session = await withApiError(() => httpClient.get<AdminSession>("/session"), "管理员会话已失效");
  setAdminCsrfToken(session.csrfToken);
  return session;
}

export async function signOutAdmin() {
  try {
    await httpClient.delete("/session");
  } finally {
    setAdminCsrfToken(undefined);
  }
}
