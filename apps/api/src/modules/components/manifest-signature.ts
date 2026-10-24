import crypto from "node:crypto";
import type { ComponentPackageManifest } from "./types";
export function canonicalManifest(manifest: ComponentPackageManifest) {
  const { signature: _signature, ...unsigned } = manifest;
  return stableStringify(unsigned);
}

export function verifyManifestSignature(manifest: ComponentPackageManifest, publicKey: string) {
  try {
    return crypto.verify(
      null,
      Buffer.from(canonicalManifest(manifest)),
      publicKey,
      Buffer.from(manifest.signature, "base64")
    );
  } catch {
    return false;
  }
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "number") return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return (
      "{" +
      Object.keys(record)
        .sort()
        .map((key) => JSON.stringify(key) + ":" + stableStringify(record[key]))
        .join(",") +
      "}"
    );
  }
  throw new Error("Manifest contains an unsupported value");
}
