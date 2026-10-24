/** 诊断固定错误构造；不加载服务、模型或维护状态。 */
export function diagnosticError(code: string, message: string, statusCode = 409) {
  return Object.assign(new Error(message), { code, statusCode });
}
