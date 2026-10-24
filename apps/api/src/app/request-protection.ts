/** Application assembly step; called directly on the original Fastify instance. */
import { type FastifyInstance } from "fastify";
import { ComponentManager } from "../modules/components/component-manager";
import { DiagnosticsService } from "../modules/diagnostics/service";
import { DesktopShutdown } from "../lifecycle/desktop-shutdown";

export function registerRequestProtection(
  app: FastifyInstance,
  shutdown: DesktopShutdown,
  componentManager: ComponentManager,
  diagnosticService: DiagnosticsService
) {
  shutdown.bind(() => {
    const blocked = componentManager.hasActiveJobs() || diagnosticService.gate.locked;
    return {
      busy: diagnosticService.isBusy(),
      blocked,
      ...(blocked ? { reason: "能力安装、更新或环境维护正在执行，请完成后再退出" } : {})
    };
  });
  // 写请求从进入到响应结束均受保护；诊断自身的白名单操作由独占锁保护。
  app.addHook("onRequest", async (request) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) shutdown.enter(request);
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && !request.url.startsWith("/api/v1/diagnostics")) {
      if (componentManager.hasActiveJobs() && !request.url.startsWith("/api/v1/component-jobs/"))
        throw Object.assign(new Error("能力组件操作尚未完成，请等待空闲后重试"), {
          statusCode: 409,
          code: "MAINTENANCE_BUSY"
        });
      if (request.url.startsWith("/api/v1/components/") && diagnosticService.isBusy())
        throw Object.assign(new Error("有任务、安装或播放尚未结束"), { statusCode: 409, code: "DIAGNOSTICS_BUSY" });
      diagnosticService.gate.enterRequest(request.id);
    }
  });
  app.addHook("onResponse", async (request) => {
    shutdown.leave(request);
    diagnosticService.gate.leaveRequest(request.id);
  });
}
