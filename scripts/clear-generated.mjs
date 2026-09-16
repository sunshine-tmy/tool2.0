/**
 * 中文模块说明：工程与 Worker 脚本，负责 开发、清理、构建或发布自动化
 */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { cleanupDefinitions, executeCleanup, inspectCleanupCategories } from "./cleanup-engine.mjs";

const args = process.argv.slice(2);

if (args.includes("--json")) {
  console.log(JSON.stringify(await inspectCleanupCategories()));
  process.exit(0);
}

if (args.includes("--json-web")) {
  const ids = cleanupDefinitions.filter((entry) => !["build", "packages"].includes(entry.id)).map((entry) => entry.id);
  console.log(JSON.stringify(await inspectCleanupCategories(ids)));
  process.exit(0);
}

const executeArg = args.find((arg) => arg.startsWith("--execute="));
if (executeArg) {
  const ids = executeArg.slice("--execute=".length).split(",").filter(Boolean);
  console.log(JSON.stringify(await executeCleanup(ids, { dryRun: args.includes("--dry-run") })));
  process.exit(0);
}

const categories = await inspectCleanupCategories();
const interactive = args.includes("--interactive");
let selected = cleanupDefinitions.filter((entry) => entry.defaults).map((entry) => entry.id);

if (interactive) {
  console.log("请选择要清理的分类（输入编号，多个用逗号分隔）：\n");
  categories.forEach((entry, index) =>
    console.log(
      `${index + 1}. ${entry.label}  ${formatBytes(entry.bytes)} / ${entry.files} 个文件${entry.risk === "high" ? "  [高风险，默认不选]" : entry.requiresStop ? "  [建议先停止服务]" : ""}`
    )
  );
  const reader = createInterface({ input: stdin, output: stdout });
  const defaults = selected.map((id) => cleanupDefinitions.findIndex((entry) => entry.id === id) + 1).join(",");
  const answer = await reader.question(`\n请输入编号（直接回车使用默认安全项：${defaults}）：`);
  if (answer.trim())
    selected = answer
      .split(/[,，\s]+/)
      .map(Number)
      .filter((value) => Number.isInteger(value) && value > 0 && value <= categories.length)
      .map((value) => cleanupDefinitions[value - 1].id);
  const chosen = categories.filter((entry) => selected.includes(entry.id));
  console.log("\n即将清理：");
  chosen.forEach((entry) => console.log(`- ${entry.label}：${formatBytes(entry.bytes)} / ${entry.files} 个文件`));
  const confirm = await reader.question(
    `预计释放 ${formatBytes(chosen.reduce((sum, entry) => sum + entry.bytes, 0))}，确认执行？输入 YES：`
  );
  reader.close();
  if (confirm.trim() !== "YES") {
    console.log("已取消，未删除任何文件。");
    process.exit(0);
  }
}

const results = await executeCleanup(selected, { dryRun: args.includes("--dry-run") });
results.forEach((entry) => {
  console.log(`- ${entry.label}：${formatBytes(entry.bytes)} / ${entry.files} 个文件`);
  if (entry.skippedFiles)
    console.log(`  其中 ${entry.skippedFiles} 个文件被运行中的服务占用已跳过（${formatBytes(entry.skippedBytes)}）`);
});
console.log(
  args.includes("--dry-run")
    ? "演练完成：未删除任何文件。"
    : "清理完成：依赖、模型、Python 环境、.env 和小红书登录态均已保留。"
);

function formatBytes(value) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(1)} GB`;
}
