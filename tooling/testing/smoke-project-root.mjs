/** Build the actual configuration code into a synthetic ZIP-like tree, never start a service. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "tsup";

export async function smokeProjectRoot(repoRoot, application = ["apps", "api"]) {
  const root = await mkdtemp(path.join(os.tmpdir(), "toolbox-project-root-smoke-"));
  try {
    const legacyRoot = path.join(root, "旧 默认根");
    const appRoot = path.join(legacyRoot, "ZIP 项目 空间");
    const cwd = path.join(root, "其他 工作目录");
    const dist = path.join(appRoot, ...application, "dist");
    const source = path.join(appRoot, ...application, "src");
    await mkdir(dist, { recursive: true });
    await mkdir(source);
    await mkdir(cwd);
    await writeFile(path.join(appRoot, "package.json"), '{"type":"module"}\n');
    await writeFile(
      path.join(appRoot, ".env"),
      "API_PORT=4791\nSTORAGE_ROOT=项目 数据\nDATABASE_PATH=项目 库/state.db\n"
    );
    await cp(path.join(repoRoot, "apps", "api", "src", "project-root.ts"), path.join(source, "project-root.ts"));
    await build({
      entry: { probe: path.join(repoRoot, "apps", "api", "src", "config.ts") },
      outDir: dist,
      tsconfig: path.join(repoRoot, "tsconfig.base.json"),
      config: false,
      format: ["esm"],
      platform: "node",
      target: "node24",
      bundle: true,
      splitting: false,
      noExternal: ["@toolbox/runtime-core"],
      clean: false,
      silent: true
    });
    const imports = `
      import assert from 'node:assert/strict';
      import { getConfig } from ${JSON.stringify(pathToFileURL(path.join(dist, "probe.js")).href)};
      import { getProjectRoot, isBuiltProjectModule } from ${JSON.stringify(pathToFileURL(path.join(source, "project-root.ts")).href)};
      const appRoot = ${JSON.stringify(appRoot)};
      const legacyRoot = ${JSON.stringify(legacyRoot)};
      assert.equal(getProjectRoot(), appRoot);
      assert.equal(isBuiltProjectModule(), false);
    `;
    const run = (code) => {
      const result = spawnSync(process.execPath, ["--input-type=module", "-e", imports + code], {
        cwd,
        encoding: "utf8",
        timeout: 30000
      });
      if (result.error) throw result.error;
      assert.equal(result.status, 0, result.stderr);
    };
    const projectAssertions = `
      assert.equal(config.runtime.appRoot, appRoot);
      assert.equal(config.runtime.configRoot, appRoot);
      assert.equal(config.port, 4791);
      assert.equal(config.storageRoot, ${JSON.stringify(path.join(appRoot, "项目 数据"))});
      assert.equal(config.databasePath, ${JSON.stringify(path.join(appRoot, "项目 库", "state.db"))});
    `;
    run("const config = getConfig({ environment: {} });" + projectAssertions);
    await mkdir(path.join(legacyRoot, "storage"));
    const sentinel = path.join(legacyRoot, "storage", "keep.bin");
    await writeFile(sentinel, "synthetic historical data");
    await writeFile(
      path.join(legacyRoot, ".env"),
      "API_PORT=4792\nSTORAGE_ROOT=历史 数据\nDATABASE_PATH=历史 库/state.db\n"
    );
    run(`assert.throws(() => getConfig({environment: {}}), /LEGACY_RUNTIME_ROOT_DETECTED/);`);
    run(`
      const config = getConfig({ environment: { TOOLBOX_LEGACY_DATA_ROOT: legacyRoot, API_PORT: '4793' } });
      assert.equal(config.runtime.appRoot, appRoot);
      assert.equal(config.runtime.configRoot, legacyRoot);
      assert.equal(config.runtime.runtimeRoot, ${JSON.stringify(path.join(legacyRoot, ".runtime"))});
      assert.equal(config.runtime.modelsRoot, ${JSON.stringify(path.join(legacyRoot, "models"))});
      assert.equal(config.runtime.scriptsRoot, ${JSON.stringify(path.join(appRoot, "scripts"))});
      assert.equal(config.runtime.frontendDistRoot, ${JSON.stringify(path.join(appRoot, ...(application[0] === "apps" ? ["apps", "web", "dist"] : ["frontend", "dist"])))});
      assert.equal(config.port, 4793);
      assert.equal(config.storageRoot, ${JSON.stringify(path.join(legacyRoot, "历史 数据"))});
      assert.equal(config.databasePath, ${JSON.stringify(path.join(legacyRoot, "历史 库", "state.db"))});
    `);
    run("const config = getConfig({ environment: { TOOLBOX_LEGACY_DATA_ROOT: appRoot } });" + projectAssertions);
    assert.equal(await readFile(sentinel, "utf8"), "synthetic historical data");
  } finally {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith("toolbox-project-root-smoke-"));
    await rm(root, { recursive: true, force: true });
  }
  console.log(
    `Project root smoke passed (${application.join("/")}): source/dist, different cwd, legacy refusal and explicit data-root reuse.`
  );
}
