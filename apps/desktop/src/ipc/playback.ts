import type { IpcMainInvokeEvent } from "electron";
import type { DesktopIpcContext, DesktopIpcSecurity } from "./desktop-context";
export function createDesktopPlaybackHandler(
  context: Pick<DesktopIpcContext, "setPlaybackActive"> & DesktopIpcSecurity
) {
  const { assertTrustedSender, setPlaybackActive, getMainWindow } = context;
  return (event: IpcMainInvokeEvent, active: unknown) => {
    assertTrustedSender(event);
    if (typeof active !== "boolean") throw new Error("无效的播放状态");
    setPlaybackActive(active);
    getMainWindow()?.webContents.setBackgroundThrottling(!active);
  };
}
