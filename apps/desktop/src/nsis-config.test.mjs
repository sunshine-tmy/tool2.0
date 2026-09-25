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

test("Windows executable, NSIS, Electron windows and web branding share the original icon", async () => {
  const config = JSON.parse(await readFile(path.join(desktopRoot, "electron-builder.json"), "utf8"));
  const repositoryRoot = path.resolve(desktopRoot, "../..");
  const mainProcess = await readFile(path.join(desktopRoot, "src", "main.ts"), "utf8");
  const packager = await readFile(path.join(desktopRoot, "scripts", "package-desktop.mjs"), "utf8");
  const page = await readFile(path.join(repositoryRoot, "frontend", "index.html"), "utf8");
  const topbar = await readFile(path.join(repositoryRoot, "frontend", "src", "layouts", "ToolLayout.vue"), "utf8");

  expect(config.appId).toBe("com.ecommercetoolbox.desktop");
  expect(config.win.icon).toBe("assets/ecommerce-toolbox.ico");
  expect(config.nsis.installerIcon).toBe(config.win.icon);
  expect(config.nsis.uninstallerIcon).toBe(config.win.icon);
  expect(packager).toContain("icon: desktopIcon");
  expect(mainProcess.match(/icon: desktopIconPath/g)).toHaveLength(2);
  expect(page).toContain('href="/favicon.ico"');
  expect(page).toContain('href="/favicon-32x32.png"');
  expect(topbar).toContain('src="/ecommerce-toolbox-icon-32.png"');
  expect(topbar).not.toContain("<Boxes");
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
  expect(acceptance).toContain('"/S /D=$installRoot"');
  expect(acceptance).not.toContain("Join-Path $installBaseRoot 'Ecommerce Toolbox'");
  expect(acceptance).toContain("PreviousInstallerPath");
  expect(acceptance).toContain("TestComponentLifecycle");
  expect(acceptance).toContain("TestExplicitDataDeletion");
  expect(acceptance).toContain("desktop-install-acceptance-report.json");
  expect(acceptance).not.toContain("Get-Process -Name 'EcommerceToolbox'");
});

test("a signed desktop release cannot be created or updated before clean-VM acceptance", async () => {
  const repositoryRoot = path.resolve(desktopRoot, "../..");
  const workflow = await readFile(path.join(repositoryRoot, ".github", "workflows", "desktop-release.yml"), "utf8");
  const releaseJob = workflow.split("\n  release:\n", 2)[1];

  expect(workflow).toContain("clean-vm-acceptance:");
  expect(workflow).toContain("previous-stable-windows-installer");
  expect(workflow).toContain("-TestExplicitDataDeletion");
  expect(workflow).toContain("desktop-install-acceptance-report.json");
  expect(releaseJob).toContain("needs: [package, clean-vm-acceptance]");
  expect(releaseJob).toContain("needs.clean-vm-acceptance.result == 'success'");
  expect(releaseJob).toContain("gh release upload");
  expect(releaseJob).toContain("gh release create");
});

test("signed Windows acceptance is manual, read-only, and never publishes a Release", async () => {
  const repositoryRoot = path.resolve(desktopRoot, "../..");
  const workflow = await readFile(
    path.join(repositoryRoot, ".github", "workflows", "desktop-signed-acceptance.yml"),
    "utf8"
  );
  const releaseMentions = workflow.match(/gh\s+release\s+(?:create|upload|edit|delete)/gi) ?? [];

  expect(workflow).toContain("workflow_dispatch:");
  expect(workflow).toContain("permissions:\n  contents: read");
  expect(workflow).toContain("WINDOWS_SIGNING_CERTIFICATE_BASE64");
  expect(workflow).toContain("WINDOWS_SIGNING_CERTIFICATE_PASSWORD");
  expect(workflow).toContain("WINDOWS_SIGNING_SUBJECT");
  expect(workflow).toContain("-TestComponentLifecycle");
  expect(workflow).toContain("-TestExplicitDataDeletion");
  expect(workflow).toContain("gh release download");
  expect(releaseMentions).toHaveLength(0);
  expect(workflow).not.toMatch(/contents:\s*write/);
});
