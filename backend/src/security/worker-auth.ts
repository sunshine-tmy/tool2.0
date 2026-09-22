/** 中文模块说明：Worker 认证辅助，确保令牌只由后端进程添加到本机 Worker 请求。 */
export const WORKER_AUTH_HEADER = "x-toolbox-worker-token";

export function workerAuthHeaders(token: string | undefined): Record<string, string> {
  return token ? { [WORKER_AUTH_HEADER]: token } : {};
}
