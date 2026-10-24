import fs from "node:fs";
import path from "node:path";
import { parseDotEnv } from "@toolbox/runtime-core";
import { resolveRuntimePath, type RuntimeLayout } from "../../runtime/runtime-layout";
import type { AppConfig } from "./types";
export function readDeploymentMode(value: string | undefined): AppConfig["deploymentMode"] {
  const normalized = value?.trim().toLowerCase() || "local";
  if (normalized === "local" || normalized === "lan") return normalized;
  throw new Error("DEPLOYMENT_MODE must be local or lan");
}

export function readLanTransferGuestMode(value: string | undefined): AppConfig["lanTransferGuestMode"] {
  const normalized = value?.trim().toLowerCase() || "full";
  if (
    normalized === "full" ||
    normalized === "upload-only" ||
    normalized === "download-only" ||
    normalized === "disabled"
  ) {
    return normalized;
  }
  throw new Error("LAN_TRANSFER_GUEST_MODE must be full, upload-only, download-only, or disabled");
}

export function getEnv(name: string, fileEnv: Record<string, string>, environment: Record<string, string | undefined>) {
  return environment[name] ?? fileEnv[name];
}

export function loadDotEnv(candidates: string[]) {
  const env: Record<string, string> = {};

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    Object.assign(env, parseDotEnv(fs.readFileSync(candidate, "utf8")));
    break;
  }

  return env;
}

export function resolveConfigPath(runtime: RuntimeLayout, value: string) {
  return resolveRuntimePath(runtime.configRoot, value);
}

export function resolveDatabasePath(
  runtime: RuntimeLayout,
  configuredPath: string | undefined,
  nodeEnv: string | undefined,
  storageRoot: string
) {
  const value = configuredPath?.trim();
  if (value) return value === ":memory:" ? value : resolveConfigPath(runtime, value);
  return nodeEnv === "test" ? ":memory:" : path.join(storageRoot, "toolbox.db");
}

export function readLoopbackWorkerUrl(name: string, value: string | undefined, fallback: string) {
  const candidate = value?.trim() || fallback;
  try {
    const url = new URL(candidate);
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "::1"].includes(host)) throw new Error();
    return url.origin;
  } catch {
    throw new Error(`${name} must be an http loopback URL`);
  }
}

export function readCorsOrigins(fileEnv: Record<string, string>, environment: Record<string, string | undefined>) {
  const configured = getEnv("CORS_ORIGINS", fileEnv, environment)
    ?.split(",")
    .map((value) => normalizeOrigin(value))
    .filter((value): value is string => Boolean(value));
  if (configured?.length) return [...new Set(configured)];

  const defaults = ["http://127.0.0.1:5173", "http://localhost:5173"];
  const legacyApiUrl =
    getEnv("VITE_API_BASE", fileEnv, environment) || getEnv("LAN_PUBLIC_BASE_URL", fileEnv, environment);
  if (legacyApiUrl) {
    try {
      const url = new URL(legacyApiUrl);
      defaults.push(`${url.protocol}//${url.hostname}:5173`);
    } catch {
      // Invalid frontend URLs are ignored here; Vite validates its own configuration.
    }
  }
  return [...new Set(defaults)];
}

function normalizeOrigin(value: string) {
  try {
    return new URL(value.trim()).origin;
  } catch {
    return "";
  }
}
