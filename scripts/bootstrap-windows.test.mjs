/** Bootstrap shell tests: plan/AST/hash/shim checks only; never download packages or execute the real launcher. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const script = path.join(root, "scripts/bootstrap-windows.ps1");
const windows = process.platform === "win32";
const quote = (value) => `'${value.replaceAll("'", "''")}'`;
const run = (code) =>
  execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", code], {
    encoding: "utf8",
    timeout: 20_000,
    windowsHide: true
  });

test(
  "Windows 5.1 can parse the launcher and plan mode requires neither Node nor dependencies",
  { skip: !windows },
  () => {
    const output = run(
      `$e=$null; $t=$null; [System.Management.Automation.Language.Parser]::ParseFile(${quote(script)},[ref]$t,[ref]$e) | Out-Null; if($e.Count){throw ($e|Out-String)}; & ${quote(script)} -PlanOnly`
    );
    assert.match(output, /no downloads, writes/);
    assert.match(output, /6\/6/);
  }
);

test("archive digest gates reject tampering before extraction", { skip: !windows }, async () => {
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-bootstrap-test-"));
  try {
    const file = path.join(scratch, "archive.bin");
    await fs.writeFile(file, "abc");
    const output = run(
      `$e=$null;$t=$null;$ast=[System.Management.Automation.Language.Parser]::ParseFile(${quote(script)},[ref]$t,[ref]$e); $fn=$ast.Find({param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Test-ArchiveHash'},$true); . ([scriptblock]::Create($fn.Extent.Text)); if(-not (Test-ArchiveHash ${quote(file)} SHA256 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')){throw 'valid rejected'}; if(Test-ArchiveHash ${quote(file)} SHA256 ('0'*64)){throw 'tampering accepted'}; if(-not (Test-ArchiveHash ${quote(file)} SHA512 '3a81oZNherrMQXNJriBBMRLm+k6JqX6iCp7u5ktV05ohkpkqJ0/BqDa6PCOj/uu9RU1EI2Q86A4qmslPpUyknw==')){throw 'SHA512 rejected'}; 'digest gates passed'`
    );
    assert.match(output, /digest gates passed/);
  } finally {
    await fs.rm(scratch, { recursive: true, force: true });
  }
});

test("entry and safeguards preserve legacy development without global installs", async () => {
  const shell = await fs.readFile(script, "utf8");
  const entry = await fs.readFile(path.join(root, "start.bat"), "utf8");
  assert.match(entry, /bootstrap-windows\.ps1" %\*/);
  assert.match(shell, /\[IO\.File\]::Copy\([^\n]+\$false\)/);
  assert.match(shell, /Assert-ServicesStopped\s*\r?\n/);
  assert.match(shell, /launcher\.lock/);
  assert.match(shell, /TOOLBOX_BOOTSTRAP_NODE%/);
  assert.match(shell, /-NoInstall -ManagedCapabilities/);
  assert.doesNotMatch(
    shell,
    /npm install.*(?:global| -g)|SetEnvironmentVariable|RunAs|Set-ExecutionPolicy|Stop-Process|taskkill/i
  );
});

test("the actual ASCII shim preserves Chinese paths and spaced arguments", { skip: !windows }, async () => {
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-bootstrap-shim-"));
  try {
    const unicodeDirectory = path.join(scratch, "中文 路径");
    await fs.mkdir(unicodeDirectory);
    const entry = path.join(unicodeDirectory, "模拟 pnpm.cjs");
    await fs.writeFile(entry, "console.log(JSON.stringify(process.argv.slice(2)));\n");
    const shim = path.join(unicodeDirectory, "pnpm.cmd");
    const source = await fs.readFile(script, "utf8");
    const assignment = source.split(/\r?\n/).find((line) => line.trim().startsWith("$shim ="));
    assert.ok(assignment);
    const output = run(
      `[Console]::OutputEncoding=New-Object Text.UTF8Encoding; $env:TOOLBOX_BOOTSTRAP_NODE=${quote(process.execPath)}; $env:TOOLBOX_BOOTSTRAP_PNPM=${quote(entry)}; ${assignment}; [IO.File]::WriteAllText(${quote(shim)},$shim,[Text.Encoding]::ASCII); & ${quote(shim)} 'argument with space' '中文'; if($LASTEXITCODE){exit $LASTEXITCODE}`
    );
    assert.deepEqual(JSON.parse(output.trim()), ["argument with space", "中文"]);
  } finally {
    await fs.rm(scratch, { recursive: true, force: true });
  }
});
