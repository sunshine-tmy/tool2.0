/** Fixed offline helper invoked only by the trusted desktop main process. No HTTP listener or workers. */
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { getConfig } from "./config";
import { createRuntimeLayout } from "@toolbox/runtime-core";
import type { BackupModuleId, BackupMode, BackupSelection } from "@toolbox/shared/system";
import { backupModules, BackupSelectionSchema } from "@toolbox/shared/system";
import { Value } from "@sinclair/typebox/value";
import {
  snapshot,
  inspectPackage,
  previewImport,
  restoreImport,
  packBundle,
  recoverRestores,
  readJson,
  type BackupContext
} from "./system/data-backup/service";
import type { BackupBundle, BackupManifest, ModuleData } from "./system/data-backup/types";

type Command = {
  action: "recover" | "snapshot" | "pack" | "inspect" | "preview" | "restore" | "rollback";
  id: string;
  file?: string;
  selection?: BackupSelection;
  modules?: BackupModuleId[];
  mode?: BackupMode;
  planId?: string;
  restorePointId?: string;
  preferences?: Record<string, string>;
};
type Port = {
  postMessage(message: unknown): void;
  on(event: "message", listener: (event: { data: { type?: string; command?: Command } }) => void): void;
};
const port = (process as NodeJS.Process & { parentPort?: Port }).parentPort;
if (!port) throw new Error("data-backup-entry requires the desktop utility process");
const controller = new AbortController();
let started = false,
  lastProgress = 0;
port.on("message", (event) => {
  if (event.data?.type === "cancel") {
    controller.abort(new Error("已取消"));
    return;
  }
  if (event.data?.type !== "run" || started || !event.data.command) return;
  started = true;
  void run(event.data.command).then(
    (result) => {
      port.postMessage({ type: "result", result });
      process.exit(0);
    },
    (error) => {
      port.postMessage({
        type: "error",
        message: error instanceof Error ? error.message : "备份操作失败",
        canceled:
          controller.signal.aborted &&
          (error === controller.signal.reason || (error instanceof Error && error.name === "AbortError"))
      });
      process.exit(1);
    }
  );
});
port.postMessage({ type: "ready" });
async function run(command: Command) {
  if (!/^[a-f0-9-]{36}$/.test(command.id)) throw new Error("备份操作编号无效");
  const layout = createRuntimeLayout(JSON.parse(process.env.TOOLBOX_RUNTIME_LAYOUT ?? "null"));
  const config = getConfig({
    layout,
    dotenvPath: false,
    desktopManagedCapabilities: true,
    environment: { ...process.env, DEPLOYMENT_MODE: "local" }
  });
  const context: BackupContext = {
    config,
    controlRoot: path.resolve(layout.configRoot, "..", "module-backups"),
    appVersion: process.env.TOOLBOX_APP_VERSION ?? "unknown",
    signal: controller.signal,
    progress: (phase, files, totalFiles, bytes, totalBytes) => {
      if (Date.now() - lastProgress < 100 && files !== totalFiles && phase !== "正在安全提交") return;
      lastProgress = Date.now();
      port!.postMessage({ type: "progress", phase, files, totalFiles, bytes, totalBytes });
    }
  };
  await fs.mkdir(context.controlRoot, { recursive: true });
  const work = path.join(context.controlRoot, "work", command.id);
  let success = false;
  try {
    const result = await execute(command, context, work);
    success = true;
    return result;
  } finally {
    await fs.rm(path.join(work, "package"), { recursive: true, force: true });
    if (!(success && (command.action === "snapshot" || command.action === "preview")))
      await fs.rm(work, { recursive: true, force: true });
  }
}
async function execute(command: Command, context: BackupContext, work: string): Promise<unknown> {
  if (command.action === "recover") {
    await recoverRestores(context);
    return {};
  }
  if (command.action === "snapshot") {
    if (!Value.Check(BackupSelectionSchema, command.selection)) throw new Error("请选择有效业务模块");
    const bundle = await snapshot(context, command.selection, path.join(work, "snapshot"));
    return bundle.manifest.modules;
  }
  if (command.action === "pack") {
    if (!command.file) throw new Error("未选择保存位置");
    const bundle = await loadSnapshot(path.join(work, "snapshot"));
    await packBundle(bundle, command.file, controller.signal, context.progress);
    await fs.rm(path.join(work, "snapshot"), { recursive: true, force: true });
    return {};
  }
  if (command.action === "inspect") {
    if (!command.file) throw new Error("未选择备份文件");
    try {
      return (await inspectPackage(context, command.file, path.join(work, "package"))).manifest.modules;
    } finally {
      await fs.rm(path.join(work, "package"), { recursive: true, force: true });
    }
  }
  if (command.action === "preview") {
    if (
      !command.file ||
      !command.modules ||
      !Value.Check(BackupSelectionSchema, { modules: command.modules }) ||
      !["merge", "replace"].includes(command.mode ?? "")
    )
      throw new Error("导入预检参数无效");
    return previewImport(context, command.file, command.modules, command.mode!, command.id);
  }
  if (command.action === "restore") {
    if (!command.planId || !/^[a-f0-9-]{36}$/.test(command.planId)) throw new Error("预检编号无效");
    return restoreImport(context, command.planId, command.id, command.preferences);
  }
  if (command.action === "rollback") {
    if (!command.restorePointId || !/^[a-f0-9-]{36}$/.test(command.restorePointId)) throw new Error("恢复点编号无效");
    const bundle = await loadSnapshot(path.join(context.controlRoot, "restore-points", command.restorePointId));
    await fs.mkdir(work, { recursive: true });
    const file = path.join(work, "rollback.zip");
    try {
      await packBundle(bundle, file, controller.signal, context.progress);
      const planId = crypto.randomUUID();
      await previewImport(
        context,
        file,
        bundle.modules.map((m) => m.id),
        "replace",
        planId
      );
      return await restoreImport(context, planId, command.id, command.preferences);
    } finally {
      await fs.rm(file, { force: true });
    }
  }
  throw new Error("不支持的备份操作");
}
async function loadSnapshot(directory: string): Promise<BackupBundle> {
  const manifest = await readJson<BackupManifest>(path.join(directory, "manifest.json"));
  if (
    !manifest ||
    manifest.format !== "toolbox-module-backup" ||
    manifest.version !== 1 ||
    !Array.isArray(manifest.modules)
  )
    throw new Error("恢复点无效");
  const modules: ModuleData[] = [];
  for (const m of manifest.modules) {
    if (!backupModules.some((entry) => entry.id === m.id)) throw new Error("恢复点模块不兼容");
    const meta = await readJson<Omit<ModuleData, "files">>(path.join(directory, "modules", m.id, "records.json"));
    const files = await readJson<ModuleData["files"]>(path.join(directory, "modules", m.id, "files.json"));
    if (!meta || !files) throw new Error("恢复点不完整");
    modules.push({ ...meta, files });
  }
  return { manifest, modules, directory };
}
