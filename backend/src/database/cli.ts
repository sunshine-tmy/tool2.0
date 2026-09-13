import fs from "node:fs";
import { getConfig } from "../config";
import { migrateLegacyMetadata, rollbackDatabase } from "./legacy-migration";
import { ToolboxDatabase } from "./toolbox-database";

const [command, ...args] = process.argv.slice(2);
const config = getConfig();

if (command === "rollback") {
  const backupFlag = args.indexOf("--backup");
  const backupId = backupFlag >= 0 ? args[backupFlag + 1] : undefined;
  if (!backupId) throw new Error("Usage: pnpm db:rollback --backup <id>");
  if (fs.existsSync(config.databasePath)) {
    const rollbackCopy = `${config.databasePath}.before-rollback-${Date.now()}`;
    fs.renameSync(config.databasePath, rollbackCopy);
    for (const suffix of ["-wal", "-shm"]) {
      if (fs.existsSync(`${config.databasePath}${suffix}`)) {
        fs.renameSync(`${config.databasePath}${suffix}`, `${rollbackCopy}${suffix}`);
      }
    }
  }
  console.log(JSON.stringify(await rollbackDatabase(config, backupId), null, 2));
  process.exit(0);
}

const database = new ToolboxDatabase(config.databasePath);
try {
  if (command === "migrate") {
    console.log(JSON.stringify(await migrateLegacyMetadata(config, database, args.includes("--dry-run")), null, 2));
  } else if (command === "verify") {
    console.log(JSON.stringify(database.verify(), null, 2));
  } else {
    throw new Error("Usage: database cli <migrate [--dry-run]|verify|rollback --backup <id>>");
  }
} finally {
  database.close();
}
