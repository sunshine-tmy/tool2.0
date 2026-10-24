import crypto from "node:crypto";
import fs from "node:fs";
export async function sha256File(filePath: string) {
  const digest = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(filePath)) digest.update(chunk);
  return digest.digest("hex");
}

export function sha256Text(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
