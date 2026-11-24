/** 启动、环境检查及脱敏报告的跨端契约；不包含用户内容或原始日志。 */
import { Type, type Static } from "@sinclair/typebox";

export const DiagnosticStatusSchema = Type.Union([
  Type.Literal("checking"),
  Type.Literal("ok"),
  Type.Literal("warning"),
  Type.Literal("failed"),
  Type.Literal("not-installed"),
  Type.Literal("skipped"),
  Type.Literal("unknown")
]);
export const DiagnosticCheckSchema = Type.Object(
  {
    id: Type.String(),
    category: Type.Union([
      Type.Literal("service"),
      Type.Literal("storage"),
      Type.Literal("environment"),
      Type.Literal("capability"),
      Type.Literal("external")
    ]),
    title: Type.String(),
    status: DiagnosticStatusSchema,
    code: Type.String(),
    message: Type.String(),
    impact: Type.String(),
    suggestion: Type.String(),
    modules: Type.Array(Type.String()),
    action: Type.Optional(Type.Union([Type.Literal("components"), Type.Literal("restart-worker")])),
    componentId: Type.Optional(Type.String()),
    evidence: Type.Optional(Type.String())
  },
  { additionalProperties: false }
);
export const DiagnosticRunSchema = Type.Object(
  {
    id: Type.String(),
    schemaVersion: Type.Literal(1),
    mode: Type.Union([Type.Literal("desktop"), Type.Literal("development")]),
    depth: Type.Union([Type.Literal("light"), Type.Literal("deep")]),
    startedAt: Type.String(),
    finishedAt: Type.Optional(Type.String()),
    phase: Type.String(),
    state: Type.Union([Type.Literal("running"), Type.Literal("completed"), Type.Literal("cancelled")]),
    checks: Type.Array(DiagnosticCheckSchema),
    elapsedMs: Type.Number(),
    events: Type.Array(Type.Object({ at: Type.String(), phase: Type.String(), code: Type.String() }))
  },
  { additionalProperties: false }
);
export const DiagnosticInputSchema = Type.Object(
  {
    depth: Type.Union([Type.Literal("light"), Type.Literal("deep")]),
    targets: Type.Optional(
      Type.Array(Type.String({ pattern: "^[a-z0-9-]{1,80}$" }), { maxItems: 20, uniqueItems: true })
    ),
    confirmed: Type.Optional(Type.Boolean())
  },
  { additionalProperties: false }
);
export const DiagnosticActionSchema = Type.Object(
  {
    action: Type.Literal("restart-worker"),
    componentId: Type.Union([Type.Literal("image-ai"), Type.Literal("chatterbox")]),
    confirmed: Type.Literal(true)
  },
  { additionalProperties: false }
);
export const DiagnosticReportInputSchema = Type.Object(
  {
    runId: Type.String({ pattern: "^[A-Za-z0-9-]{1,80}$" }),
    includeEvents: Type.Boolean()
  },
  { additionalProperties: false }
);
export const DiagnosticReportSchema = Type.Object({ filename: Type.String(), content: Type.String() });
export const DiagnosticIdSchema = Type.Object(
  { id: Type.String({ pattern: "^[A-Za-z0-9-]{1,80}$" }) },
  { additionalProperties: false }
);
export type DiagnosticCheck = Static<typeof DiagnosticCheckSchema>;
export type DiagnosticRun = Static<typeof DiagnosticRunSchema>;
export type DiagnosticInput = Static<typeof DiagnosticInputSchema>;

