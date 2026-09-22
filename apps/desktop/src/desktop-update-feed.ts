/** 中文模块说明：桌面壳更新层，负责读取并校验构建时嵌入的不可变 HTTPS 更新源。 */
import fs from "node:fs";
import path from "node:path";

export function readDesktopUpdateFeed(appPath: string) {
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(appPath, "package.json"), "utf8")) as {
      desktopUpdateFeed?: unknown;
    };
    const value = typeof packageJson.desktopUpdateFeed === "string" ? packageJson.desktopUpdateFeed.trim() : "";
    if (!value) return undefined;
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return undefined;
    return url.toString().replace(/\/$/, "");
  } catch {
    return undefined;
  }
}
