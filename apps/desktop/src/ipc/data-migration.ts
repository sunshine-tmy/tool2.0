import crypto from "node:crypto";
import path from "node:path";
import { dialog, type IpcMainInvokeEvent } from "electron";
import { importDesktopData, rollbackDesktopData } from "../data/desktop-data-migration";
import { updateDesktopSettings } from "../data/desktop-settings";
import type { DesktopLegacyDirectorySelection } from "@toolbox/shared/desktop";
import type { DesktopIpcContext, DesktopIpcSecurity } from "./desktop-context";
export function createDesktopDataHandlers(
  context: Pick<DesktopIpcContext, "layout" | "withBackendStopped" | "migrationOptions"> & DesktopIpcSecurity
) {
  const { layout, withBackendStopped, assertTrustedSender, getMainWindow, migrationOptions: options } = context;
  const selectedLegacyDirectories = new Map<string, { path: string; expiresAt: number }>();
  return {
    selectLegacyDirectory: async (event: IpcMainInvokeEvent): Promise<DesktopLegacyDirectorySelection> => {
      assertTrustedSender(event);
      const selected = await dialog.showOpenDialog(getMainWindow()!, {
        title: "选择旧版电商工具箱数据目录",
        buttonLabel: "选择此目录",
        properties: ["openDirectory", "dontAddToRecent"]
      });
      if (selected.canceled || !selected.filePaths[0]) return { canceled: true };
      const selectionId = crypto.randomBytes(18).toString("base64url");
      selectedLegacyDirectories.set(selectionId, {
        path: selected.filePaths[0],
        expiresAt: Date.now() + 10 * 60_000
      });
      return { canceled: false, selectionId, displayName: path.basename(selected.filePaths[0]) };
    },
    importLegacyData: async (event: IpcMainInvokeEvent, selectionId: unknown) => {
      assertTrustedSender(event);
      const selected = typeof selectionId === "string" ? selectedLegacyDirectories.get(selectionId) : undefined;
      selectedLegacyDirectories.delete(typeof selectionId === "string" ? selectionId : "");
      if (!selected || selected.expiresAt < Date.now()) throw new Error("历史目录选择已失效，请重新选择");
      const result = await withBackendStopped(async () => {
        const migrated = await importDesktopData(options, selected.path);
        await updateDesktopSettings(layout.configRoot, {
          lastMigration: {
            id: migrated.id,
            status: "imported",
            completedAt: new Date().toISOString(),
            files: migrated.source.files,
            bytes: migrated.source.bytes
          }
        });
        return migrated;
      });
      return result;
    },
    rollbackDataMigration: async (event: IpcMainInvokeEvent, migrationId: unknown) => {
      assertTrustedSender(event);
      if (typeof migrationId !== "string") throw new Error("迁移编号无效");
      const result = await withBackendStopped(async () => {
        const rolledBack = await rollbackDesktopData(options, migrationId);
        await updateDesktopSettings(layout.configRoot, {
          lastMigration: {
            id: rolledBack.id,
            status: "rolled-back",
            completedAt: new Date().toISOString(),
            files: rolledBack.restored.files,
            bytes: rolledBack.restored.bytes
          }
        });
        return rolledBack;
      });
      return result;
    }
  };
}
