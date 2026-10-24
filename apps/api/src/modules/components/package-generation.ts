import crypto from "node:crypto";
import fsp from "node:fs/promises";
import path from "node:path";
import type { ComponentPackageManifest, CurrentRecord } from "./types";
import { COMPONENT_PROTOCOL_VERSION, COMPONENT_ID, SAFE_VERSION, SHA256 } from "./package-constants";
import { canonicalManifest } from "./manifest-signature";
import { sha256Text } from "./package-hash";
export async function switchCurrent(
  componentRoot: string,
  manifest: ComponentPackageManifest,
  directory: string,
  previous?: CurrentRecord
) {
  const record: CurrentRecord = {
    protocolVersion: COMPONENT_PROTOCOL_VERSION,
    id: manifest.id,
    version: manifest.version,
    directory,
    installedBytes: manifest.installedBytes,
    ...(previous && previous.version !== manifest.version
      ? { previousVersion: previous.version }
      : previous?.previousVersion
        ? { previousVersion: previous.previousVersion }
        : {}),
    installedAt: new Date().toISOString(),
    manifestSha256: sha256Text(canonicalManifest(manifest))
  };
  const currentPath = path.join(componentRoot, "current.json");
  const pendingPath = path.join(componentRoot, ".current." + crypto.randomUUID() + ".partial");
  await fsp.mkdir(componentRoot, { recursive: true });
  await fsp.writeFile(pendingPath, JSON.stringify(record, null, 2) + "\n", { encoding: "utf8", flag: "wx" });
  try {
    await fsp.rename(pendingPath, currentPath);
  } catch (error) {
    await fsp.rm(pendingPath, { force: true });
    throw error;
  }
}
export async function readCurrent(componentRoot: string, expectedId?: string): Promise<CurrentRecord | undefined> {
  try {
    const raw = JSON.parse(
      await fsp.readFile(path.join(componentRoot, "current.json"), "utf8")
    ) as Partial<CurrentRecord>;
    if (
      raw.protocolVersion !== COMPONENT_PROTOCOL_VERSION ||
      typeof raw.id !== "string" ||
      !COMPONENT_ID.test(raw.id) ||
      (expectedId !== undefined && raw.id !== expectedId) ||
      typeof raw.version !== "string" ||
      !SAFE_VERSION.test(raw.version) ||
      typeof raw.directory !== "string" ||
      !SAFE_VERSION.test(raw.directory) ||
      (raw.installedBytes !== undefined && (!Number.isSafeInteger(raw.installedBytes) || raw.installedBytes < 0)) ||
      (raw.previousVersion !== undefined &&
        (typeof raw.previousVersion !== "string" || !SAFE_VERSION.test(raw.previousVersion))) ||
      typeof raw.installedAt !== "string" ||
      Number.isNaN(Date.parse(raw.installedAt)) ||
      typeof raw.manifestSha256 !== "string" ||
      !SHA256.test(raw.manifestSha256)
    )
      return undefined;
    return raw as CurrentRecord;
  } catch {
    return undefined;
  }
}
export async function restoreCurrent(componentRoot: string, previous?: CurrentRecord) {
  const currentPath = path.join(componentRoot, "current.json");
  if (!previous) {
    await fsp.rm(currentPath, { force: true });
    return;
  }
  const pendingPath = path.join(componentRoot, ".current-rollback." + crypto.randomUUID() + ".partial");
  await fsp.writeFile(pendingPath, JSON.stringify(previous, null, 2) + "\n", { encoding: "utf8", flag: "wx" });
  try {
    await fsp.rename(pendingPath, currentPath);
  } catch (error) {
    await fsp.rm(pendingPath, { force: true });
    throw error;
  }
}
