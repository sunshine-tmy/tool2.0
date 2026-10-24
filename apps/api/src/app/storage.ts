/** Application assembly step; called directly on the original Fastify instance. */
import fsp from "node:fs/promises";
import { type FastifyInstance } from "fastify";
import { type AppConfig } from "../config";
import { reconcileLanStorage } from "../database/storage-consistency";
import { reconcileFileMetadataStorage } from "../database/file-consistency";
import { reconcileDomainRecords } from "../database/domain-consistency";
import type { ToolboxDatabase } from "../database/toolbox-database";
import type { AppOptions } from "./options";
export async function prepareAppStorage(
  app: FastifyInstance,
  config: AppConfig,
  database: ToolboxDatabase,
  options: Pick<AppOptions, "onStage">
) {
  const requiredStorageDirectories = [
    config.storageRoot,
    config.migrationBackupDir,
    config.quarantineDir,
    config.uploadDir,
    config.outputDir,
    config.tempDir,
    config.lanTransferFilesDir,
    config.imageAiInputsDir,
    config.imageAiOutputsDir,
    config.imageAiTasksDir,
    config.edgeTtsTasksDir,
    config.chatterboxTasksDir,
    config.xhsArchiveItemsDir,
    config.xhsArchiveStagingDir
  ];
  options.onStage?.("storage");
  // 所有领域目录在注册路由前创建，保证首次启动和健康检查不会因缺失目录失败。
  await Promise.all(requiredStorageDirectories.map((directory) => fsp.mkdir(directory, { recursive: true })));

  // 启动阶段只报告缺失工件，绝不删除领域记录。这样存储盘暂时不可用、挂载为空或路径被误改时，
  // 都不会把仍可恢复的本地数据误判为孤儿；破坏性同步仅能由明确选择的维护清理触发。
  const domainConsistency = await reconcileDomainRecords(config, database, { mode: "report" });
  if (domainConsistency.missing > 0 || domainConsistency.failures.length > 0) {
    app.log.warn(
      {
        checked: domainConsistency.checked,
        missing: domainConsistency.missing,
        failures: domainConsistency.failures.length
      },
      "Domain record consistency check found missing artifacts without deleting metadata"
    );
  }
  return requiredStorageDirectories;
}
export async function reconcilePersistentStorage(app: FastifyInstance, config: AppConfig, database: ToolboxDatabase) {
  if (config.databasePath !== ":memory:") {
    // 持久化启动时执行可恢复的一致性检查；异常文件进入隔离区而不是直接删除，保护本地数据。
    const consistency = await reconcileLanStorage(config, database);
    if (consistency.quarantinedFiles || consistency.quarantinedRecords || consistency.failures.length) {
      app.log.warn(
        {
          quarantinedFiles: consistency.quarantinedFiles,
          quarantinedRecords: consistency.quarantinedRecords,
          failures: consistency.failures.length
        },
        "LAN storage consistency check found recoverable issues"
      );
    }
    const fileConsistency = await reconcileFileMetadataStorage(config, database);
    if (fileConsistency.quarantined || fileConsistency.removedMetadata || fileConsistency.failures.length) {
      app.log.warn(
        {
          checked: fileConsistency.checked,
          quarantined: fileConsistency.quarantined,
          removedMetadata: fileConsistency.removedMetadata,
          failures: fileConsistency.failures.length
        },
        "File metadata consistency check found recoverable issues"
      );
    }
  }
}
