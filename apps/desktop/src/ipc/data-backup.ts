import { dialog, type IpcMainInvokeEvent } from "electron";
import { isBackupSelection, isBackupPreviewRequest, cleanBackupPreferences } from "@toolbox/shared/system";
import type { DesktopIpcSecurity } from "./desktop-context";
import type { DesktopDataBackup } from "../data/data-backup";
export function createDataBackupHandlers(context: DesktopIpcSecurity, backup: DesktopDataBackup) {
  const check = (event: IpcMainInvokeEvent) => context.assertTrustedSender(event);
  const id = (input: unknown) => {
    if (typeof input !== "string" || !/^[a-f0-9-]{36}$/.test(input)) throw new Error("无效操作编号");
    return input;
  };
  return {
    state: async (event: IpcMainInvokeEvent) => {
      check(event);
      return backup.state();
    },
    select: async (event: IpcMainInvokeEvent) => {
      check(event);
      const selected = await dialog.showOpenDialog(context.getMainWindow()!, {
        title: "选择模块数据备份",
        properties: ["openFile", "dontAddToRecent"],
        filters: [{ name: "模块数据备份", extensions: ["zip"] }]
      });
      if (selected.canceled || !selected.filePaths[0]) return { canceled: true };
      return backup.select(selected.filePaths[0]);
    },
    preview: async (event: IpcMainInvokeEvent, input: unknown) => {
      check(event);
      if (!isBackupPreviewRequest(input)) throw new Error("导入预检参数无效");
      return backup.preview(input.selectionId, input.modules, input.mode);
    },
    export: async (event: IpcMainInvokeEvent, input: unknown) => {
      check(event);
      if (!isBackupSelection(input)) throw new Error("请选择有效模块");
      const selected = await dialog.showSaveDialog(context.getMainWindow()!, {
        title: "导出模块数据",
        defaultPath: `toolbox-backup-${new Date().toISOString().slice(0, 10)}.zip`,
        filters: [{ name: "模块数据备份", extensions: ["zip"] }]
      });
      if (selected.canceled || !selected.filePath) return { canceled: true };
      return { canceled: false, operationId: await backup.export(input, selected.filePath) };
    },
    import: async (event: IpcMainInvokeEvent, input: unknown, preferences?: unknown) => {
      check(event);
      return backup.restore(id(input), cleanBackupPreferences(preferences));
    },
    cancel: async (event: IpcMainInvokeEvent, input: unknown) => {
      check(event);
      return backup.cancel(id(input));
    },
    rollback: async (event: IpcMainInvokeEvent, input: unknown, preferences?: unknown) => {
      check(event);
      return backup.rollback(id(input), cleanBackupPreferences(preferences));
    },
    deletePoint: async (event: IpcMainInvokeEvent, input: unknown) => {
      check(event);
      return backup.deletePoint(id(input));
    }
  };
}
