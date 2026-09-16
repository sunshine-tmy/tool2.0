/**
 * 中文模块说明：维护清理的安全回归测试。
 *
 * 重点保护“演练”语义：前端或自动化脚本可以预估清理范围，但不能借由 dry-run 修改归档、SQLite
 * 或文件元数据。这里注入纯内存清理执行器，避免测试接触开发目录中的真实 storage。
 */
import fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { registerMaintenanceRoutes } from "../modules/maintenance";
import type { AppConfig } from "../config";
import type { ToolboxDatabase } from "../database/toolbox-database";
import type { XhsArchiveStore } from "../modules/xhs-archive/store";

describe("maintenance cleanup safety", () => {
  it("does not synchronize or delete metadata during a dry run", async () => {
    const app = fastify();
    // registerMaintenanceRoutes 在主应用中依赖统一响应钩子补入 requestId；独立路由测试复用该契约。
    app.addHook("preSerialization", async (request, _reply, payload) => {
      if (typeof payload !== "object" || payload === null) return payload;
      const value = payload as Record<string, unknown>;
      return typeof value.success === "boolean" ? { ...value, requestId: request.id } : payload;
    });
    const purgeAll = vi.fn();
    registerMaintenanceRoutes(app, {
      config: {} as AppConfig,
      database: {} as ToolboxDatabase,
      xhsStore: { purgeAll } as unknown as XhsArchiveStore,
      cleanupRunner: vi.fn().mockResolvedValue([{ id: "xhs-archive", label: "归档", files: 1, bytes: 16 }])
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/maintenance/cleanup",
      payload: { ids: ["xhs-archive"], dryRun: true }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ success: true, data: [{ id: "xhs-archive" }] });
    expect(purgeAll).not.toHaveBeenCalled();
    await app.close();
  });
});
