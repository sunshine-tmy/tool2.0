/** 中文模块说明：跨平台流式下载固定模型/源码资产，并在完成前验证 SHA-256。 */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Transform, Readable } from "node:stream";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function downloadFixedFile({ url, destination, expectedSha256, fetchImpl = fetch }) {
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("下载地址无效");
  }
  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.username ||
    parsedUrl.password ||
    (expectedSha256 !== undefined && !/^[a-f0-9]{64}$/i.test(expectedSha256))
  ) {
    throw new Error("固定资产必须使用 HTTPS 和有效的 SHA-256");
  }

  const outputPath = path.resolve(destination);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.rm(outputPath, { force: true });
  try {
    const response = await fetchImpl(parsedUrl, { redirect: "follow", signal: AbortSignal.timeout(90 * 60 * 1000) });
    if (!response.ok || !response.body) throw new Error(`固定资产下载失败（HTTP ${response.status}）`);
    const digest = crypto.createHash("sha256");
    const hashStream = new Transform({
      transform(chunk, _encoding, callback) {
        digest.update(chunk);
        callback(null, chunk);
      }
    });
    await pipeline(Readable.fromWeb(response.body), hashStream, createWriteStream(outputPath, { flags: "wx" }));
    const actualSha256 = digest.digest("hex");
    if (expectedSha256 !== undefined && actualSha256 !== expectedSha256.toLowerCase()) {
      throw new Error("固定资产 SHA-256 校验失败");
    }
    return outputPath;
  } catch (error) {
    await fs.rm(outputPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value || values.has(key.slice(2))) throw new Error("命令行参数无效");
    values.set(key.slice(2), value);
  }
  if (
    values.size < 2 ||
    values.size > 3 ||
    !values.has("url") ||
    !values.has("destination") ||
    (values.has("sha256") && !/^[a-f0-9]{64}$/i.test(values.get("sha256")))
  ) {
    throw new Error(
      "用法：node scripts/download-fixed-model-file.mjs --url <HTTPS 地址> --destination <文件> [--sha256 <64 位摘要>]"
    );
  }
  return {
    url: values.get("url"),
    destination: values.get("destination"),
    ...(values.has("sha256") ? { expectedSha256: values.get("sha256") } : {})
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(`已下载并校验固定资产：${await downloadFixedFile(parseArguments(process.argv.slice(2)))}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "固定资产下载失败");
    process.exitCode = 1;
  }
}
