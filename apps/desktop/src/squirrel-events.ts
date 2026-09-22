/** 中文模块说明：桌面壳更新层，负责识别 Squirrel 安装、升级和卸载的短生命周期命令。 */
import path from "node:path";

export type SquirrelCommand = { executable: string; args: string[] };

export function squirrelLifecycleCommand(argv: string[], executablePath: string): SquirrelCommand | undefined {
  const event = argv.find((value) => value.startsWith("--squirrel-"));
  if (!event) return undefined;
  const updateExecutable = path.resolve(path.dirname(executablePath), "..", "Update.exe");
  const appExecutable = path.basename(executablePath);
  if (event === "--squirrel-install" || event === "--squirrel-updated") {
    return { executable: updateExecutable, args: ["--createShortcut", appExecutable] };
  }
  if (event === "--squirrel-uninstall") {
    return { executable: updateExecutable, args: ["--removeShortcut", appExecutable] };
  }
  if (event === "--squirrel-obsolete") return { executable: updateExecutable, args: [] };
  return undefined;
}

export function isSquirrelFirstRun(argv: string[]) {
  return argv.includes("--squirrel-firstrun");
}
