import assert from "node:assert/strict";
import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

await Promise.all(["backend", "frontend", "scripts"].map((name) => access(path.join(stageRoot, name))));
const packageJson = JSON.parse(await readFile(path.join(desktopRoot, "package.json"), "utf8"));
const release = readReleaseOptions(packageJson);
await rm(outputRoot, { recursive: true, force: true });

const [packagedApp] = await packager({
  dir: desktopRoot,
  out: outputRoot,
  name: appName,
  platform: "win32",
  arch: "x64",
  appVersion: release.version,
  buildVersion: release.version,
  asar: true,
  prune: true,
  // outputRoot was cleared above. Avoid a second recursive deletion inside
  // Electron Packager, which can race with Windows antivirus file scanning.
  overwrite: false,
  extraResource: [path.join(stageRoot, "backend"), path.join(stageRoot, "frontend"), path.join(stageRoot, "scripts")],
  afterCopy: [embedReleaseMetadata(release)],
  ...(release.signing
    ? {
        windowsSign: {
          certificateFile: release.signing.certificateFile,
          certificatePassword: release.signing.certificatePassword
        }
      }
    : {}),
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
      name: appName,
      authors: packageJson.author || "Ecommerce Toolbox",
      exe: `${appName}.exe`,
      setupExe: `${appName}Setup.exe`,
      version: release.version,
      ...(release.signing
        ? {
            certificateFile: release.signing.certificateFile,
            certificatePassword: release.signing.certificatePassword
          }
        : {}),
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

function readReleaseOptions(packageJson) {
  const isRelease = process.env.DESKTOP_RELEASE === "1";
  const version = isRelease ? requiredStableVersion(process.env.DESKTOP_VERSION) : packageJson.version;
  assert.equal(typeof version, "string", "desktop package version is required");
  if (!isRelease) return { version, updateFeed: undefined, signing: undefined };

  const updateFeed = requiredUpdateFeed(process.env.DESKTOP_UPDATE_FEED_URL);
  const certificateFile = process.env.WINDOWS_CERTIFICATE_FILE?.trim();
  const certificatePassword = process.env.WINDOWS_CERTIFICATE_PASSWORD;
  if (!certificateFile || !certificatePassword) {
    throw new Error("Release builds require WINDOWS_CERTIFICATE_FILE and WINDOWS_CERTIFICATE_PASSWORD");
  }
  return { version, updateFeed, signing: { certificateFile, certificatePassword } };
}

function requiredStableVersion(value) {
  const version = value?.trim();
  if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error("DESKTOP_VERSION must be a stable major.minor.patch version");
  }
  return version;
}

function requiredUpdateFeed(value) {
  const candidate = value?.trim();
  if (!candidate) throw new Error("Release builds require DESKTOP_UPDATE_FEED_URL");
  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("DESKTOP_UPDATE_FEED_URL must be a valid HTTPS URL");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("DESKTOP_UPDATE_FEED_URL must be a credential-free HTTPS URL without query or fragment");
  }
  return url.toString().replace(/\/$/, "");
}

function embedReleaseMetadata(release) {
  return (buildPath, _electronVersion, _platform, _arch, done) => {
    void (async () => {
      const metadataPath = path.join(buildPath, "package.json");
      const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
      metadata.version = release.version;
      if (release.updateFeed) metadata.desktopUpdateFeed = release.updateFeed;
      else delete metadata.desktopUpdateFeed;
      await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
    })().then(
      () => done(),
      (error) => done(error instanceof Error ? error : new Error("Unable to embed desktop release metadata"))
    );
  };
}
