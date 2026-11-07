import path from "node:path";
import fs from "node:fs/promises";
import { dialog, type IpcMainInvokeEvent } from "electron";
import { saveCapabilityExport } from "../data/capability-export";
import type { DesktopIpcContext, DesktopIpcSecurity } from "./desktop-context";

export function createCapabilityExportHandlers(
  context: Pick<DesktopIpcContext, "layout" | "getBackendOrigin"> & DesktopIpcSecurity
) {
  let active: AbortController | undefined;
  return {
    export: async (event: IpcMainInvokeEvent, id: unknown) => {
      context.assertTrustedSender(event);
      if (typeof id !== "string" || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(id)) throw new Error("能力标识无效");
      if (active) throw new Error("已有能力包正在导出，请等待完成或取消");
      const origin = context.getBackendOrigin();
      if (!origin) throw new Error("本地服务尚未就绪");
      const controller = new AbortController();
      active = controller;
      try {
        const selected = await dialog.showSaveDialog(context.getMainWindow()!, {
          title: "导出能力及其共享依赖",
          defaultPath: `${id}.toolbox-capabilities.zip`,
          filters: [{ name: "离线能力备份包", extensions: ["toolbox-capabilities.zip"] }]
        });
        if (selected.canceled || !selected.filePath || controller.signal.aborted) return { canceled: true as const };
        const destination = path.resolve(selected.filePath);
        if (!destination.endsWith(".toolbox-capabilities.zip"))
          throw new Error("请保留 .toolbox-capabilities.zip 文件后缀");
        const realParent = await fs.realpath(path.dirname(destination));
        for (const root of [context.layout.runtimeRoot, context.layout.storageRoot, context.layout.modelsRoot]) {
          const realRoot = await fs.realpath(root).catch(() => path.resolve(root));
          const relative = path.relative(realRoot, realParent);
          if (!relative || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`)))
            throw new Error("请将备份包保存到应用运行时、业务数据和模型目录之外");
        }
        return {
          canceled: false as const,
          ...(await saveCapabilityExport(
            origin,
            id,
            path.join(realParent, path.basename(destination)),
            controller.signal
          ))
        };
      } catch (error) {
        if (controller.signal.aborted) return { canceled: true as const };
        throw error;
      } finally {
        if (active === controller) active = undefined;
      }
    },
    cancel: async (event: IpcMainInvokeEvent) => {
      context.assertTrustedSender(event);
      active?.abort();
    }
  };
}
