import type { IpcMainInvokeEvent } from "electron";
import { isTrustedBackendUrl } from "../security/window-security";
import type { DesktopIpcContext } from "./desktop-context";
export function desktopSenderAssertion(context: Pick<DesktopIpcContext, "getMainWindow" | "getBackendOrigin">) {
  return (event: IpcMainInvokeEvent) => {
    const mainWindow = context.getMainWindow(),
      backendOrigin = context.getBackendOrigin();
    if (
      !mainWindow ||
      event.sender !== mainWindow.webContents ||
      event.senderFrame !== mainWindow.webContents.mainFrame ||
      !backendOrigin ||
      !isTrustedBackendUrl(event.senderFrame.url, backendOrigin)
    )
      throw new Error("未授权的桌面调用");
  };
}
