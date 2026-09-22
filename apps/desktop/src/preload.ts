import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("toolboxDesktop", {
  getVersion: () => ipcRenderer.invoke("desktop:get-version") as Promise<string>
});
