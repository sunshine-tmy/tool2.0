import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const desktopRoot = fileURLToPath(new URL("..", import.meta.url));

test("NSIS installer is assisted and allows a user-selected install directory", async () => {
  const config = JSON.parse(await readFile(path.join(desktopRoot, "electron-builder.json"), "utf8"));

  expect(config.win.target).toEqual(["nsis"]);
  expect(config.nsis.oneClick).toBe(false);
  expect(config.nsis.allowToChangeInstallationDirectory).toBe(true);
  expect(config.nsis.perMachine).toBe(false);
  expect(config.nsis.allowElevation).toBe(false);
  expect(config.nsis.deleteAppDataOnUninstall).toBe(false);
});

test("NSIS preserves install-root data unless an interactive user confirms deletion twice", async () => {
  const installer = await readFile(path.join(desktopRoot, "installer-custom.nsh"), "utf8");

  expect(installer).toContain("GetTempFileName $DesktopInstallWriteTest");
  expect(installer).toContain("${Silent}");
  expect(installer).toContain("${isUpdated}");
  expect(installer).toContain('RMDir /r "$INSTDIR\\data"');
  expect(installer.match(/MessageBox MB_ICON(?:EXCLAMATION|STOP)\|MB_YESNO/g)).toHaveLength(2);
  expect(installer).not.toMatch(/RMDir\s+\/r\s+"\$INSTDIR"(?!\\data)/);
});

test("Windows installation acceptance has explicit signed and unsigned-test modes", async () => {
  const repositoryRoot = path.resolve(desktopRoot, "../..");
  const acceptance = await readFile(path.join(repositoryRoot, "scripts", "accept-windows-desktop-install.ps1"), "utf8");
  const workflow = await readFile(
    path.join(repositoryRoot, ".github", "workflows", "desktop-install-acceptance.yml"),
    "utf8"
  );

  expect(acceptance).toContain("ParameterSetName = 'Signed'");
  expect(acceptance).toContain("ParameterSetName = 'UnsignedTest'");
  expect(workflow).toContain("workflow_dispatch:");
  expect(workflow).toContain("push:");
  expect(workflow).toContain("pull_request:");
  expect(workflow).toContain("-TestLegacyMigration");
  expect(workflow).toContain("-AllowUnsignedTestArtifact");
  expect(workflow).not.toContain("gh release");
  expect(workflow).not.toContain("WINDOWS_SIGNING_CERTIFICATE");
  expect(acceptance).toContain('"/D=$installRoot"');
  expect(acceptance).not.toContain("Join-Path $installBaseRoot 'Ecommerce Toolbox'");
});
