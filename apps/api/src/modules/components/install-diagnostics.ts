/** 仅输出可确认的错误码及固定文案；不输出 URL、凭据、本机路径或未知 Worker 文案。 */
const reasons: Record<string, string> = {
  ENOTFOUND: "下载域名解析失败；请检查 DNS，以及浏览器和启动器是否使用不同网络通道",
  EAI_AGAIN: "下载域名暂时无法解析；请检查 DNS 后重试",
  ETIMEDOUT: "下载连接或分段读取超时；请检查网络稳定性后重试",
  UND_ERR_CONNECT_TIMEOUT: "下载连接超时；请检查网络或代理连通性",
  UND_ERR_HEADERS_TIMEOUT: "下载服务响应头超时；请稍后重试",
  UND_ERR_BODY_TIMEOUT: "下载内容读取超时；已完成的其他分段可在本次运行内保留",
  ECONNRESET: "下载连接被中断；请检查网络或代理稳定性",
  ECONNREFUSED: "下载连接被拒绝；请检查网络或代理是否可用",
  UND_ERR_SOCKET: "下载连接提前关闭；请检查网络稳定性",
  CERT_HAS_EXPIRED: "下载连接证书已过期；请核对系统时间和证书，不要关闭 TLS 校验",
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: "下载证书链无法验证；请检查系统证书及代理，不要关闭 TLS 校验",
  SELF_SIGNED_CERT_IN_CHAIN: "下载证书链包含不受信任证书；请检查代理和证书配置",
  EACCES: "能力目录访问被拒绝；请检查当前用户的目录权限",
  EPERM: "能力文件操作被拒绝；请检查权限或文件占用",
  ENOSPC: "能力所在磁盘空间不足",
  ENOENT: "安装需要的文件或目录不存在",
  COMPONENT_DISK_SPACE_LOW: "磁盘可用空间不足；请释放空间后重试，不要删除业务数据",
  COMPONENT_DEPENDENCY_MISSING: "所需共享能力尚未就绪；请先完成对应依赖的安装",
  COMPONENT_IN_USE: "相关能力正在使用；请等待任务和播放结束后重试",
  COMPONENT_MANIFEST_INVALID: "能力清单或签名无效；请使用可信发布版本，不要绕过校验"
};

export function knownInstallFailure(error: unknown): string | undefined {
  const seen = new Set<unknown>();
  let value = error;
  for (let depth = 0; value && typeof value === "object" && depth < 6 && !seen.has(value); depth++) {
    seen.add(value);
    const item = value as { code?: string; name?: string; cause?: unknown };
    const code = item.name === "TimeoutError" ? "ETIMEDOUT" : item.code;
    if (code && Object.hasOwn(reasons, code)) return `${code}: ${reasons[code]}`;
    value = item.cause;
  }
}

export function installFailureAdvice(code: string | undefined, message: string | undefined) {
  if (code && Object.hasOwn(reasons, code)) return `${code}: ${reasons[code]}`;
  const match = /^([A-Z_]+): /.exec(message ?? "");
  if (match && Object.hasOwn(reasons, match[1])) return `${match[1]}: ${reasons[match[1]]}`;
  const http = /^能力包下载服务未返回有效的分段响应（HTTP (\d{3})）$/.exec(message ?? "");
  if (http) return `HTTP ${http[1]}：下载服务未接受分段请求；请检查来源可达性或代理兼容性`;
  const trustedMessages = [
    "能力包下载大小校验失败",
    "能力包下载摘要校验失败",
    "能力包分段范围校验失败",
    "能力包分段大小校验失败",
    "能力包响应大小校验失败",
    "能力包分段读取失败",
    "能力包分段连接提前结束",
    "能力包归档格式无效",
    "能力包文件摘要校验失败",
    "能力包文件清单校验失败",
    "能力运行时健康检查失败，已恢复原版本"
  ];
  if (message && trustedMessages.includes(message)) return `${message}；停止安装，未跳过安全校验`;
  return "现有证据不足以确定具体原因；不要盲目重装 Python 或模型";
}
