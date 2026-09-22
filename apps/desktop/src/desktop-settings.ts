/** 中文模块说明：桌面壳设置层，负责将用户偏好以原子文件写入用户数据目录。 */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const SETTINGS_FILE = "desktop-settings.json";

export type DesktopMigrationRecord = {
  id: string;
  status: "imported" | "rolled-back";
  completedAt: string;
  files: number;
  bytes: number;
};

export type DesktopSettings = {
  schemaVersion: 1;
  updatedAt: string;
  startAtLogin: boolean;
  automaticUpdateChecks: boolean;
  lastMigration?: DesktopMigrationRecord;
};

export type DesktopSettingsUpdate = Pick<DesktopSettings, "startAtLogin" | "automaticUpdateChecks">;

export function desktopSettingsPath(configRoot: string) {
  return path.join(path.resolve(configRoot), SETTINGS_FILE);
}

export function defaultDesktopSettings(): DesktopSettings {
  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    startAtLogin: false,
    automaticUpdateChecks: true
  };
}

export async function readDesktopSettings(configRoot: string): Promise<DesktopSettings> {
  const settingsPath = desktopSettingsPath(configRoot);
  try {
    return parseDesktopSettings(JSON.parse(await fs.readFile(settingsPath, "utf8")));
  } catch (error) {
    if (isMissingFile(error)) return defaultDesktopSettings();
    throw new Error("桌面设置文件无效；请先备份后修复用户数据目录中的 desktop-settings.json");
  }
}

export async function updateDesktopSettings(
  configRoot: string,
  update: Partial<DesktopSettingsUpdate> & { lastMigration?: DesktopMigrationRecord | undefined }
) {
  const current = await readDesktopSettings(configRoot);
  const next = parseDesktopSettings({
    ...current,
    ...update,
    schemaVersion: 1,
    updatedAt: new Date().toISOString()
  });
  await writeDesktopSettings(configRoot, next);
  return next;
}

export async function writeDesktopSettings(configRoot: string, settings: DesktopSettings) {
  const settingsPath = desktopSettingsPath(configRoot);
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  const temporary = `${settingsPath}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  try {
    await fs.writeFile(temporary, `${JSON.stringify(parseDesktopSettings(settings), null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx"
    });
    const handle = await fs.open(temporary, "r+");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(temporary, settingsPath);
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

function parseDesktopSettings(value: unknown): DesktopSettings {
  if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.updatedAt !== "string") {
    throw new Error("Invalid desktop settings");
  }
  if (typeof value.startAtLogin !== "boolean" || typeof value.automaticUpdateChecks !== "boolean") {
    throw new Error("Invalid desktop settings");
  }
  const lastMigration = value.lastMigration === undefined ? undefined : parseMigrationRecord(value.lastMigration);
  return {
    schemaVersion: 1,
    updatedAt: value.updatedAt,
    startAtLogin: value.startAtLogin,
    automaticUpdateChecks: value.automaticUpdateChecks,
    ...(lastMigration ? { lastMigration } : {})
  };
}

function parseMigrationRecord(value: unknown): DesktopMigrationRecord {
  if (
    !isRecord(value) ||
    !/^[a-f0-9]{24}$/.test(stringValue(value.id)) ||
    (value.status !== "imported" && value.status !== "rolled-back") ||
    typeof value.completedAt !== "string" ||
    !isNonNegativeInteger(value.files) ||
    !isNonNegativeInteger(value.bytes)
  ) {
    throw new Error("Invalid desktop migration record");
  }
  return {
    id: stringValue(value.id),
    status: value.status,
    completedAt: value.completedAt,
    files: value.files,
    bytes: value.bytes
  };
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isMissingFile(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}
