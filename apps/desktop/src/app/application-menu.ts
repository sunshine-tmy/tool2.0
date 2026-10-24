import { app, Menu } from "electron";
export function configureApplicationMenu() {
  if (process.platform === "darwin") {
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        { label: app.name, submenu: [{ role: "about" }, { type: "separator" }, { role: "quit" }] },
        {
          label: "Edit",
          submenu: [
            { role: "undo" },
            { role: "redo" },
            { type: "separator" },
            { role: "cut" },
            { role: "copy" },
            { role: "paste" },
            { role: "selectAll" }
          ]
        },
        { label: "Window", submenu: [{ role: "minimize" }, { role: "zoom" }, { type: "separator" }, { role: "front" }] }
      ])
    );
  } else {
    // The product uses an in-app toolbar; Electron's generated menu has no
    // product commands and exposes irrelevant browser/window controls.
    Menu.setApplicationMenu(null);
  }
}
