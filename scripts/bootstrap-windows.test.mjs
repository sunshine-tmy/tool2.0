/** Bootstrap shell tests: plan/AST/hash/shim checks only; never download packages or execute the real launcher. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const entryScript = path.join(root, "scripts/bootstrap-windows.ps1");
const script = path.join(root, "tooling/source/bootstrap-windows.ps1");
async function copyLauncher(project) {
  for (const relative of [
    "scripts/bootstrap-windows.ps1",
    "scripts/source-resources.generated.json",
    "tooling/source/bootstrap-windows.ps1"
  ]) {
    await fs.mkdir(path.dirname(path.join(project, relative)), { recursive: true });
    await fs.copyFile(path.join(root, relative), path.join(project, relative));
  }
}
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
      `$e=$null; $t=$null; [System.Management.Automation.Language.Parser]::ParseFile(${quote(script)},[ref]$t,[ref]$e) | Out-Null; if($e.Count){throw ($e|Out-String)}; & ${quote(entryScript)} -PlanOnly`
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
  assert.ok(shell.includes("Join-Path $Root 'apps\\api\\node_modules\\tsx\\dist\\cli.mjs'"));
  assert.ok(shell.includes("Join-Path $Root 'apps\\api\\tsconfig.json'"));
  assert.doesNotMatch(
    shell,
    /npm install.*(?:global| -g)|SetEnvironmentVariable|RunAs|Set-ExecutionPolicy|Stop-Process|taskkill/i
  );
});

test("all public PowerShell entries and implementations parse in Windows 5.1", { skip: !windows }, () => {
  const output = run(
    `$ErrorActionPreference='Stop';$files=@(Get-ChildItem -LiteralPath ${quote(path.join(root, "scripts"))} -Filter '*.ps1') + @(Get-ChildItem -LiteralPath ${quote(path.join(root, "tooling"))} -Recurse -Filter '*.ps1');foreach($file in $files){$errors=$null;$tokens=$null;[System.Management.Automation.Language.Parser]::ParseFile($file.FullName,[ref]$tokens,[ref]$errors)|Out-Null;if($errors.Count){throw ($errors|Out-String)}};'all PowerShell sources parse'`
  );
  assert.match(output, /all PowerShell sources parse/);
});

test(
  "ZIP Plan and resource listing do not need Node or pnpm on PATH and leave source files untouched",
  { skip: !windows },
  async () => {
    const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-no-node-"));
    try {
      await copyLauncher(scratch);
      const output = run(
        `$env:PATH='';Set-Location ${quote(os.tmpdir())};& ${quote(path.join(scratch, "scripts/bootstrap-windows.ps1"))} -PlanOnly;& ${quote(path.join(scratch, "scripts/bootstrap-windows.ps1"))} -ListResources -WithCuda`
      );
      assert.match(output, /no downloads, writes/);
      assert.match(output, /15 archives/);
      assert.deepEqual(await fs.readdir(scratch), ["scripts", "tooling"]);
      assert.deepEqual(await fs.readdir(path.join(scratch, "scripts")), [
        "bootstrap-windows.ps1",
        "source-resources.generated.json"
      ]);
    } finally {
      await fs.rm(scratch, { recursive: true, force: true });
    }
  }
);

test(
  "ZIP layout preflight works from another cwd without Git or an installed runtime",
  { skip: !windows },
  async () => {
    const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-zip-layout-"));
    const project = path.join(scratch, "源码 ZIP 空间");
    const cwd = path.join(scratch, "其他目录");
    try {
      await fs.mkdir(cwd);
      await copyLauncher(project);
      const output = run(
        `Set-Location ${quote(cwd)}; & ${quote(path.join(project, "scripts/bootstrap-windows.ps1"))} -PlanOnly`
      );
      assert.match(output, /no downloads, writes/);
      assert.match(output, /6\/6/);
      assert.deepEqual(await fs.readdir(project), ["scripts", "tooling"]);
      assert.deepEqual(await fs.readdir(cwd), []);
    } finally {
      assert.equal(path.dirname(scratch), path.resolve(os.tmpdir()));
      assert.ok(path.basename(scratch).startsWith("toolbox-zip-layout-"));
      await fs.rm(scratch, { recursive: true, force: true });
    }
  }
);

test("the generated resource list matches the signed catalog", () => {
  assert.match(
    execFileSync(process.execPath, [path.join(root, "scripts/generate-source-resources.mjs"), "--check"], {
      encoding: "utf8"
    }),
    /matches the signed catalog/
  );
});

test("the optional bootstrap download list matches the launcher's pinned tool versions and digests", async () => {
  const plan = JSON.parse(await fs.readFile(path.join(root, "scripts/source-resources.generated.json"), "utf8"));
  const shell = await fs.readFile(script, "utf8");
  for (const [versionKey, hashKey, index] of [
    ["NodeVersion", "NodeHash", 0],
    ["PnpmVersion", "PnpmHash", 1]
  ]) {
    const version = new RegExp(`\\$${versionKey} = '([^']+)'`).exec(shell)?.[1];
    const hash = new RegExp(`\\$${hashKey} = '([^']+)'`).exec(shell)?.[1];
    assert.ok(version);
    assert.equal(plan.bootstrap[index].digest, hash);
    assert.ok(plan.bootstrap[index].filename.includes(version));
    assert.ok(plan.bootstrap[index].url.includes(version));
  }
});

test("resource-list mode works before Node and does not create an install", { skip: !windows }, () => {
  const output = run(`& ${quote(entryScript)} -ListResources`);
  assert.match(output, /python-312-3\.12\.14-20260901\.tar\.gz/);
  assert.match(output, /offline-resources/);
  assert.doesNotMatch(output, /chatterbox-cuda-1/);
  assert.match(output, /GPU is NOT installed/);
});

test("CUDA resource-list and plan modes explicitly include all four GPU archives", { skip: !windows }, async () => {
  const plan = JSON.parse(await fs.readFile(path.join(root, "scripts/source-resources.generated.json"), "utf8"));
  const cpu = plan.components.filter((item) => item.required);
  const cuda = plan.components.find((item) => item.id === "chatterbox-cuda");
  assert.equal(cpu.flatMap((item) => item.archives).length, 11);
  assert.equal(cuda.archives.length, 4);
  const output = run(`& ${quote(entryScript)} -ListResources -WithCuda`);
  for (const item of [...cpu, cuda]) for (const archive of item.archives) assert.ok(output.includes(archive.filename));
  assert.match(output, /15 archives/);
  assert.match(run(`& ${quote(entryScript)} -PlanOnly -WithCuda`), /NVIDIA voice cloning GPU extension/);
});

test(
  "the double-click GPU entry delegates arguments and failure status to the same launcher",
  { skip: !windows },
  async () => {
    const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-gpu-entry-"));
    try {
      const directory = path.join(scratch, "中文 project (1)");
      await fs.mkdir(directory);
      await fs.copyFile(path.join(root, "start-gpu.bat"), path.join(directory, "start-gpu.bat"));
      await fs.writeFile(path.join(directory, "start.bat"), "@echo off\r\necho ARGS=%*\r\nexit /b 7\r\n");
      let failure;
      try {
        execFileSync("cmd.exe", ["/d", "/c", "start-gpu.bat", "-ListResources"], {
          cwd: directory,
          encoding: "utf8",
          timeout: 20000,
          windowsHide: true
        });
      } catch (error) {
        failure = error;
      }
      assert.equal(failure?.status, 7);
      assert.match(failure.stdout, /ARGS=-WithCuda -ListResources/);
    } finally {
      await fs.rm(scratch, { recursive: true, force: true });
    }
  }
);

test(
  "a fresh clone with no archives stops before any tool download or dependency install",
  { skip: !windows },
  async () => {
    const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-source-cold-"));
    try {
      await copyLauncher(scratch);
      // Dynamic free ports avoid relying on the development server being stopped during tests.
      const output = run(
        `$ErrorActionPreference='Stop';$p1=New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback,0);$p2=New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback,0);$p1.Start();$p2.Start();$one=$p1.LocalEndpoint.Port;$two=$p2.LocalEndpoint.Port;$p1.Stop();$p2.Stop();[IO.File]::WriteAllText(${quote(path.join(scratch, ".env.example"))},("API_PORT="+$one+"\nVITE_DEV_PORT="+$two+"\n"));$env:API_PORT=$null;$env:VITE_DEV_PORT=$null;& ${quote(path.join(scratch, "scripts/bootstrap-windows.ps1"))};if($LASTEXITCODE -ne 1){throw 'Missing resources were not rejected'};'missing archives stopped startup'`
      );
      assert.match(output, /missing archives stopped startup/);
      assert.match(output, /python-312-3\.12\.14-20260901\.tar\.gz/);
      assert.match(output, /douyin-archive/);
      assert.doesNotMatch(output, /Downloading |Workspace dependencies/);
      assert.deepEqual((await fs.readdir(path.join(scratch, ".runtime/bootstrap"))).sort(), ["launcher.lock"]);
      assert.equal(await fs.stat(path.join(scratch, "node_modules")).catch(() => null), null);
      assert.equal(await fs.stat(path.join(scratch, ".runtime/packages")).catch(() => null), null);
    } finally {
      await fs.rm(scratch, { recursive: true, force: true });
    }
  }
);

test(
  "preflight lists all missing local files and rejects wrong sizes before installing",
  { skip: !windows },
  async () => {
    const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-source-preflight-"));
    try {
      const source = await fs.readFile(script, "utf8");
      const preflight = source.indexOf("if (-not $BuildDesktop) { Assert-LocalComponentResources }");
      assert.ok(preflight > 0 && preflight < source.indexOf("$node = Initialize-Node"));
      const output = run(
        `$ErrorActionPreference='Stop';$e=$null;$t=$null;$ast=[System.Management.Automation.Language.Parser]::ParseFile(${quote(script)},[ref]$t,[ref]$e);foreach($name in @('Assert-LocalComponentResources','Test-PreparedSourceComponent')){$fn=$ast.Find({param($n)$n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name},$true);. ([scriptblock]::Create($fn.Extent.Text))};$Root=${quote(scratch)};$OfflineRoot=Join-Path $Root 'offline-resources';$WithCuda=$false;function Get-SourceResourcePlan {return @{components=@(@{id='first';version='1';required=$true;manifestSha256='a';archives=@(@{filename='first.tar.gz';bytes=3;url='https://example.com/first'})},@{id='last';version='1';required=$true;manifestSha256='b';archives=@(@{filename='last.tar.gz';bytes=3;url='https://example.com/last'})})}};try{Assert-LocalComponentResources;throw 'should reject'}catch{if($_.Exception.Message -notmatch 'Prepare the listed archives'){throw}};[IO.Directory]::CreateDirectory((Join-Path $OfflineRoot 'components'))|Out-Null;[IO.File]::WriteAllText((Join-Path $OfflineRoot 'components/first.tar.gz'),'abc');[IO.File]::WriteAllText((Join-Path $OfflineRoot 'components/last.tar.gz'),'abc');Assert-LocalComponentResources;Write-Output 'complete local set accepted'`
      );
      assert.match(output, /first.tar.gz/);
      assert.match(output, /last.tar.gz/);
      assert.match(output, /complete local set accepted/);
    } finally {
      await fs.rm(scratch, { recursive: true, force: true });
    }
  }
);

test(
  "verified local runtime archives bypass downloads and corrupt files never fall back",
  { skip: !windows },
  async () => {
    const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-runtime-local-"));
    try {
      const output = run(
        `$ErrorActionPreference='Stop';$e=$null;$t=$null;$ast=[System.Management.Automation.Language.Parser]::ParseFile(${quote(script)},[ref]$t,[ref]$e);foreach($name in @('Test-ArchiveHash','Get-PinnedArchive')){$fn=$ast.Find({param($n)$n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name},$true);. ([scriptblock]::Create($fn.Extent.Text))};$OfflineRoot=Join-Path ${quote(scratch)} 'offline-resources';$BootstrapRoot=Join-Path ${quote(scratch)} 'cache';[IO.Directory]::CreateDirectory((Join-Path $OfflineRoot 'bootstrap'))|Out-Null;[IO.Directory]::CreateDirectory($BootstrapRoot)|Out-Null;$local=Join-Path $OfflineRoot 'bootstrap/manual.zip';[IO.File]::WriteAllText($local,'abc');$result=@(Get-PinnedArchive 'https://invalid.invalid/unreachable' 'cache.zip' SHA256 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' 'manual.zip');if($result.Count -ne 1 -or [IO.File]::ReadAllText($result[0]) -ne 'abc'){throw 'local cache failed'};[IO.File]::WriteAllText($local,'wrong');try{Get-PinnedArchive 'https://invalid.invalid/unreachable' 'uncached.zip' SHA256 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' 'manual.zip';throw 'should reject'}catch{if($_.Exception.Message -notmatch 'Local runtime digest mismatch'){throw}};'local reuse and corruption guard passed'`
      );
      assert.match(output, /local reuse and corruption guard passed/);
    } finally {
      await fs.rm(scratch, { recursive: true, force: true });
    }
  }
);

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

test("a first runtime download returns exactly one path in Windows PowerShell 5.1", { skip: !windows }, async () => {
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-bootstrap-download-"));
  try {
    const source = path.join(scratch, "source.bin");
    const destination = path.join(scratch, "tool2.0-main (1)", ".runtime", "bootstrap");
    await fs.writeFile(source, "abc");
    await fs.mkdir(destination, { recursive: true });
    const output = run(
      `$ErrorActionPreference='Stop'; $e=$null;$t=$null; $ast=[System.Management.Automation.Language.Parser]::ParseFile(${quote(script)},[ref]$t,[ref]$e); foreach($name in @('Test-ArchiveHash','Get-PinnedArchive')){ $fn=$ast.Find({param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name},$true); . ([scriptblock]::Create($fn.Extent.Text)) }; $BootstrapRoot=${quote(destination)}; foreach($attempt in 1..2){ $result=@(Get-PinnedArchive ${quote(pathToFileURL(source).href)} 'node-test.zip' SHA256 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'); if($result.Count -ne 1 -or $result[0] -isnot [string]){throw "Download returned $($result.Count) objects instead of one path: $($result | ForEach-Object {$_.GetType().FullName})"}; if(-not (Test-Path -LiteralPath $result[0] -PathType Leaf)){throw 'Invalid archive path'} }; 'cold and cached path checks passed'`
    );
    assert.match(output, /cold and cached path checks passed/);
  } finally {
    await fs.rm(scratch, { recursive: true, force: true });
  }
});

test("cold and cached downloads can be extracted by real Windows tar in spaced paths", { skip: !windows }, async () => {
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-bootstrap-extract-"));
  try {
    const input = path.join(scratch, "input");
    const archive = path.join(scratch, "source.zip");
    const destination = path.join(scratch, "中文 tool2.0-main (1)", ".runtime", "bootstrap");
    await fs.mkdir(input);
    await fs.writeFile(path.join(input, "runtime-fixture.txt"), "bootstrap fixture");
    await fs.mkdir(destination, { recursive: true });
    const output = run(
      `$ErrorActionPreference='Stop'; [Reflection.Assembly]::LoadWithPartialName('System.IO.Compression.FileSystem') | Out-Null; [IO.Compression.ZipFile]::CreateFromDirectory(${quote(input)},${quote(archive)}); $h=[Security.Cryptography.SHA256]::Create();$s=[IO.File]::OpenRead(${quote(archive)});try{$expected=[BitConverter]::ToString($h.ComputeHash($s)).Replace('-','').ToLowerInvariant()}finally{$s.Dispose();$h.Dispose()}; $e=$null;$t=$null;$ast=[System.Management.Automation.Language.Parser]::ParseFile(${quote(script)},[ref]$t,[ref]$e); foreach($name in @('Test-ArchiveHash','Get-PinnedArchive','Invoke-Checked')){$fn=$ast.Find({param($n)$n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name},$true);. ([scriptblock]::Create($fn.Extent.Text))}; $BootstrapRoot=${quote(destination)}; foreach($attempt in 1..2){$result=Get-PinnedArchive ${quote(pathToFileURL(archive).href)} 'node-test.zip' SHA256 $expected; $target=Join-Path $BootstrapRoot "extracted-$attempt"; [IO.Directory]::CreateDirectory($target)|Out-Null; Invoke-Checked 'tar.exe' @('-xf',$result,'-C',$target); if([IO.File]::ReadAllText((Join-Path $target 'runtime-fixture.txt')) -ne 'bootstrap fixture'){throw 'Extracted content mismatch'}}; 'actual cold and cached extraction passed'`
    );
    assert.match(output, /actual cold and cached extraction passed/);
  } finally {
    await fs.rm(scratch, { recursive: true, force: true });
  }
});
