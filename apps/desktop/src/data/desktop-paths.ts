import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { app } from "electron";
type DesktopPathOptions = {
  installRoot: string;
  dataRoot: string;
  legacyDataRoot: string;
  packaged: boolean;
  platform: NodeJS.Platform;
};
export function createDesktopPaths(options: DesktopPathOptions) {
  const { installRoot, dataRoot, legacyDataRoot, packaged, platform } = options;
  function desktopRootsWritable() {
    return (
      !packaged ||
      (platform === "darwin"
        ? canWriteDirectory(dataRoot, true)
        : !desktopPathsOverlap(dataRoot, legacyDataRoot) &&
          canWriteDirectory(installRoot) &&
          canWriteDirectory(dataRoot, true))
    );
  }
  function initializeDesktopPaths() {
    if (!desktopRootsWritable()) throw Object.assign(new Error("数据目录不可写"), { code: "EACCES" });
    fs.mkdirSync(path.join(dataRoot, ".runtime"), { recursive: true });
    fs.mkdirSync(path.join(dataRoot, "models"), { recursive: true });
    fs.mkdirSync(path.join(dataRoot, "profile"), { recursive: true });
    fs.mkdirSync(path.join(dataRoot, "temp"), { recursive: true });
    fs.mkdirSync(path.join(dataRoot, "logs", "crash-dumps"), { recursive: true });
    app.setPath("userData", path.join(dataRoot, ".runtime"));
    app.setPath("sessionData", path.join(dataRoot, "profile"));
    app.setPath("temp", path.join(dataRoot, "temp"));
    app.setPath("crashDumps", path.join(dataRoot, "logs", "crash-dumps"));
    app.setAppLogsPath(path.join(dataRoot, "logs"));
  }
  function canWriteDirectory(directory: string, create = false) {
    const probePath = path.join(
      directory,
      `.desktop-write-check-${process.pid}-${crypto.randomBytes(6).toString("hex")}.tmp`
    );
    try {
      if (create) fs.mkdirSync(directory, { recursive: true });
      else if (!fs.statSync(directory).isDirectory()) return false;
      fs.writeFileSync(probePath, "write-check", { flag: "wx" });
      fs.unlinkSync(probePath);
      return true;
    } catch {
      try {
        fs.unlinkSync(probePath);
      } catch {
        // The failed probe is best-effort cleanup; it is never user data.
      }
      return false;
    }
  }
  function desktopPathsOverlap(leftPath: string, rightPath: string) {
    const left = path.resolve(leftPath).toLowerCase();
    const right = path.resolve(rightPath).toLowerCase();
    const contains = (parent: string, candidate: string) => {
      const relative = path.relative(parent, candidate);
      return !relative || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`));
    };
    return contains(left, right) || contains(right, left);
  }
  return { initializeDesktopPaths, desktopRootsWritable };
}
