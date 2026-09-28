/** 中文模块说明：从固定 FFmpeg 官方源码在 Apple Silicon 上构建独立 FFmpeg/FFprobe 能力资产。 */
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { downloadFixedFile } from "./download-fixed-model-file.mjs";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const FFMPEG_SOURCE = {
  version: "8.1.2",
  url: "https://ffmpeg.org/releases/ffmpeg-8.1.2.tar.xz",
  sha256: "464beb5e7bf0c311e68b45ae2f04e9cc2af88851abb4082231742a74d97b524c"
};

export async function prepareFfmpegComponent({ stagingDirectory, runCommand = execFileSync }) {
  if (process.platform !== "darwin" || process.arch !== "arm64") {
    throw new Error("FFmpeg macOS 能力必须在 Apple Silicon 原生构建机上制作");
  }
  const stage = path.resolve(stagingDirectory);
  if (await pathExists(stage)) throw new Error("FFmpeg 暂存目录已存在，拒绝覆盖");
  const workRoot = path.join(REPOSITORY_ROOT, ".package", `ffmpeg-mac-arm64-${crypto.randomUUID()}`);
  const sourceArchive = path.join(workRoot, `ffmpeg-${FFMPEG_SOURCE.version}.tar.xz`);
  const extraction = path.join(workRoot, "source");
  const prefix = path.join(workRoot, "install");
  let stageCreated = false;
  try {
    await fs.mkdir(workRoot, { recursive: true });
    await downloadFixedFile({
      url: FFMPEG_SOURCE.url,
      destination: sourceArchive,
      expectedSha256: FFMPEG_SOURCE.sha256
    });
    const listing = runCommand("tar", ["-tf", sourceArchive], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 60_000,
      maxBuffer: 32 * 1024 * 1024
    });
    validateSourceListing(listing);
    await fs.mkdir(extraction);
    runCommand("tar", ["-xf", sourceArchive, "-C", extraction], { stdio: "inherit", timeout: 120_000 });
    const sourceRoot = path.join(extraction, `ffmpeg-${FFMPEG_SOURCE.version}`);
    const configScript = path.join(sourceRoot, "configure");
    await fs.access(configScript);
    const configureArgs = [
      `--prefix=${prefix}`,
      "--disable-debug",
      "--disable-doc",
      "--disable-ffplay",
      "--disable-autodetect",
      "--disable-shared",
      "--enable-static",
      "--enable-pthreads",
      "--enable-version3",
      "--enable-gpl"
    ];
    runCommand("chmod", ["+x", configScript], { stdio: "inherit" });
    runCommand("./configure", configureArgs, { cwd: sourceRoot, stdio: "inherit", timeout: 10 * 60_000 });
    runCommand("make", ["-j", String(Math.min(4, Math.max(1, os.availableParallelism() - 1)))], {
      cwd: sourceRoot,
      stdio: "inherit",
      timeout: 90 * 60_000
    });
    runCommand("make", ["install"], { cwd: sourceRoot, stdio: "inherit", timeout: 10 * 60_000 });

    const installBin = path.join(prefix, "bin");
    const ffmpeg = path.join(installBin, "ffmpeg");
    const ffprobe = path.join(installBin, "ffprobe");
    for (const executable of [ffmpeg, ffprobe]) await fs.access(executable);
    assertSystemOnlyDylibs(
      runCommand("otool", ["-L", ffmpeg], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
    );
    assertSystemOnlyDylibs(
      runCommand("otool", ["-L", ffprobe], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
    );
    for (const executable of [ffmpeg, ffprobe])
      runCommand(executable, ["-version"], { stdio: "ignore", timeout: 30_000 });

    await fs.mkdir(stage, { recursive: false });
    stageCreated = true;
    const targetBin = path.join(stage, "bin");
    await fs.mkdir(targetBin);
    for (const name of ["ffmpeg", "ffprobe"]) {
      const source = path.join(installBin, name);
      const target = path.join(targetBin, name);
      await fs.copyFile(source, target);
      await fs.chmod(target, (await fs.stat(source)).mode & 0o777);
    }
    await fs.copyFile(path.join(sourceRoot, "LICENSE.md"), path.join(stage, "LICENSE.txt"));
    await fs.copyFile(path.join(sourceRoot, "COPYING.GPLv3"), path.join(stage, "COPYING.GPLv3"));
    await fs.writeFile(
      path.join(stage, "PROVENANCE.json"),
      JSON.stringify(
        {
          component: "ffmpeg",
          version: FFMPEG_SOURCE.version,
          platform: "darwin-arm64",
          source: FFMPEG_SOURCE.url,
          sourceSha256: FFMPEG_SOURCE.sha256,
          configureArguments: configureArgs,
          build: "static; autodetect disabled; no non-system dylibs"
        },
        null,
        2
      ) + "\n",
      "utf8"
    );
    const smokeOutput = path.join(workRoot, "ffmpeg-smoke.wav");
    runCommand(
      path.join(targetBin, "ffmpeg"),
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "lavfi",
        "-i",
        "anullsrc=r=16000:cl=mono",
        "-t",
        "0.1",
        "-c:a",
        "pcm_s16le",
        "-y",
        smokeOutput
      ],
      { stdio: "inherit", timeout: 30_000 }
    );
    runCommand(path.join(targetBin, "ffprobe"), ["-v", "error", "-show_entries", "format=duration", smokeOutput], {
      stdio: "ignore",
      timeout: 30_000
    });
    return { stagingDirectory: stage, version: FFMPEG_SOURCE.version, installedBytes: await directoryBytes(stage) };
  } catch (error) {
    if (stageCreated) await fs.rm(stage, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  } finally {
    await fs.rm(workRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

function validateSourceListing(listing) {
  const entries = listing.split(/\r?\n/u).filter(Boolean);
  if (!entries.length) throw new Error("FFmpeg 官方源码归档为空");
  for (const entry of entries) {
    const normalized = entry.replaceAll("\\", "/").replace(/\/$/u, "");
    const segments = normalized.split("/");
    if (
      !normalized ||
      path.posix.isAbsolute(normalized) ||
      segments[0] !== `ffmpeg-${FFMPEG_SOURCE.version}` ||
      segments.some((segment) => !segment || segment === "." || segment === ".." || segment.includes(":"))
    ) {
      throw new Error("FFmpeg 固定源码归档路径无效：" + entry);
    }
  }
}

function assertSystemOnlyDylibs(output) {
  for (const line of output.split(/\r?\n/u).slice(1)) {
    const dependency = line.trim().split(" ")[0];
    if (!dependency) continue;
    if (!(dependency.startsWith("/usr/lib/") || dependency.startsWith("/System/Library/"))) {
      throw new Error(`FFmpeg 二进制依赖了需要额外打包的动态库：${dependency}`);
    }
  }
}

async function directoryBytes(root) {
  let bytes = 0;
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    const candidate = path.join(root, entry.name);
    if (entry.isDirectory()) bytes += await directoryBytes(candidate);
    else if (entry.isFile()) bytes += (await fs.stat(candidate)).size;
  }
  return bytes;
}

function pathExists(candidate) {
  return fs.lstat(candidate).then(
    () => true,
    (error) => {
      if (error?.code === "ENOENT") return false;
      throw error;
    }
  );
}

function parseArguments(argv) {
  if (argv.length !== 2 || argv[0] !== "--stage" || !argv[1]) {
    throw new Error("用法：pnpm components:prepare-ffmpeg -- --stage <新暂存目录>");
  }
  return { stagingDirectory: argv[1] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await prepareFfmpegComponent(parseArguments(process.argv.slice(2)));
    console.log(`FFmpeg ${result.version} Apple Silicon 暂存目录已准备：${result.stagingDirectory}`);
    console.log(`资产大小：${result.installedBytes} bytes`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "FFmpeg macOS 能力准备失败");
    process.exitCode = 1;
  }
}
