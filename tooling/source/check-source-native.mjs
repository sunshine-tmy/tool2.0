// Anchor filesystem and CLI identity at the stable public entry.
const publicEntryUrl = new URL("../../scripts/check-source-native.mjs", import.meta.url).href;

/** 实际加载源码运行所需原生库，仅使用内存，不接触业务数据库或素材。 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const requireBackend = createRequire(new URL("../apps/api/package.json", publicEntryUrl));

export async function checkSourceNative(load = requireBackend) {
  const Database = load("better-sqlite3");
  const db = new Database(":memory:");
  try {
    db.exec("CREATE TABLE bootstrap_check (value INTEGER NOT NULL)");
    db.prepare("INSERT INTO bootstrap_check VALUES (?)").run(42);
    if (db.prepare("SELECT value FROM bootstrap_check").get().value !== 42) throw new Error("SQLite query failed");
  } finally {
    db.close();
  }
  const sharp = load("sharp");
  const png = await sharp(Buffer.from([255, 0, 0, 255]), { raw: { width: 1, height: 1, channels: 4 } })
    .png()
    .toBuffer();
  if (png.length < 8 || png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw new Error("Sharp PNG failed");
}

if (process.argv[1] === fileURLToPath(publicEntryUrl)) {
  try {
    await checkSourceNative();
    console.log("Native runtime check passed: SQLite in-memory read/write and Sharp PNG encoding.");
  } catch {
    console.error(
      "NATIVE_RUNTIME_UNAVAILABLE: SQLite/Sharp failed to load or execute. Ensure locked platform packages are installed. Do not blindly install Python or enable all dependency build scripts."
    );
    process.exitCode = 1;
  }
}
