/**
 * 中文模块说明：后端数据库层，负责 SQLite 连接、Schema、事务和领域 Repository 能力
 */
import fs from "node:fs";
import { getConfig } from "../config";
import {
  inspectLegacyMetadata,
  openToolboxDatabase,
  rollbackDatabase,
  verifyMigrationBackup
} from "./legacy-migration";
import { ToolboxDatabase } from "./toolbox-database";

const [command, ...args] = process.argv.slice(2);
if (command !== "migrate" && command !== "verify" && command !== "rollback") {
  throw new Error("Usage: database cli <migrate [--dry-run]|verify|rollback --backup <id>>");
}
const config = getConfig();

if (command === "rollback") {
  const backupFlag = args.indexOf("--backup");
  const backupId = backupFlag >= 0 ? args[backupFlag + 1] : undefined;
  if (!backupId) throw new Error("Usage: pnpm db:rollback --backup <id>");
  await verifyMigrationBackup(config, backupId);
  let rollbackCopy: string | undefined;
  if (fs.existsSync(config.databasePath)) {
    rollbackCopy = `${config.databasePath}.before-rollback-${Date.now()}`;
    fs.renameSync(config.databasePath, rollbackCopy);
    for (const suffix of ["-wal", "-shm"]) {
      if (fs.existsSync(`${config.databasePath}${suffix}`)) {
        fs.renameSync(`${config.databasePath}${suffix}`, `${rollbackCopy}${suffix}`);
      }
    }
  }
  try {
    console.log(JSON.stringify(await rollbackDatabase(config, backupId), null, 2));
  } catch (error) {
    if (rollbackCopy && !fs.existsSync(config.databasePath) && fs.existsSync(rollbackCopy)) {
      fs.renameSync(rollbackCopy, config.databasePath);
      for (const suffix of ["-wal", "-shm"]) {
        if (fs.existsSync(`${rollbackCopy}${suffix}`)) {
          fs.renameSync(`${rollbackCopy}${suffix}`, `${config.databasePath}${suffix}`);
        }
      }
    }
    throw error;
  }
  process.exit(0);
}

if (command === "migrate" && args.includes("--dry-run")) {
  console.log(JSON.stringify(await inspectLegacyMetadata(config), null, 2));
  process.exit(0);
}

if (command === "migrate") {
  const { database, migration } = await openToolboxDatabase(config);
  try {
    console.log(JSON.stringify(migration, null, 2));
  } finally {
    database.close();
  }
  process.exit(0);
}

if (config.databasePath !== ":memory:" && !fs.existsSync(config.databasePath)) {
  throw new Error(`Database does not exist: ${config.databasePath}`);
}
const database = new ToolboxDatabase(config.databasePath);
try {
  console.log(JSON.stringify(database.verify(), null, 2));
} finally {
  database.close();
}
