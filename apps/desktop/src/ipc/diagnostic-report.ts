import fs from "node:fs";
import { dialog, type IpcMainInvokeEvent } from "electron";
import type { DesktopIpcSecurity } from "./desktop-context";
export function createDiagnosticReportHandler(context: DesktopIpcSecurity) {
  const { assertTrustedSender, getMainWindow } = context;
  return async (event: IpcMainInvokeEvent, content: unknown) => {
    assertTrustedSender(event);
    if (typeof content !== "string" || content.length > 256_000) throw new Error("诊断报告无效");
    const value = JSON.parse(content) as { application?: string; schemaVersion?: number };
    if (value.application !== "ecommerce-toolbox" || value.schemaVersion !== 1) throw new Error("诊断报告格式无效");
    const selected = await dialog.showSaveDialog(getMainWindow()!, {
      defaultPath: "toolbox-diagnostics.json",
      filters: [{ name: "JSON", extensions: ["json"] }]
    });
    if (!selected.canceled && selected.filePath) await fs.promises.writeFile(selected.filePath, content, "utf8");
  };
}
