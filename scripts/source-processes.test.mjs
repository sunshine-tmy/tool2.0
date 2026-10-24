/** Run only extracted functions with fake process tables; never terminate real processes. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const windows = process.platform === "win32";
const quote = (s) => `'${s.replaceAll("'", "''")}'`;
const run = (code) =>
  execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      `$ErrorActionPreference='Stop';[Console]::OutputEncoding=New-Object Text.UTF8Encoding;${code}`
    ],
    { encoding: "utf8", windowsHide: true, timeout: 20000 }
  );
const load = (name, functions) =>
  `$ast=[System.Management.Automation.Language.Parser]::ParseFile(${quote(path.join(root, "tooling/source", name + ".ps1"))},[ref]$null,[ref]$null);foreach($name in @(${functions.map(quote).join(",")})){$fn=$ast.Find({param($n)$n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name},$true);if(-not $fn){throw 'missing function'};. ([scriptblock]::Create($fn.Extent.Text))};`;
const common = `. ${quote(path.join(root, "tooling/lib/process-discovery.ps1"))};`;

test(
  "shared discovery keeps URL decoding, malformed input, listener deduplication and current PID filtering",
  { skip: !windows },
  () => {
    const output = run(
      common +
        `if((ConvertTo-NormalizedCommandLine 'FILE:///F:/%E4%B8%AD%E6%96%87%20Project/SCRIPTS/start-dev.ps1') -cne 'file:///f:/中文 project/scripts/start-dev.ps1'){throw 'decode changed'};if((ConvertTo-NormalizedCommandLine $null) -cne ''){throw 'empty changed'};if((ConvertTo-NormalizedCommandLine 'F:\\Bad%ZZ') -cne 'f:/bad%zz'){throw 'malformed changed'};function Get-NetTCPConnection {param($LocalPort,$State,$ErrorAction);@([pscustomobject]@{OwningProcess=41},[pscustomobject]@{OwningProcess=41},[pscustomobject]@{OwningProcess=$PID},[pscustomobject]@{OwningProcess=0},[pscustomobject]@{OwningProcess=42})};$ids=@(Get-PortListenerProcessIds 3100);if(($ids -join ',') -ne '41,42'){throw 'listeners changed'};'discovery passed'`
    );
    assert.match(output, /discovery passed/);
  }
);

for (const name of ["start-dev", "stop-dev"])
  test(
    `${name} preserves owned ancestor discovery and rejects foreign or missing processes`,
    { skip: !windows },
    () => {
      const output = run(
        common +
          load(name, ["Test-ProjectProcess"]) +
          `$Root='F:\\中文 project';$ps=@(@{ProcessId=1;ParentProcessId=0;CommandLine='foreign'},@{ProcessId=2;ParentProcessId=1;CommandLine='F:/%E4%B8%AD%E6%96%87%20project/scripts/start-dev.ps1'},@{ProcessId=3;ParentProcessId=2;CommandLine='node'},@{ProcessId=4;ParentProcessId=4;CommandLine='foreign'});if((Get-ProjectTreeRootProcessId 3 $ps) -ne 2){throw 'owned ancestor lost'};if(Get-ProjectTreeRootProcessId 4 $ps){throw 'foreign accepted'};if(Test-ProjectProcess 999 $ps){throw 'missing accepted'};'ownership passed'`
      );
      assert.match(output, /ownership passed/);
    }
  );

test(
  "shutdown traverses children once, excludes protected ancestors and does not touch unrelated processes",
  { skip: !windows },
  () => {
    const output = run(
      common +
        load("stop-dev", [
          "Stop-ProcessTree",
          "Get-CurrentProcessAncestorIds",
          "Test-ProjectProcess",
          "Test-ProjectServiceProcess"
        ]) +
        `$Root='F:/project';$script:stopped=@();function Stop-Process {param($Id,[switch]$Force,$ErrorAction);$script:stopped+= $Id};$ps=@(@{ProcessId=10;ParentProcessId=0;Name='protected';CommandLine='F:/project/scripts/start-dev.ps1'},@{ProcessId=11;ParentProcessId=10;Name='child';CommandLine='node'},@{ProcessId=12;ParentProcessId=11;Name='leaf';CommandLine='node'},@{ProcessId=20;ParentProcessId=0;Name='foreign';CommandLine='other/scripts/start-dev.ps1'});$protected=[System.Collections.Generic.HashSet[int]]::new();[void]$protected.Add(10);Stop-ProcessTree 10 $ps $protected;if(($script:stopped -join ',') -ne '12,11'){throw 'shutdown scope/order changed'};if(Test-ProjectServiceProcess $ps[3] $ps){throw 'foreign service accepted'};if(-not (Test-ProjectServiceProcess $ps[0] $ps)){throw 'public launcher lost'};'shutdown passed'`
    );
    assert.match(output, /shutdown passed/);
  }
);

test(
  "public PowerShell wrappers preserve named switches, quoted arguments and native failure status",
  { skip: !windows },
  async () => {
    const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-source-entry-"));
    try {
      for (const name of ["bootstrap-windows", "start-dev", "stop-dev"]) {
        const publicFile = path.join(scratch, "scripts", name + ".ps1");
        const implementation = path.join(scratch, "tooling/source", name + ".ps1");
        await fs.mkdir(path.dirname(publicFile), { recursive: true });
        await fs.mkdir(path.dirname(implementation), { recursive: true });
        await fs.copyFile(path.join(root, "scripts", name + ".ps1"), publicFile);
        const source = (await fs.readFile(publicFile, "utf8")).replaceAll("\r\n", "\n");
        const parameters = source.match(/^([\s\S]*?\n\))\n/)[1];
        await fs.writeFile(implementation, parameters + "\n$PSBoundParameters | ConvertTo-Json -Compress\nexit 7\n");
        const args =
          name === "bootstrap-windows"
            ? "-PlanOnly -WithCuda"
            : name === "start-dev"
              ? "-CheckOnly -NoBrowser -LanHost '中文 host'"
              : "-CheckOnly";
        const output = run(`& ${quote(publicFile)} ${args};if($LASTEXITCODE -ne 7){throw 'exit status lost'};exit 0`);
        const received = JSON.parse(output.trim());
        assert.equal(received[name === "bootstrap-windows" ? "PlanOnly" : "CheckOnly"].IsPresent, true);
        if (name === "start-dev") assert.equal(received.LanHost, "中文 host");
      }
    } finally {
      await fs.rm(scratch, { recursive: true, force: true });
    }
  }
);
