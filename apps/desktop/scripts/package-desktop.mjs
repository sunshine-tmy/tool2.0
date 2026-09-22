import assert from "node:assert/strict";
import { access, cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import packager from "@electron/packager";
import { createWindowsInstaller } from "electron-winstaller";

const desktopRoot = fileURLToPath(new URL("..", import.meta.url));
const outputRoot = path.join(desktopRoot, "out");
const stageRoot = path.join(desktopRoot, ".stage");
const appName = "EcommerceToolbox";
const makeInstaller = process.argv.includes("--make");
// Keep binary downloads inside the workspace so a broken user-level cache
// cannot make an otherwise reproducible package build fail.
const electronCache = process.env.ELECTRON_DOWNLOAD_CACHE ?? path.join(desktopRoot, ".electron-cache");
const electronMirror = process.env.ELECTRON_MIRROR;

await Promise.all(
  ["backend", "frontend", "scripts"].map((name) => access(path.join(stageRoot, name)))
);
await rm(outputRoot, { recursive: true, force: true });

const [packagedApp] = await packager({
  dir: desktopRoot,
  out: outputRoot,
  name: appName,
  platform: "win32",
  arch: "x64",
  asar: true,
  prune: true,
  // outputRoot was cleared above. Avoid a second recursive deletion inside
  // Electron Packager, which can race with Windows antivirus file scanning.
  overwrite: false,
  extraResource: [
    path.join(stageRoot, "backend"),
    path.join(stageRoot, "frontend"),
    path.join(stageRoot, "scripts")
  ],
  download: {
    cacheRoot: electronCache,
    mirrorOptions: electronMirror ? { mirror: electronMirror } : undefined
  },
  ignore: [/(^|[\\/])(\.stage|node_modules|out|src|test-results)([\\/]|$)/]
});

assert.ok(packagedApp, "Electron Packager did not produce a Windows application directory");
await access(path.join(packagedApp, `${appName}.exe`));
await access(path.join(packagedApp, "resources", "backend", "dist", "desktop-entry.js"));
await access(path.join(packagedApp, "resources", "frontend", "index.html"));

if (makeInstaller) {
  const packageJson = JSON.parse(await readFile(path.join(desktopRoot, "package.json"), "utf8"));
  const installerOutput = path.join(outputRoot, "make", "squirrel.windows", "x64");
  // Squirrel's bundled rcedit cannot always reopen Setup.exe from a Unicode
  // workspace path. Build in the ASCII system temp directory, then copy the
  // verified artifacts back to the repository output directory.
  const temporaryInstallerOutput = await mkdtemp(path.join(tmpdir(), "ecommerce-toolbox-squirrel-"));
  await rm(installerOutput, { recursive: true, force: true });
  try {
    await createWindowsInstaller({
      appDirectory: packagedApp,
      outputDirectory: temporaryInstallerOutput,
      authors: packageJson.author || "Ecommerce Toolbox",
      exe: `${appName}.exe`,
      setupExe: `${appName}Setup.exe`,
      noMsi: true
    });
    await mkdir(installerOutput, { recursive: true });
    await cp(temporaryInstallerOutput, installerOutput, { recursive: true });
  } finally {
    await rm(temporaryInstallerOutput, { recursive: true, force: true });
  }
  await access(path.join(installerOutput, `${appName}Setup.exe`));
  console.log(`Windows installer created: ${installerOutput}`);
} else {
  console.log(`Windows application packaged: ${packagedApp}`);
}
