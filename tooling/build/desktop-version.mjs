/** Desktop product versions are independent of workspace and capability package versions. */
import { randomUUID } from "node:crypto";
import { open, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";

function stableVersion(value, label) {
  if (typeof value !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) {
    throw new Error(`${label} must be a stable major.minor.patch version without leading zeroes`);
  }
  const parts = value.split(".").map(Number);
  if (!parts.every(Number.isSafeInteger)) throw new Error(`${label} contains an unsupported version number`);
  return parts;
}

function versionOptions(args) {
  let option;
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--make" || argument === "--") continue;
    if (option) throw new Error("Use only one of --bump, --version or --keep-version");
    if (argument === "--keep-version") {
      option = { mode: "keep" };
      continue;
    }
    const match = /^(--bump|--version)(?:=(.*))?$/.exec(argument);
    if (!match) throw new Error(`Unknown desktop packaging argument: ${argument}`);
    const value = match[2] ?? args[++index];
    if (match[1] === "--bump") {
      if (!["patch", "minor", "major"].includes(value)) throw new Error("--bump requires patch, minor or major");
      option = { mode: value };
    } else {
      stableVersion(value, "--version");
      option = { mode: "exact", value };
    }
  }
  return option;
}

function nextVersion(current, option, env) {
  const parts = stableVersion(current, "Desktop package version");
  if (env.DESKTOP_RELEASE === "1") {
    if (option && option.mode !== "keep") {
      throw new Error("Release version is fixed by DESKTOP_VERSION; do not pass --bump or --version");
    }
    const version = env.DESKTOP_VERSION?.trim();
    stableVersion(version, "DESKTOP_VERSION");
    return version;
  }
  const mode = option?.mode ?? "patch";
  if (mode === "keep") return current;
  if (mode === "exact") {
    const requested = stableVersion(option.value, "--version");
    const difference = requested.findIndex((value, index) => value !== parts[index]);
    if (difference < 0 || requested[difference] < parts[difference]) {
      throw new Error("--version must be newer than the current desktop version; use --keep-version to rebuild it");
    }
    return option.value;
  }
  const index = { major: 0, minor: 1, patch: 2 }[mode];
  parts[index]++;
  parts.fill(0, index + 1);
  const version = parts.join(".");
  stableVersion(version, "Next desktop version");
  return version;
}

/** Commit only after the whole package/make operation succeeds; never edit a release tag's version. */
export async function withDesktopVersion({ desktopRoot, args = [], env = process.env }, build) {
  const option = versionOptions(args);
  const manifestPath = path.join(desktopRoot, "package.json");
  const lockPath = path.join(desktopRoot, ".desktop-package.lock");
  let lock;
  try {
    lock = await open(lockPath, "wx");
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new Error(
        `Another desktop package operation owns ${lockPath}. If a previous build was forcibly stopped, confirm it has exited before removing this lock.`
      );
    }
    throw error;
  }
  try {
    await lock.writeFile(`${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`);
    const current = JSON.parse(await readFile(manifestPath, "utf8")).version;
    const version = nextVersion(current, option, env);
    console.log(`Desktop version: ${current} -> ${version}${env.DESKTOP_RELEASE === "1" ? " (release)" : ""}`);
    const result = await build(version);
    if (env.DESKTOP_RELEASE !== "1" && version !== current) {
      // Preserve unrelated manifest edits made while a long build was running.
      const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
      if (manifest.version !== current) {
        throw new Error(
          `Desktop version changed during packaging; generated ${version} but did not overwrite package.json`
        );
      }
      manifest.version = version;
      const temporary = path.join(desktopRoot, `.desktop-version-${randomUUID()}.tmp`);
      try {
        const file = await open(temporary, "wx");
        try {
          await file.writeFile(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
          await file.sync();
        } finally {
          await file.close();
        }
        await rename(temporary, manifestPath);
      } finally {
        await rm(temporary, { force: true });
      }
      console.log(`Desktop version saved: ${version} (apps/desktop/package.json)`);
    }
    return result;
  } finally {
    await lock.close();
    await rm(lockPath, { force: true });
  }
}
