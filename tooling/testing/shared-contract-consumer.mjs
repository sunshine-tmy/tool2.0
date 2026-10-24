/** Shared dist-only consumer fixture; code samples are fixed engineering inputs, never user payloads. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readdir, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ts from "typescript";
import { build } from "tsup";

export async function smokeSharedContract(repoRoot, { name, declarations, runtime, browserRuntime }) {
  assert.match(name, /^[a-z][a-z-]{0,39}$/);
  const prefix = `toolbox-${name}-contract-`;
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  try {
    const consumer = path.join(root, "共享 契约消费端");
    const sharedRoot = path.join(repoRoot, "packages/shared");
    const installed = path.join(consumer, "node_modules/@toolbox/shared");
    await mkdir(installed, { recursive: true });
    await cp(path.join(sharedRoot, "package.json"), path.join(installed, "package.json"));
    await cp(path.join(sharedRoot, "dist"), path.join(installed, "dist"), { recursive: true });
    await cp(
      await realpath(path.join(sharedRoot, "node_modules/@sinclair/typebox")),
      path.join(consumer, "node_modules/@sinclair/typebox"),
      { recursive: true }
    );
    await writeFile(path.join(consumer, "package.json"), '{"type":"module"}\n');
    const source = path.join(consumer, "consumer.ts");
    await writeFile(source, declarations);
    const program = ts.createProgram([source], {
      strict: true,
      noEmit: true,
      types: [],
      lib: ["lib.es2022.d.ts"],
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      target: ts.ScriptTarget.ES2022
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    assert.equal(
      diagnostics.length,
      0,
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: (file) => file,
        getCurrentDirectory: () => consumer,
        getNewLine: () => "\n"
      })
    );
    const before = await readdir(consumer);
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", runtime], {
      cwd: consumer,
      encoding: "utf8",
      timeout: 30000,
      windowsHide: true
    });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(await readdir(consumer), before, "Contract imports must not create user data");
    if (browserRuntime) {
      const browserSource = path.join(consumer, "browser-consumer.ts");
      const browserOutput = path.join(consumer, "browser-dist");
      await writeFile(browserSource, browserRuntime);
      await build({
        entry: { "browser-consumer": browserSource.split(path.sep).join("/") },
        outDir: browserOutput,
        platform: "browser",
        format: ["esm"],
        target: "es2022",
        bundle: true,
        treeshake: true,
        splitting: false,
        noExternal: [/.*/],
        dts: false,
        config: false,
        silent: true
      });
      const beforeBrowser = await readdir(consumer);
      const browser = spawnSync(process.execPath, [path.join(browserOutput, "browser-consumer.js")], {
        cwd: consumer,
        encoding: "utf8",
        timeout: 30000,
        windowsHide: true
      });
      if (browser.error) throw browser.error;
      assert.equal(browser.status, 0, browser.stderr);
      assert.deepEqual(await readdir(consumer), beforeBrowser, "Browser contract evaluation must not create data");
    }
  } finally {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith(prefix));
    await rm(root, { recursive: true, force: true });
  }
}
