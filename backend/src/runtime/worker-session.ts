/**
 * 中文模块说明：桌面 Worker 会话，负责每次应用启动生成 loopback 端口与进程内令牌。
 */
import crypto from "node:crypto";
import net from "node:net";

export type DesktopWorkerSession = {
  xhsProviderPort: number;
  xhsTranslationPort: number;
  xhsProviderToken: string;
  xhsTranslationToken: string;
};

/**
 * 端口与令牌只注入 Electron utility process 的环境。renderer 不获取它们，
 * 而 Worker 也会在 HTTP 层拒绝未携带正确令牌的 loopback 请求。
 */
export async function createDesktopWorkerSession(): Promise<DesktopWorkerSession> {
  const [xhsProviderPort, xhsTranslationPort] = await Promise.all([reserveLoopbackPort(), reserveLoopbackPort()]);
  if (xhsProviderPort === xhsTranslationPort) return createDesktopWorkerSession();
  return {
    xhsProviderPort,
    xhsTranslationPort,
    xhsProviderToken: crypto.randomBytes(32).toString("base64url"),
    xhsTranslationToken: crypto.randomBytes(32).toString("base64url")
  };
}

export function workerSessionEnvironment(session: DesktopWorkerSession) {
  return {
    XHS_PROVIDER_PORT: String(session.xhsProviderPort),
    XHS_TRANSLATION_PROVIDER_PORT: String(session.xhsTranslationPort),
    XHS_PROVIDER_TOKEN: session.xhsProviderToken,
    XHS_TRANSLATION_TOKEN: session.xhsTranslationToken
  };
}

async function reserveLoopbackPort() {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  try {
    const address = server.address();
    if (!address || typeof address === "string" || address.port < 1)
      throw new Error("Unable to reserve a loopback port");
    return address.port;
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}
