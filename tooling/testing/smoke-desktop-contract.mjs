/** Dist-only, Node/Electron-free type consumption from an unrelated temporary project. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ts from "typescript";

export async function smokeDesktopContract(repoRoot) {
  const root = await mkdtemp(path.join(os.tmpdir(), "toolbox-desktop-contract-"));
  try {
    const consumer = path.join(root, "浏览器 契约消费端");
    const installed = path.join(consumer, "node_modules/@toolbox/shared");
    await mkdir(installed, { recursive: true });
    await cp(path.join(repoRoot, "packages/shared/package.json"), path.join(installed, "package.json"));
    await cp(path.join(repoRoot, "packages/shared/dist"), path.join(installed, "dist"), { recursive: true });
    await writeFile(path.join(consumer, "package.json"), '{"type":"module"}\n');
    const source = path.join(consumer, "consumer.ts");
    await writeFile(
      source,
      `
      import type {DesktopBridge, DesktopSettingsState, DesktopRootMigrationResult, StartupSnapshot, ShutdownPreparation} from '@toolbox/shared/desktop';
      declare const desktop: DesktopBridge;
      const version: Promise<string> = desktop.getVersion();
      const settings: Promise<DesktopSettingsState> = desktop.updateSettings({startAtLogin: true});
      const migrated: Promise<DesktopRootMigrationResult | void> = desktop.migrateStartupData();
      const optional: DesktopBridge['saveDiagnosticReport'] = undefined;
      const stop: () => void = desktop.onStartupDiagnostics((state: StartupSnapshot) => { const revision: number = state.revision; });
      const shutdown: ShutdownPreparation = {busy:false, blocked:false, prepared:true};
      // @ts-expect-error A generic renderer IPC capability must never exist.
      desktop.invoke('arbitrary-channel');
      // @ts-expect-error Existing settings values remain booleans.
      desktop.updateSettings({startAtLogin: 'yes'});
      // @ts-expect-error getVersion remains a zero-argument method.
      desktop.getVersion('unexpected');
    `
    );
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
    const result = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `
      import assert from 'node:assert/strict';
      import * as contract from '@toolbox/shared/desktop';
      assert.deepEqual(Object.keys(contract), []);
    `
      ],
      { cwd: consumer, encoding: "utf8", timeout: 30000, windowsHide: true }
    );
    if (result.error) throw result.error;
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(await readdir(consumer), before);
  } finally {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith("toolbox-desktop-contract-"));
    await rm(root, { recursive: true, force: true });
  }
  console.log(
    "Desktop contract smoke passed: isolated dist subpath, no Node/Electron ambient types, fixed method boundaries."
  );
}
