import type { DesktopBridge } from "@toolbox/shared/desktop";

declare global {
  interface Window {
    toolboxDesktop?: DesktopBridge;
  }
}
