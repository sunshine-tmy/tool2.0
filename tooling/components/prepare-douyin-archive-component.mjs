// Anchor filesystem and CLI identity at the stable public entry.
const publicEntryUrl = new URL("../../scripts/prepare-douyin-archive-component.mjs", import.meta.url).href;

/** 中文模块说明：复用应用内已审核的抖音匿名适配器描述，不复制浏览器或解析实现。 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(publicEntryUrl)), "..");
const SOURCE_DESCRIPTOR = path.join(
  REPOSITORY_ROOT,
  "packaging",
  "components",
  "douyin-archive",
  "adapter",
  "manifest.json"
);
const EXPECTED = Object.freeze({
  protocolVersion: 1,
  platform: "douyin",
  mode: "anonymous",
  parser: "normal-browser",
  browserComponentId: "xhs-browser",
  playwrightVersion: "1.63.0",
  chromiumRevision: "1243",
  chromiumVersion: "153.0.8010.12",
  sourceRevision: "27468deae565fcb3d5a074063703d9df88449aed"
});

export async function prepareDouyinArchiveComponent({ stagingDirectory }) {
  const stage = path.resolve(stagingDirectory);
  if (await pathExists(stage)) throw new Error("抖音适配器暂存目录已存在，拒绝覆盖");
  const sourceStat = await fs.lstat(SOURCE_DESCRIPTOR);
  if (!sourceStat.isFile() || sourceStat.isSymbolicLink()) throw new Error("抖音固定适配器描述文件类型无效");
  const bytes = await fs.readFile(SOURCE_DESCRIPTOR);
  const descriptor = JSON.parse(bytes.toString("utf8"));
  if (
    !descriptor ||
    typeof descriptor !== "object" ||
    Object.keys(EXPECTED).some((key) => descriptor[key] !== EXPECTED[key]) ||
    Object.keys(descriptor).some((key) => !Object.hasOwn(EXPECTED, key))
  ) {
    throw new Error("抖音适配器描述与审核的匿名 Chromium 契约不匹配");
  }
  let stageCreated = false;
  try {
    await fs.mkdir(stage, { recursive: false });
    stageCreated = true;
    const target = path.join(stage, "adapter", "manifest.json");
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, bytes, { flag: "wx" });
    const staged = await fs.readFile(target);
    if (!staged.equals(bytes)) throw new Error("抖音适配器描述复制后摘要不一致");
    const filePaths = await listFiles(stage);
    if (filePaths.length !== 1 || filePaths[0] !== "adapter/manifest.json") {
      throw new Error("抖音能力只能包含已审核的匿名适配器描述");
    }
    return { stagingDirectory: stage, bytes: staged.length, filePaths };
  } catch (error) {
    if (stageCreated) await fs.rm(stage, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

async function listFiles(root) {
  const result = [];
  const visit = async (directory, prefix = "") => {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const fullPath = path.join(directory, entry.name);
      const stat = await fs.lstat(fullPath);
      if (stat.isSymbolicLink()) throw new Error("抖音能力描述目录不允许符号链接");
      if (entry.isDirectory()) await visit(fullPath, relative);
      else if (entry.isFile()) result.push(relative);
      else throw new Error("抖音能力描述目录包含特殊文件");
    }
  };
  await visit(root);
  return result.sort();
}

async function pathExists(candidate) {
  return fs.lstat(candidate).then(
    () => true,
    (error) => {
      if (error?.code === "ENOENT") return false;
      throw error;
    }
  );
}

function parseArguments(argv) {
  const args = argv[0] === "--" ? argv.slice(1) : argv;
  if (args.length !== 2 || args[0] !== "--stage" || !args[1] || args[1].startsWith("--")) {
    throw new Error("用法：pnpm components:prepare-douyin-archive -- --stage <新暂存目录>");
  }
  return { stagingDirectory: args[1] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(publicEntryUrl)) {
  try {
    const result = await prepareDouyinArchiveComponent(parseArguments(process.argv.slice(2)));
    console.log(`抖音匿名适配器描述已复用并自检：${result.stagingDirectory} (${result.bytes} bytes)`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "抖音适配器准备失败");
    process.exitCode = 1;
  }
}
