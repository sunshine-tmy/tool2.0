/**
 * 中文模块说明：维护清理的安全回归测试。
 *
 * 重点保护“演练”语义：前端或自动化脚本可以预估清理范围，但不能借由 dry-run 修改归档、SQLite
 * 或文件元数据。这里注入纯内存清理执行器，避免测试接触开发目录中的真实 storage。
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
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

  it("limits desktop cleanup to expired logs and temporary files", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-desktop-cleanup-"));
    const dataRoot = path.join(root, "data");
    const runtimeRoot = path.join(dataRoot, "components");
    const storageRoot = path.join(dataRoot, "data");
    const oldLog = path.join(dataRoot, "logs", "old.log");
    const currentLog = path.join(dataRoot, "logs", "current.log");
    const oldTemp = path.join(dataRoot, "temp", "old.tmp");
    const oldStorageTemp = path.join(storageRoot, "temp", "stale.tmp");
    const userWork = path.join(storageRoot, "outputs", "finished-work.txt");
    const model = path.join(dataRoot, "models", "model.bin");
    const outside = path.join(root, "outside.txt");
    const age = async (file: string, days: number) => {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, "clearable");
      const timestamp = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      await fs.utimes(file, timestamp, timestamp);
    };

    try {
      await age(oldLog, 8);
      await age(currentLog, 1);
      await age(oldTemp, 2);
      await age(oldStorageTemp, 2);
      await fs.mkdir(path.dirname(userWork), { recursive: true });
      await fs.mkdir(path.dirname(model), { recursive: true });
      await fs.writeFile(userWork, "keep-work");
      await fs.writeFile(model, "keep-model");
      await fs.writeFile(outside, "outside-data");

      const app = fastify();
      app.addHook("preSerialization", async (request, _reply, payload) => {
        if (typeof payload !== "object" || payload === null) return payload;
        const value = payload as Record<string, unknown>;
        return typeof value.success === "boolean" ? { ...value, requestId: request.id } : payload;
      });
      registerMaintenanceRoutes(app, {
        config: {
          desktopManagedCapabilities: true,
          runtime: { runtimeRoot, storageRoot }
        } as AppConfig,
        database: {} as ToolboxDatabase
      });

      try {
        const inspected = await app.inject({ method: "GET", url: "/api/v1/maintenance/cleanup" });
        expect(inspected.statusCode).toBe(200);
        expect(inspected.json().data).toEqual([
          expect.objectContaining({ id: "logs", files: 1, bytes: 9, defaults: false, risk: "low" }),
          expect.objectContaining({ id: "temp", files: 2, bytes: 18, defaults: false, risk: "low" })
        ]);

        const rejected = await app.inject({
          method: "POST",
          url: "/api/v1/maintenance/cleanup",
          payload: { ids: ["logs", "../../outside.txt"] }
        });
        expect(rejected.statusCode).toBe(400);
        expect(rejected.json().error.code).toBe("CLEANUP_CATEGORY_NOT_ALLOWED");
        await expect(fs.readFile(oldLog, "utf8")).resolves.toBe("clearable");

        const malformed = await app.inject({
          method: "POST",
          url: "/api/v1/maintenance/cleanup",
          payload: { ids: ["logs", 17] }
        });
        expect(malformed.statusCode).toBe(400);
        await expect(fs.readFile(oldLog, "utf8")).resolves.toBe("clearable");

        const preview = await app.inject({
          method: "POST",
          url: "/api/v1/maintenance/cleanup",
          payload: { ids: ["logs", "temp"], dryRun: true }
        });
        expect(preview.statusCode).toBe(200);
        await expect(fs.readFile(oldLog, "utf8")).resolves.toBe("clearable");

        const cleaned = await app.inject({
          method: "POST",
          url: "/api/v1/maintenance/cleanup",
          payload: { ids: ["logs", "temp"] }
        });
        expect(cleaned.statusCode).toBe(200);
        expect(cleaned.json().data).toMatchObject([
          { id: "logs", files: 1, bytes: 9 },
          { id: "temp", files: 2, bytes: 18 }
        ]);
        await expect(fs.access(oldLog)).rejects.toThrow();
        await expect(fs.access(oldTemp)).rejects.toThrow();
        await expect(fs.access(oldStorageTemp)).rejects.toThrow();
        await expect(fs.readFile(currentLog, "utf8")).resolves.toBe("clearable");
        await expect(fs.readFile(userWork, "utf8")).resolves.toBe("keep-work");
        await expect(fs.readFile(model, "utf8")).resolves.toBe("keep-model");
        await expect(fs.readFile(outside, "utf8")).resolves.toBe("outside-data");
      } finally {
        await app.close();
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
