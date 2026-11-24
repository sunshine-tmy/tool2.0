import crypto from "node:crypto";
import fs from "node:fs";
export async function sha256File(
  filePath: string,
  options?: { signal?: AbortSignal; onBytes?: (bytes: number) => void }
) {
  const digest = crypto.createHash("sha256");
  let bytes = 0;
  for await (const chunk of fs.createReadStream(filePath, { signal: options?.signal })) {
    digest.update(chunk);
    bytes += chunk.length;
    options?.onBytes?.(bytes);
  }
  return digest.digest("hex");
}

export function sha256Text(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
