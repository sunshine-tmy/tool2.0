// Anchor filesystem and CLI identity at the stable public entry.
const publicEntryUrl = new URL("../../scripts/doctor.mjs", import.meta.url).href;

/** 开发预检入口：即使依赖未安装也能给出结论；不安装、不清端口、不修改配置。 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const root = fileURLToPath(new URL("..", publicEntryUrl));
const cli = path.join(root, "apps/api/node_modules/tsx/dist/cli.mjs");
const major = Number(process.versions.node.split(".")[0]);
if (major !== 24 || !fs.existsSync(cli)) {
  const result = {
    schemaVersion: 1,
    mode: "development",
    checks: [
      {
        id: "node",
        status: major === 24 ? "ok" : "failed",
        code: major === 24 ? "NODE_READY" : "NODE_VERSION_MISMATCH",
        message: `Node ${process.versions.node}；项目要求 24.x`
      },
      {
        id: "dependencies",
        status: fs.existsSync(cli) ? "ok" : "failed",
        code: fs.existsSync(cli) ? "DEPENDENCIES_PRESENT" : "DEPENDENCIES_MISSING",
        message: "未自动安装任何依赖；缺失时请自行执行锁文件安装"
      }
    ]
  };
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.exitCode = 1;
} else {
  const child = spawnSync(
    process.execPath,
    [
      cli,
      "--tsconfig",
      path.join(root, "apps/api/tsconfig.json"),
      path.join(root, "apps/api/src/diagnostics-cli.ts"),
      ...process.argv.slice(2)
    ],
    { cwd: root, stdio: "inherit", windowsHide: true }
  );
  process.exitCode = child.status ?? 1;
}
