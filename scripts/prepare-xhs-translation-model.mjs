/**
 * 中文模块说明：工程与 Worker 脚本，负责 开发、清理、构建或发布自动化
 */
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";

const revision = "cf109095479db38d6df799875e34039d4938aaa6";
const root = path.resolve(process.argv[2] || ".runtime/xhs-translation-model-cache");
const source = path.join(root, "source");
const output = path.join(root, "opus-mt-zh-en-ct2-int8");
const asset = path.resolve(process.argv[3] || "opus-mt-zh-en-ct2-int8-cf109095.tar.gz");
const files = [
  "config.json",
  "generation_config.json",
  "pytorch_model.bin",
  "source.spm",
  "target.spm",
  "tokenizer_config.json",
  "vocab.json",
  "README.md",
  "LICENSE"
];
await fs.mkdir(source, { recursive: true });
for (const file of files) {
  const target = path.join(source, file);
  if (fsSync.existsSync(target)) continue;
  const response = await fetch(`https://huggingface.co/Helsinki-NLP/opus-mt-zh-en/resolve/${revision}/${file}`, {
    redirect: "follow"
  });
  if (!response.ok) throw new Error(`下载 ${file} 失败：HTTP ${response.status}`);
  await fs.writeFile(target, Buffer.from(await response.arrayBuffer()));
}
await fs.rm(output, { recursive: true, force: true });
await run("ct2-transformers-converter", ["--model_dir", source, "--output_dir", output, "--quantization", "int8"]);
await fs.copyFile(path.join(source, "README.md"), path.join(output, "MODEL_CARD.md"));
await fs.copyFile(path.join(source, "LICENSE"), path.join(output, "LICENSE"));
const manifestFiles = {};
for (const entry of await fs.readdir(output, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  const bytes = await fs.readFile(path.join(output, entry.name));
  manifestFiles[entry.name] = { size: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") };
}
await fs.writeFile(
  path.join(output, "manifest.json"),
  `${JSON.stringify({ modelId: "Helsinki-NLP/opus-mt-zh-en", revision, quantization: "int8", files: manifestFiles, createdAt: new Date().toISOString() }, null, 2)}\n`
);
await run("tar", ["-czf", asset, "-C", root, path.basename(output)]);
const digest = createHash("sha256")
  .update(await fs.readFile(asset))
  .digest("hex");
console.log(JSON.stringify({ asset, sha256: digest }, null, 2));

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", windowsHide: true });
    child.once("error", reject);
    child.once("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`))));
  });
}
