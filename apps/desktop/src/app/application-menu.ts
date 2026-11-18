import { app, Menu } from "electron";
export function configureApplicationMenu() {
  if (process.platform === "darwin") {
    app.setName("电商工具箱");
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          label: "电商工具箱",
          submenu: [
            { role: "about", label: "关于电商工具箱" },
            { type: "separator" },
            { role: "quit", label: "退出电商工具箱" }
          ]
        },
        {
          label: "窗口",
          submenu: [
            { role: "minimize", label: "最小化" },
            { role: "zoom", label: "缩放" },
            { role: "close", label: "关闭窗口" },
            { type: "separator" },
            { role: "front", label: "全部置于前台" }
          ]
        }
      ])
    );
  } else {
    // The product uses an in-app toolbar; Electron's generated menu has no
    // product commands and exposes irrelevant browser/window controls.
    Menu.setApplicationMenu(null);
  }
}
