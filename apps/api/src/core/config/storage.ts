import type { ConfigContext } from "./context";
import path from "node:path";
import { readInteger } from "@toolbox/runtime-core";
import { getEnv, resolveDatabasePath } from "./environment";
export function readStorageConfig(context: ConfigContext) {
  const { runtime, storageRoot, fileEnv, environment, pathEnv } = context;
  return {
    storageRoot,
    audioLibraryMaxStorageBytes: readInteger(
      "AUDIO_LIBRARY_MAX_STORAGE_BYTES",
      getEnv("AUDIO_LIBRARY_MAX_STORAGE_BYTES", fileEnv, environment),
      10 * 1024 ** 3,
      1
    ),
    databasePath: resolveDatabasePath(runtime, pathEnv("DATABASE_PATH"), environment.NODE_ENV, storageRoot),
    migrationBackupDir: path.join(storageRoot, "migration-backups"),
    quarantineDir: path.join(storageRoot, "quarantine"),
    uploadDir: path.join(storageRoot, "uploads"),
    outputDir: path.join(storageRoot, "outputs"),
    tempDir: path.join(storageRoot, "temp")
  };
}
