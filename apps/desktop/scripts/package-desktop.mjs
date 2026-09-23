import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, cp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import packager from "@electron/packager";

const desktopRoot = fileURLToPath(new URL("..", import.meta.url));
const outputRoot = path.join(desktopRoot, "out");
const stageRoot = path.join(desktopRoot, ".stage");
const appName = "EcommerceToolbox";
const makeInstaller = process.argv.includes("--make");
// Keep binary downloads inside the workspace so a broken user-level cache
// cannot make an otherwise reproducible package build fail.
const electronCache = process.env.ELECTRON_DOWNLOAD_CACHE ?? path.join(desktopRoot, ".electron-cache");
const electronMirror = process.env.ELECTRON_MIRROR;
const electronPackage = JSON.parse(
  await readFile(path.join(desktopRoot, "node_modules", "electron", "package.json"), "utf8")
);
const electronZipName = `electron-v${electronPackage.version}-win32-x64.zip`;
const cachedElectronZipDirectory = await findCachedElectronZipDirectory(electronCache, electronZipName);
if (cachedElectronZipDirectory) {
  console.log(`Using cached Electron runtime archive: ${path.join(cachedElectronZipDirectory, electronZipName)}`);
} else {
  console.log(`Electron runtime archive is not cached; downloading ${electronZipName}`);
}

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
  // Pnpm represents direct dependencies as junctions. Electron Packager's
  // pruning walker cannot follow electron-updater's nested junctions, so the
  // small runtime dependency tree is copied explicitly in afterCopy below.
  prune: false,
  // outputRoot was cleared above. Avoid a second recursive deletion inside
  // Electron Packager, which can race with Windows antivirus file scanning.
  overwrite: false,
  extraResource: [path.join(stageRoot, "backend"), path.join(stageRoot, "frontend"), path.join(stageRoot, "scripts")],
  afterCopy: [embedReleaseMetadata(release), copyDesktopRuntimeDependencies()],
  ...(cachedElectronZipDirectory
    ? { electronZipDir: cachedElectronZipDirectory }
    : {
        download: {
          cacheRoot: electronCache,
          mirrorOptions: electronMirror ? { mirror: electronMirror } : undefined
        }
      }),
  ignore: [/(^|[\\/])(\.stage|node_modules|out|src|test-results)([\\/]|$)/]
});

assert.ok(packagedApp, "Electron Packager did not produce a Windows application directory");
await access(path.join(packagedApp, `${appName}.exe`));
await access(path.join(packagedApp, "resources", "backend", "dist", "desktop-entry.js"));
await access(path.join(packagedApp, "resources", "frontend", "index.html"));

if (makeInstaller) {
  const installerOutput = path.join(outputRoot, "make", "nsis");
  await writeUpdateConfiguration(packagedApp, release);
  await rm(installerOutput, { recursive: true, force: true });
  const customIncludePath = path.join(stageRoot, "installer-custom.nsh");
  await writeInstallerInclude(packagedApp, customIncludePath);
  const builderConfig = await writeElectronBuilderConfig(release);
  try {
    await runElectronBuilder(packagedApp, release, builderConfig.path);
  } finally {
    await builderConfig.dispose();
    await rm(customIncludePath, { force: true });
  }
  await access(path.join(installerOutput, `${appName}Setup.exe`));
  await access(path.join(installerOutput, `${appName}Setup.exe.blockmap`));
  if (release.updateFeed) await access(path.join(installerOutput, "latest.yml"));
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
      delete metadata.desktopUpdateFeed;
      await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
    })().then(
      () => done(),
      (error) => done(error instanceof Error ? error : new Error("Unable to embed desktop release metadata"))
    );
  };
}

function copyDesktopRuntimeDependencies() {
  return (buildPath, _electronVersion, _platform, _arch, done) => {
    void (async () => {
      const sourceRoot = path.join(desktopRoot, "node_modules");
      const destinationRoot = path.join(buildPath, "node_modules");
      const copied = new Set();
      for (const dependency of ["electron-updater", "tslib"]) {
        await copyRuntimeDependency(path.join(sourceRoot, dependency), path.join(destinationRoot, dependency), copied);
      }
    })().then(
      () => done(),
      (error) => done(error instanceof Error ? error : new Error("Unable to copy desktop runtime dependencies"))
    );
  };
}