/** 不回传异常 message/stack：只按有证据的稳定错误码分类。 */
export function diagnosticFailure(error: unknown): { code: string; message: string } {
  const value = error as
    { code?: string; name?: string; status?: number; statusCode?: number; cause?: { code?: string } } | undefined;
  const code = value?.code || value?.cause?.code;
  const componentReasons: Record<string, string> = {
    COMPONENT_MANIFEST_INVALID: "能力清单、签名或受信任目录校验未通过",
    COMPONENT_VERSION_MISMATCH: "已安装能力版本与当前应用的受信任目录不匹配，尚不能判定文件损坏",
    COMPONENT_NOT_FOUND: "当前应用的能力目录中没有此组件",
    COMPONENT_NOT_INSTALLED: "此能力尚未安装",
    COMPONENT_DEPENDENCY_MISSING: "所需共享能力尚未就绪",
    DEPENDENCY_CHECK_FAILED: "所依赖的能力检查未通过，本项未继续执行",
    COMPONENT_INSTALL_FAILED: "能力文件或生成的 Python 环境不可用，请查看失败阶段",
    COMPONENT_FILE_MISSING: "能力包中的签名文件不存在",
    COMPONENT_FILE_SIZE_MISMATCH: "能力文件大小与签名清单不符",
    COMPONENT_FILE_HASH_MISMATCH: "能力文件摘要与签名清单不符",
    COMPONENT_PATH_INVALID: "能力路径不在受信任的安装目录内",
    PYTHON_VERSION_MISMATCH: "Python 可启动，但版本与能力包要求不符",
    PYTHON_INIT_FAILED: "Python 解释器初始化失败，尚未开始加载业务模型",
    PYTHON_IMPORT_FAILED: "Python 自检无法导入所需依赖",
    PYTHON_DLL_FAILED: "Python 依赖的动态链接库加载失败",
    SELF_TEST_PROTOCOL_INVALID: "安装自检未返回有效的结果协议",
    SELF_TEST_UNAVAILABLE: "安装自检返回能力不可用",
    WORKER_CHECK_FAILED: "子服务诊断请求失败，请查看 HTTP 状态",
    WORKER_AUTH_FAILED: "本机子服务诊断鉴权失败，不代表在线服务拒绝请求"
  };
  if (code && Object.hasOwn(componentReasons, code)) return { code, message: componentReasons[code]! };
  if (value?.status === 403 || value?.statusCode === 403 || code === "ONLINE_FORBIDDEN")
    return { code: "ONLINE_FORBIDDEN", message: "在线服务拒绝请求（403），不代表本地 Python 环境损坏" };
  if (code === "EACCES" || code === "EPERM" || code === "ACCESS_DENIED")
    return { code: "ACCESS_DENIED", message: "当前用户没有访问所需目录或文件的权限" };
  if (code === "ENOSPC" || code === "DISK_FULL") return { code: "DISK_FULL", message: "数据所在磁盘空间不足" };
  if (code === "EADDRINUSE" || code === "PORT_IN_USE")
    return { code: "PORT_IN_USE", message: "配置的端口已被占用，未终止占用进程" };
  if (code === "ECONNREFUSED" || code === "CONNECTION_REFUSED")
    return { code: "CONNECTION_REFUSED", message: "目标服务未监听或已退出" };
  if (code === "ETIMEDOUT" || code === "CHECK_TIMEOUT" || value?.name === "TimeoutError")
    return { code: "CHECK_TIMEOUT", message: "检查超时，尚无法确定具体原因" };
  if (code === "ENOENT" || code === "FILE_MISSING") return { code: "FILE_MISSING", message: "运行所需的文件不存在" };
  if (code?.startsWith("SQLITE_") || code === "DATABASE_UNAVAILABLE")
    return { code: "DATABASE_UNAVAILABLE", message: "数据库无法正常打开或访问，未执行自动修复" };
  if (code === "CUDA_OUT_OF_MEMORY") return { code, message: "设备报告显存不足，请结束其他 GPU 工作后重试" };
  if (code === "WORKER_DIAGNOSTICS_UNSUPPORTED")
    return { code, message: "子服务未提供此诊断接口，无法验证模型；不代表模型不可用" };
  if (code === "WORKER_PROTOCOL_MISMATCH") return { code, message: "子服务与主程序的诊断协议不兼容" };
  if (code === "MODEL_SELF_TEST_FAILED")
    return { code, message: "实际模型加载未通过，不能仅凭此认定文件损坏或显存不足" };
  if (code === "SELF_TEST_FAILED") return { code, message: "固定测试子进程未成功完成，请检查对应能力" };
  if (code === "CONFIG_INVALID")
    return { code, message: "启动配置未通过校验，请核对有效配置；未显示配置值或自动修改配置" };
  return { code: "UNKNOWN_FAILURE", message: "检查未通过，现有证据不足以确定具体原因" };
}

export function diagnosticSummary(run: DiagnosticRun) {
  return [
    "电商工具箱 · 启动与环境诊断",
    `检查时间：${run.startedAt}`,
    `阶段：${run.phase}`,
    ...run.checks.map((check) => `${check.title}：${check.message}；建议：${check.suggestion}`)
  ].join("\n");
}
