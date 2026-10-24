/** Existing pretty-JSON temporary rename; not the durable commit or backup/restore strategy. */
import fsp from "node:fs/promises";
import path from "node:path";

export async function writeJsonAtomic(filePath: string, value: unknown) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fsp.writeFile(temp, JSON.stringify(value, null, 2), "utf8");
  await fsp.rename(temp, filePath);
}
