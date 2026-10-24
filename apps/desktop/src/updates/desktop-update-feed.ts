/** 中文模块说明：桌面壳更新层，负责读取并校验 electron-builder 写入的不可变 HTTPS 更新源。 */
import fs from "node:fs";
import path from "node:path";

export function readDesktopUpdateFeed(resourcesPath: string) {
  try {
    const config = fs.readFileSync(path.join(resourcesPath, "app-update.yml"), "utf8");
    if (!/^provider:\s*generic\s*$/m.test(config)) return undefined;
    const value = config.match(/^url:\s*(\S+)\s*$/m)?.[1]?.trim() ?? "";
    if (!value) return undefined;
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return undefined;
    return url.toString().replace(/\/$/, "");
  } catch {
    return undefined;
  }
}