async function findCachedElectronZipDirectory(cacheRoot, zipName, depth = 0) {
  if (depth > 4) return undefined;
  let entries;
  try {
    entries = await readdir(cacheRoot, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
  if (entries.some((entry) => entry.isFile() && entry.name === zipName)) return cacheRoot;
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const result = await findCachedElectronZipDirectory(path.join(cacheRoot, entry.name), zipName, depth + 1);
    if (result) return result;
  }
  return undefined;
}

async function copyRuntimeDependency(sourceDirectory, destinationDirectory, copied) {
  const source = await realpath(sourceDirectory);
  const key = `${source}\u0000${destinationDirectory}`;
  if (copied.has(key)) return;
  copied.add(key);

  const metadata = JSON.parse(await readFile(path.join(source, "package.json"), "utf8"));
  await cp(source, destinationDirectory, { recursive: true, dereference: true, force: true });
  const dependencies = { ...(metadata.dependencies ?? {}), ...(metadata.optionalDependencies ?? {}) };
  for (const dependency of Object.keys(dependencies)) {
    const dependencySource = await resolveRuntimeDependency(source, dependency);
    await copyRuntimeDependency(dependencySource, path.join(destinationDirectory, "node_modules", dependency), copied);
  }
}

async function resolveRuntimeDependency(fromDirectory, dependency) {
  let current = fromDirectory;
  while (true) {
    const candidate = path.join(current, "node_modules", dependency);
    try {
      await access(path.join(candidate, "package.json"));
      return candidate;
    } catch {
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  throw new Error(`Unable to resolve packaged runtime dependency ${dependency} from ${fromDirectory}`);
}

async function writeUpdateConfiguration(packagedApp, release) {
  const updateConfigPath = path.join(packagedApp, "resources", "app-update.yml");
  if (!release.updateFeed) {
    await rm(updateConfigPath, { force: true });
    return;
  }
  // The feed is validated before packaging. Keeping the YAML generated here
  // avoids accepting renderer-provided or user-editable update endpoints.
  await writeFile(
    updateConfigPath,
    ["provider: generic", `url: ${release.updateFeed}`, "updaterCacheDirName: ecommerce-toolbox-updater", ""].join(
      "\n"
    ),
    "utf8"
  );
}

async function writeElectronBuilderConfig(release) {
  const configPath = path.join(outputRoot, "electron-builder.release.json");
  const config = JSON.parse(await readFile(path.join(desktopRoot, "electron-builder.json"), "utf8"));
  config.directories = { ...config.directories, buildResources: ".stage" };
  config.nsis = { ...config.nsis, include: "installer-custom.nsh", allowElevation: false };
  if (release.updateFeed) config.publish = [{ provider: "generic", url: release.updateFeed }];
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return { path: configPath, dispose: () => rm(configPath, { force: true }) };
}

async function writeInstallerInclude(packagedApp, includePath) {
  const files = [];
  const directories = [];
  async function walk(directory, relative = "") {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const childRelative = relative ? path.join(relative, entry.name) : entry.name;
      if (childRelative.split(path.sep)[0].toLowerCase() === "data") continue;
      const childPath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Packaged installer tree cannot contain symlinks: ${childRelative}`);
      if (entry.isDirectory()) {
        directories.push(childRelative);
        await walk(childPath, childRelative);
      } else if (entry.isFile()) {
        files.push(childRelative);
      } else {
        throw new Error(`Unsupported packaged installer entry: ${childRelative}`);
      }
    }
  }
  await walk(packagedApp);
  files.sort((left, right) => left.localeCompare(right));
  directories.sort(
    (left, right) => right.split(path.sep).length - left.split(path.sep).length || right.localeCompare(left)
  );
  const removals = [
    ...files.map((file) => `  Delete /REBOOTOK "$INSTDIR\\${toNsisPath(file)}"`),
    ...directories.map((directory) => `  RMDir "$INSTDIR\\${toNsisPath(directory)}"`)
  ].join("\n");
  const template = await readFile(path.join(desktopRoot, "installer-custom.nsh"), "utf8");
  const marker = "  ; @@GENERATED_PROGRAM_FILE_REMOVALS@@";
  if (!template.includes(marker)) throw new Error("Installer removal manifest marker is missing");
  await writeFile(includePath, template.replace(marker, removals || "  ; No packaged application files"), "utf8");
}

function toNsisPath(value) {
  if (/[\r\n$";]/.test(value)) throw new Error(`Unsafe NSIS file path in packaged tree: ${value}`);
  return value.split(path.sep).join("\\");
}

async function runElectronBuilder(packagedApp, release, configPath) {
  const builderContext = await createBuilderContext(packagedApp, configPath);
  const environment = {
    ...process.env,
    CSC_IDENTITY_AUTO_DISCOVERY: "false",
    ...(release.signing
      ? {
          CSC_LINK: release.signing.certificateFile,
          CSC_KEY_PASSWORD: release.signing.certificatePassword
        }
      : {})
  };
  try {
    await runElectronBuilderProcess(builderContext, environment);
  } finally {
    await builderContext.dispose();
  }
}

function runElectronBuilderProcess(builderContext, environment) {
  const builderCli = path.join(builderContext.root, "node_modules", "electron-builder", "cli.js");
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        builderCli,
        "--win",
        "nsis",
        "--x64",
        "--prepackaged",
        builderContext.packagedApp,
        "--config",
        builderContext.configPath,
        "--publish",
        "never"
      ],
      { cwd: builderContext.root, env: environment, stdio: "inherit", windowsHide: true }
    );
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`electron-builder exited with code ${code ?? "unknown"}`));
    });
  });
}

async function createBuilderContext(packagedApp, configPath) {
  if (process.platform !== "win32" || isAsciiPath(desktopRoot)) {
    return { root: desktopRoot, packagedApp, configPath, dispose: async () => {} };
  }

  const drive = await findUnusedDriveLetter();
  await runProcess("subst", [drive, desktopRoot]);
  const root = `${drive}\\`;
  return {
    root,
    packagedApp: path.join(root, path.relative(desktopRoot, packagedApp)),
    configPath: path.join(root, path.relative(desktopRoot, configPath)),
    dispose: () => runProcess("subst", [drive, "/D"])
  };
}

function isAsciiPath(value) {
  return /^[\x20-\x7E]+$/.test(value);
}

async function findUnusedDriveLetter() {
  for (const letter of "ZYXWVUTSRQPONMLKJIHGFED") {
    const drive = `${letter}:`;
    try {
      await access(`${drive}\\`);
    } catch {
      return drive;
    }
  }
  throw new Error("No unused drive letter is available for the NSIS packaging path");
}

function runProcess(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code ?? "unknown"}`));
    });
  });
}
