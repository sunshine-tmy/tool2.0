// Anchor filesystem and CLI identity at the stable public entry.
const publicEntryUrl = new URL("../../scripts/prepare-ffmpeg-component.mjs", import.meta.url).href;

/** 中文模块说明：从锁定源码构建 Apple Silicon 静态媒体运行时，并审计候选二进制。 */
import crypto from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import SOURCE_LOCK from "./macos-media-sources.json" with { type: "json" };
import { downloadFixedFile } from "./download-fixed-model-file.mjs";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(publicEntryUrl)), "..");
export const FFMPEG_SOURCE = SOURCE_LOCK.sources.ffmpeg;
export const MACOS_MEDIA_SOURCE_LOCK = SOURCE_LOCK;
const JOBS = Math.min(4, Math.max(1, os.availableParallelism() - 1));
const INSTALL_PREFIX = "/usr/local";

export async function prepareFfmpegComponent({ stagingDirectory, runCommand = execFileSync }) {
  if (process.platform !== "darwin" || process.arch !== "arm64") {
    throw new Error("FFmpeg macOS 能力必须在 Apple Silicon 原生构建机上制作");
  }
  const stage = path.resolve(stagingDirectory);
  if (await pathExists(stage)) throw new Error("FFmpeg 暂存目录已存在，拒绝覆盖");

  const workRoot = path.join(REPOSITORY_ROOT, ".package", `ffmpeg-macos-arm64-${crypto.randomUUID()}`);
  const sourceCache = path.join(REPOSITORY_ROOT, ".package", "macos-media-source-cache");
  const sourceRoot = path.join(workRoot, "sources");
  const installRoot = path.join(workRoot, "local-root");
  let stageCreated = false;
  let buildCompleted = false;
  try {
    await fs.mkdir(sourceRoot, { recursive: true });
    await fs.mkdir(sourceCache, { recursive: true });
    const sdkPath = commandText(runCommand("xcrun", ["--sdk", "macosx", "--show-sdk-path"])).trim();
    const sdkVersion = commandText(runCommand("xcrun", ["--sdk", "macosx", "--show-sdk-version"])).trim();
    const clang = commandText(runCommand("xcrun", ["--find", "clang"])).trim();
    const pkgConfig = findExecutable("pkg-config");
    const targetFlags = [
      `-arch ${SOURCE_LOCK.target.architecture}`,
      `-isysroot ${sdkPath}`,
      `-mmacosx-version-min=${SOURCE_LOCK.target.minimumMacOS}`
    ];
    const buildEnvironment = {
      ...process.env,
      CC: clang,
      CFLAGS: `${targetFlags.join(" ")} -O2`,
      CXXFLAGS: `${targetFlags.join(" ")} -O2`,
      LDFLAGS: `${targetFlags.join(" ")} -Wl,-headerpad_max_install_names`,
      MACOSX_DEPLOYMENT_TARGET: SOURCE_LOCK.target.minimumMacOS,
      PKG_CONFIG: pkgConfig,
      PKG_CONFIG_LIBDIR: `${path.join(installRoot, "usr", "local", "lib", "pkgconfig")}:${path.join(installRoot, "usr", "local", "share", "pkgconfig")}`,
      PKG_CONFIG_PATH: "",
      PKG_CONFIG_SYSROOT_DIR: installRoot,
      CPPFLAGS: "",
      LIBRARY_PATH: "",
      CPATH: "",
      C_INCLUDE_PATH: "",
      CPLUS_INCLUDE_PATH: "",
      DYLD_LIBRARY_PATH: "",
      DYLD_FALLBACK_LIBRARY_PATH: "",
      LIBS: ""
    };

    const unpack = async (name, source) => {
      const archive = path.join(
        sourceCache,
        `${name}-${source.version}${source.url.endsWith(".tar.xz") ? ".tar.xz" : ".tar.gz"}`
      );
      if ((await pathExists(archive)) && (await fileSha256(archive)) !== source.sha256) {
        await fs.rm(archive, { force: true });
      }
      if (!(await pathExists(archive))) {
        await downloadFixedFile({ url: source.url, destination: archive, expectedSha256: source.sha256 });
      }
      const listing = commandText(
        runCommand("tar", ["-tf", archive], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          timeout: 60_000,
          maxBuffer: 32 * 1024 * 1024
        })
      );
      const rootName = `${name === "ogg" ? "libogg" : name === "vorbis" ? "libvorbis" : name}-${source.version}`;
      validateSourceListing(listing, rootName);
      const extraction = path.join(sourceRoot, name);
      await fs.mkdir(extraction, { recursive: true });
      runCommand("tar", ["-xf", archive, "-C", extraction], { stdio: "inherit", timeout: 120_000 });
      const root = path.join(extraction, rootName);
      await fs.access(path.join(root, "configure"));
      return root;
    };
    const buildAutotools = (source, args, env = buildEnvironment) => {
      runCommand("chmod", ["+x", path.join(source, "configure")], { stdio: "inherit" });
      runCommand("./configure", args, { cwd: source, env, stdio: "inherit", timeout: 10 * 60_000 });
      runCommand("make", ["-j", String(JOBS), `DESTDIR=${installRoot}`, "install"], {
        cwd: source,
        env,
        stdio: "inherit",
        timeout: 90 * 60_000
      });
    };
    const staticLibraryArgs = [`--prefix=${INSTALL_PREFIX}`, "--disable-shared", "--enable-static", "--with-pic"];

    const oggSource = await unpack("ogg", SOURCE_LOCK.sources.ogg);
    buildAutotools(oggSource, staticLibraryArgs);

    const vorbisSource = await unpack("vorbis", SOURCE_LOCK.sources.vorbis);
    runCommand("chmod", ["+x", path.join(vorbisSource, "configure")], { stdio: "inherit" });
    runCommand("./configure", staticLibraryArgs, {
      cwd: vorbisSource,
      env: buildEnvironment,
      stdio: "inherit",
      timeout: 10 * 60_000
    });
    runCommand("make", ["-C", "lib", "-j", String(JOBS), "libvorbis.la", "libvorbisfile.la", "libvorbisenc.la"], {
      cwd: vorbisSource,
      env: buildEnvironment,
      stdio: "inherit",
      timeout: 90 * 60_000
    });
    await installVorbisStatic(vorbisSource, installRoot);

    const opusSource = await unpack("opus", SOURCE_LOCK.sources.opus);
    buildAutotools(opusSource, [...staticLibraryArgs, "--disable-extra-programs", "--disable-doc"]);

    const lameSource = await unpack("lame", SOURCE_LOCK.sources.lame);
    buildAutotools(lameSource, [...staticLibraryArgs, "--disable-frontend", "--disable-decoder"]);
    await createLamePkgConfigAlias(installRoot);
    const lamePkgConfigFlags = commandText(
      runCommand(pkgConfig, ["--static", "--cflags", "--libs", "libmp3lame"], {
        encoding: "utf8",
        env: buildEnvironment,
        stdio: ["ignore", "pipe", "pipe"]
      })
    ).trim();
    if (!lamePkgConfigFlags.includes("-lmp3lame")) throw new Error("隔离 pkg-config 未解析出 libmp3lame 静态库");

    const x264Source = await cloneFixedX264(sourceRoot, sourceCache, runCommand);
    runCommand("chmod", ["+x", path.join(x264Source, "configure")], { stdio: "inherit" });
    runCommand(
      "./configure",
      [
        `--prefix=${INSTALL_PREFIX}`,
        "--enable-static",
        "--enable-pic",
        "--disable-cli",
        "--disable-opencl",
        "--bit-depth=8",
        "--chroma-format=420"
      ],
      { cwd: x264Source, env: buildEnvironment, stdio: "inherit", timeout: 10 * 60_000 }
    );
    runCommand("make", ["-j", String(JOBS)], {
      cwd: x264Source,
      env: buildEnvironment,
      stdio: "inherit",
      timeout: 90 * 60_000
    });
    runCommand("make", [`DESTDIR=${installRoot}`, "install"], {
      cwd: x264Source,
      env: buildEnvironment,
      stdio: "inherit",
      timeout: 10 * 60_000
    });

    const ffmpegSource = await unpack("ffmpeg", SOURCE_LOCK.sources.ffmpeg);
    const configureArgs = buildFfmpegConfigureArgs(INSTALL_PREFIX);
    const ffmpegBuildEnvironment = {
      ...buildEnvironment,
      CFLAGS: `${buildEnvironment.CFLAGS} -I${path.join(installRoot, "usr", "local", "include")}`,
      LDFLAGS: `${buildEnvironment.LDFLAGS} -L${path.join(installRoot, "usr", "local", "lib")}`
    };
    runCommand("chmod", ["+x", path.join(ffmpegSource, "configure")], { stdio: "inherit" });
    runCommand("./configure", configureArgs, {
      cwd: ffmpegSource,
      env: ffmpegBuildEnvironment,
      stdio: "inherit",
      timeout: 15 * 60_000
    });
    runCommand("make", ["-j", String(JOBS)], {
      cwd: ffmpegSource,
      env: ffmpegBuildEnvironment,
      stdio: "inherit",
      timeout: 90 * 60_000
    });
    runCommand("make", [`DESTDIR=${installRoot}`, "install"], {
      cwd: ffmpegSource,
      env: ffmpegBuildEnvironment,
      stdio: "inherit",
      timeout: 15 * 60_000
    });

    const installBin = path.join(installRoot, "usr", "local", "bin");
    const binaries = Object.fromEntries(["ffmpeg", "ffprobe"].map((name) => [name, path.join(installBin, name)]));
    for (const binary of Object.values(binaries)) await fs.access(binary);
    const audits = {};
    for (const [name, binary] of Object.entries(binaries)) {
      const fileOutput = commandText(runCommand("file", [binary]));
      const architectures = commandText(runCommand("lipo", ["-archs", binary]));
      const dylibs = commandText(runCommand("otool", ["-L", binary]));
      const loadCommands = commandText(runCommand("otool", ["-l", binary]));
      assertMachOArm64(fileOutput, architectures, name);
      assertSystemOnlyDylibs(dylibs);
      assertMinimumOS(loadCommands, SOURCE_LOCK.target.minimumMacOS, name);
      assertNoTemporaryBuildReferences(loadCommands, dylibs, workRoot, name);
      audits[name] = {
        file: fileOutput.trim().replace(`${binary}: `, `${name}: `),
        architectures: architectures.trim().split(/\s+/u),
        dynamicLibraries: parseDynamicLibraries(dylibs),
        minimumMacOS: SOURCE_LOCK.target.minimumMacOS,
        sha256: await fileSha256(binary)
      };
      runCommand(binary, ["-version"], { stdio: "ignore", timeout: 30_000 });
    }

    const ffmpeg = binaries.ffmpeg;
    const capabilities = {
      encoders: parseNamedCapabilities(captureOutput(ffmpeg, ["-hide_banner", "-encoders"])),
      decoders: parseNamedCapabilities(captureOutput(ffmpeg, ["-hide_banner", "-decoders"])),
      filters: parseNamedCapabilities(captureOutput(ffmpeg, ["-hide_banner", "-filters"])),
      demuxers: parseContainerCapabilities(captureOutput(ffmpeg, ["-hide_banner", "-demuxers"])),
      muxers: parseContainerCapabilities(captureOutput(ffmpeg, ["-hide_banner", "-muxers"])),
      buildConfiguration: captureOutput(ffmpeg, ["-hide_banner", "-buildconf"])
    };
    assertCapabilities(capabilities, SOURCE_LOCK.ffmpegCapabilities);
    if (
      capabilities.buildConfiguration.includes(workRoot) ||
      /\/opt\/homebrew|\/usr\/local\/opt/u.test(capabilities.buildConfiguration)
    ) {
      throw new Error("FFmpeg 构建配置中包含临时构建或 Homebrew 路径");
    }
    for (const expectedFlag of [
      "--disable-autodetect",
      "--enable-libx264",
      "--enable-libmp3lame",
      "--enable-libvorbis",
      "--enable-libopus"
    ]) {
      if (!capabilities.buildConfiguration.includes(expectedFlag)) {
        throw new Error(`FFmpeg 构建配置缺少 ${expectedFlag}`);
      }
    }

    await fs.mkdir(stage, { recursive: false });
    stageCreated = true;
    const targetBin = path.join(stage, "bin");
    const licenseDirectory = path.join(stage, "licenses");
    await fs.mkdir(targetBin);
    await fs.mkdir(licenseDirectory);
    for (const name of ["ffmpeg", "ffprobe"]) {
      const source = binaries[name];
      const target = path.join(targetBin, name);
      await fs.copyFile(source, target);
      await fs.chmod(target, (await fs.stat(source)).mode & 0o777);
    }
    await copyFirstExisting(ffmpegSource, ["LICENSE.md"], path.join(licenseDirectory, "LICENSE.FFmpeg.txt"));
    await copyFirstExisting(ffmpegSource, ["COPYING.GPLv2"], path.join(licenseDirectory, "COPYING.FFmpeg.GPLv2"));
    await copyFirstExisting(ffmpegSource, ["COPYING.LGPLv2.1"], path.join(licenseDirectory, "COPYING.FFmpeg.LGPLv2.1"));
    await copyFirstExisting(x264Source, ["COPYING"], path.join(licenseDirectory, "COPYING.x264.GPLv2"));
    await copyFirstExisting(lameSource, ["LICENSE"], path.join(licenseDirectory, "NOTICE.LAME.txt"));
    await copyFirstExisting(lameSource, ["COPYING"], path.join(licenseDirectory, "COPYING.LAME.LGPLv2"));
    await copyFirstExisting(oggSource, ["COPYING"], path.join(licenseDirectory, "COPYING.libogg.txt"));
    await copyFirstExisting(vorbisSource, ["COPYING"], path.join(licenseDirectory, "COPYING.libvorbis.txt"));
    await copyFirstExisting(opusSource, ["COPYING"], path.join(licenseDirectory, "COPYING.libopus.txt"));
    await fs.copyFile(new URL("./macos-media-sources.json", import.meta.url), path.join(stage, "SOURCE_LOCK.json"));
    await fs.writeFile(
      path.join(stage, "CAPABILITIES.json"),
      JSON.stringify({ ...SOURCE_LOCK.ffmpegCapabilities, detected: capabilities }, null, 2) + "\n",
      "utf8"
    );

    const provenance = {
      schemaVersion: 1,
      component: "ffmpeg",
      version: SOURCE_LOCK.sources.ffmpeg.version,
      target: SOURCE_LOCK.target,
      sources: SOURCE_LOCK.sources,
      build: {
        configureArguments: configureArgs.map((argument) => argument.replaceAll(INSTALL_PREFIX, "<PREFIX>")),
        x264ConfigureArguments: [
          `--prefix=${INSTALL_PREFIX}`,
          "--enable-static",
          "--enable-pic",
          "--disable-cli",
          "--disable-opencl",
          "--bit-depth=8",
          "--chroma-format=420"
        ],
        libraryConfigureArguments: {
          ogg: staticLibraryArgs,
          vorbis: staticLibraryArgs,
          opus: [...staticLibraryArgs, "--disable-extra-programs", "--disable-doc"],
          lame: [...staticLibraryArgs, "--disable-frontend", "--disable-decoder"]
        },
        compiler: path.basename(clang),
        compilerVersion: commandText(runCommand(clang, ["--version"])).split(/\r?\n/u)[0],
        sdkVersion,
        sdkPath,
        pkgConfig: path.basename(pkgConfig),
        pkgConfigVersion: commandText(runCommand(pkgConfig, ["--version"])).trim(),
        pkgConfigAliases: [
          "libmp3lame.pc names the pinned LAME module and corrects its nested lame/lame.h include prefix"
        ],
        lamePkgConfigFlags: sanitizeBuildPaths(lamePkgConfigFlags, workRoot, installRoot),
        ffmpegStaticPrefixFlags: { cflags: "-I<PREFIX>/include", ldflags: "-L<PREFIX>/lib" },
        minimumMacOS: SOURCE_LOCK.target.minimumMacOS,
        architecture: SOURCE_LOCK.target.architecture,
        parallelJobs: JOBS,
        dynamicLibraryPolicy: "system libraries only; all third-party media libraries linked statically",
        vorbisBuildTargets: ["libvorbis.la", "libvorbisfile.la", "libvorbisenc.la"],
        autodetection: "disabled"
      },
      audits,
      modelValidation: "not_applicable"
    };
    await fs.writeFile(path.join(stage, "PROVENANCE.json"), JSON.stringify(provenance, null, 2) + "\n", "utf8");

    const smokeResults = await runCodecSmokes({ ffmpeg, ffprobe: binaries.ffprobe, workRoot, runCommand });
    await fs.writeFile(path.join(stage, "SMOKE-RESULTS.json"), JSON.stringify(smokeResults, null, 2) + "\n", "utf8");
    const result = {
      stagingDirectory: stage,
      version: SOURCE_LOCK.sources.ffmpeg.version,
      installedBytes: await directoryBytes(stage),
      audits,
      capabilities,
      smokeResults
    };
    buildCompleted = true;
    return result;
  } catch (error) {
    if (stageCreated) await fs.rm(stage, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  } finally {
    if (buildCompleted) await fs.rm(workRoot, { recursive: true, force: true }).catch(() => undefined);
    else console.error(`FFmpeg 失败构建的临时源码和诊断材料保留在：${workRoot}`);
  }
}

export function buildFfmpegConfigureArgs(prefix = INSTALL_PREFIX) {
  const features = SOURCE_LOCK.ffmpegCapabilities;
  return [
    `--prefix=${prefix}`,
    "--disable-debug",
    "--disable-doc",
    "--disable-ffplay",
    "--disable-autodetect",
    "--disable-shared",
    "--enable-static",
    "--enable-pthreads",
    "--enable-gpl",
    "--enable-zlib",
    "--enable-libx264",
    "--enable-libmp3lame",
    "--enable-libvorbis",
    "--enable-libopus",
    "--pkg-config-flags=--static",
    ...features.encoders.map((name) => `--enable-encoder=${name}`),
    ...features.decoders.map((name) => `--enable-decoder=${name}`),
    ...features.filters.map((name) => `--enable-filter=${name}`),
    ...features.demuxers.map((name) => `--enable-demuxer=${name}`),
    ...features.muxers.map((name) => `--enable-muxer=${name}`)
  ];
}

export function validateSourceListing(listing, expectedRoot = `ffmpeg-${FFMPEG_SOURCE.version}`) {
  const entries = listing.split(/\r?\n/u).filter(Boolean);
  if (!entries.length) throw new Error("固定源码归档为空");
  for (const entry of entries) {
    const normalized = entry.replaceAll("\\", "/").replace(/\/$/u, "");
    const segments = normalized.split("/");
    if (
      !normalized ||
      path.posix.isAbsolute(normalized) ||
      segments[0] !== expectedRoot ||
      segments.some((segment) => !segment || segment === "." || segment === ".." || segment.includes(":"))
    ) {
      throw new Error("固定源码归档路径无效：" + entry);
    }
  }
}

export function assertSystemOnlyDylibs(output) {
  for (const line of output.split(/\r?\n/u).slice(1)) {
    const dependency = line.trim().split(" ")[0];
    if (!dependency) continue;
    if (!(dependency.startsWith("/usr/lib/") || dependency.startsWith("/System/Library/"))) {
      throw new Error(`FFmpeg 二进制依赖了需要额外打包的动态库：${dependency}`);
    }
  }
}

export function assertMachOArm64(fileOutput, architectures, name = "FFmpeg") {
  if (!/Mach-O 64-bit executable arm64/u.test(fileOutput) || architectures.trim() !== "arm64") {
    throw new Error(`${name} 必须是仅含 arm64 的 Mach-O 64 位可执行文件`);
  }
}

export function assertMinimumOS(loadCommands, minimumOS, name = "FFmpeg") {
  const match =
    loadCommands.match(/\bminos\s+(\d+(?:\.\d+){1,2})/u) ?? loadCommands.match(/\bversion\s+(\d+(?:\.\d+){1,2})/u);
  if (!match || compareVersions(match[1], minimumOS) > 0) {
    throw new Error(`${name} 的 Mach-O 最低系统目标缺失或高于 macOS ${minimumOS}`);
  }
}

export function assertNoTemporaryBuildReferences(loadCommands, dylibs, workRoot, name = "FFmpeg") {
  const loadCommandDetails = loadCommands.split(/\r?\n/u).slice(1).join("\n");
  const dynamicLibraryDetails = dylibs.split(/\r?\n/u).slice(1).join("\n");
  if (loadCommandDetails.includes(workRoot) || dynamicLibraryDetails.includes(workRoot)) {
    throw new Error(`${name} 二进制引用了临时构建目录`);
  }
}

export function sanitizeBuildPaths(value, workRoot, installRoot) {
  return value.replaceAll(installRoot, "<ISOLATED_DESTDIR>").replaceAll(workRoot, "<BUILD_ROOT>");
}

export function assertCapabilities(detected, expected) {
  for (const category of Object.keys(expected)) {
    const missing = expected[category].filter((name) => !detected[category].includes(name));
    if (missing.length) throw new Error(`FFmpeg 缺少 ${category}：${missing.join(", ")}`);
  }
}

function parseNamedCapabilities(output) {
  return output
    .split(/\r?\n/u)
    .map((line) => line.trim().split(/\s+/u).filter(Boolean))
    .filter((parts) => parts.length >= 2 && /^[A-Z.]{2,}$/u.test(parts[0]))
    .map((parts) => parts[1]);
}

function parseContainerCapabilities(output) {
  const values = [];
  for (const line of output.split(/\r?\n/u)) {
    const match = line.match(/^\s*[DE.]{1,2}\s+([a-z0-9_,]+)\s+/iu);
    if (match) values.push(...match[1].split(","));
  }
  return [...new Set(values)];
}

async function installVorbisStatic(sourceRoot, installRoot) {
  const prefixRoot = path.join(installRoot, "usr", "local");
  const libraryDirectory = path.join(prefixRoot, "lib");
  const pkgConfigDirectory = path.join(libraryDirectory, "pkgconfig");
  const includeDirectory = path.join(prefixRoot, "include", "vorbis");
  await fs.mkdir(pkgConfigDirectory, { recursive: true });
  await fs.mkdir(path.dirname(includeDirectory), { recursive: true });
  await fs.cp(path.join(sourceRoot, "include", "vorbis"), includeDirectory, { recursive: true });
  for (const name of ["libvorbis.a", "libvorbisfile.a", "libvorbisenc.a"]) {
    await fs.copyFile(path.join(sourceRoot, "lib", ".libs", name), path.join(libraryDirectory, name));
  }
  for (const name of ["vorbis.pc", "vorbisenc.pc", "vorbisfile.pc"]) {
    await fs.copyFile(path.join(sourceRoot, name), path.join(pkgConfigDirectory, name));
  }
}

export async function createLamePkgConfigAlias(installRoot) {
  const pkgConfigDirectory = path.join(installRoot, "usr", "local", "lib", "pkgconfig");
  const upstreamPath = path.join(pkgConfigDirectory, "lame.pc");
  const source = await fs.readFile(upstreamPath, "utf8");
  if (!/^Cflags:.*$/mu.test(source)) throw new Error("LAME pkg-config 文件缺少 Cflags");
  const compatible = source.replace(/^Cflags:.*$/mu, "Cflags: -I${includedir}");
  await fs.writeFile(path.join(pkgConfigDirectory, "libmp3lame.pc"), compatible, "utf8");
}

async function cloneFixedX264(sourceRoot, sourceCache, runCommand) {
  const source = SOURCE_LOCK.sources.x264;
  const directory = path.join(sourceRoot, "x264");
  const cachedRepository = path.join(sourceCache, `x264-${source.revision}.git`);
  if (await pathExists(cachedRepository)) {
    runCommand("git", ["clone", "--shared", "--no-checkout", cachedRepository, directory], {
      stdio: "inherit",
      timeout: 60_000
    });
    runCommand("git", ["-C", directory, "checkout", "--quiet", "--detach", source.revision], { stdio: "inherit" });
  } else {
    runCommand("git", ["init", "--quiet", directory], { stdio: "inherit" });
    runCommand("git", ["-C", directory, "remote", "add", "origin", source.repository], { stdio: "inherit" });
    runCommand("git", ["-C", directory, "fetch", "--depth", "1", "origin", source.revision], {
      stdio: "inherit",
      timeout: 10 * 60_000
    });
    runCommand("git", ["-C", directory, "checkout", "--quiet", "--detach", "FETCH_HEAD"], { stdio: "inherit" });
    runCommand("git", ["clone", "--bare", "--local", directory, cachedRepository], {
      stdio: "inherit",
      timeout: 60_000
    });
  }
  const revision = commandText(runCommand("git", ["-C", directory, "rev-parse", "HEAD"])).trim();
  if (revision !== source.revision) throw new Error("x264 git revision 与源码锁不一致");
  await fs.access(path.join(directory, "configure"));
  return directory;
}

async function runCodecSmokes({ ffmpeg, ffprobe, workRoot, runCommand }) {
  const samples = [
    {
      name: "x264-aac-mp4",
      args: [
        "-f",
        "lavfi",
        "-i",
        "testsrc2=size=64x64:rate=2",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:duration=0.5",
        "-t",
        "0.5",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        "-y"
      ],
      output: "x264-aac.mp4"
    },
    {
      name: "mp3-lame",
      args: ["-f", "lavfi", "-i", "sine=frequency=440:duration=0.25", "-c:a", "libmp3lame", "-y"],
      output: "lame.mp3"
    },
    {
      name: "vorbis-ogg",
      args: ["-f", "lavfi", "-i", "sine=frequency=440:duration=0.25", "-c:a", "libvorbis", "-y"],
      output: "vorbis.ogg"
    },
    {
      name: "opus-ogg",
      args: ["-f", "lavfi", "-i", "sine=frequency=440:duration=0.25", "-c:a", "libopus", "-y"],
      output: "opus.ogg"
    }
  ];
  const results = [];
  for (const sample of samples) {
    const output = path.join(workRoot, sample.output);
    runCommand(ffmpeg, ["-hide_banner", "-loglevel", "error", ...sample.args, output], {
      stdio: "inherit",
      timeout: 60_000
    });
    const metadata = commandText(
      runCommand(ffprobe, ["-v", "error", "-show_entries", "format=format_name,duration", "-of", "json", output])
    );
    const parsed = JSON.parse(metadata);
    if (!parsed?.format?.format_name || !(Number(parsed.format.duration) > 0)) {
      throw new Error(`${sample.name} 编码烟雾用例未生成可读取媒体`);
    }
    results.push({
      name: sample.name,
      format: parsed.format.format_name,
      durationSeconds: Number(parsed.format.duration)
    });
  }
  return results;
}

function findExecutable(name) {
  for (const directory of (process.env.PATH ?? "").split(path.delimiter)) {
    const candidate = path.join(directory, name);
    try {
      if (requireExecutable(candidate)) return candidate;
    } catch {
      // Continue through PATH.
    }
  }
  throw new Error(`缺少构建工具 ${name}`);
}

function requireExecutable(candidate) {
  fsSync.accessSync(candidate, fsSync.constants.X_OK);
  return fsSync.statSync(candidate).isFile();
}

async function copyFirstExisting(sourceRoot, names, destination) {
  for (const name of names) {
    try {
      await fs.copyFile(path.join(sourceRoot, name), destination);
      return;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  throw new Error(`许可证文件缺失：${names.join(" / ")}`);
}

function commandText(result) {
  return typeof result === "string" ? result : String(result ?? "");
}

function captureOutput(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 30_000,
    maxBuffer: 32 * 1024 * 1024
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${command} failed`);
  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
}

function compareVersions(left, right) {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference) return Math.sign(difference);
  }
  return 0;
}

function parseDynamicLibraries(output) {
  return output
    .split(/\r?\n/u)
    .slice(1)
    .map((line) => line.trim().split(" ")[0])
    .filter(Boolean);
}

async function fileSha256(filePath) {
  const digest = crypto.createHash("sha256");
  digest.update(await fs.readFile(filePath));
  return digest.digest("hex");
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

export function parseFfmpegArguments(argv) {
  const args = argv[0] === "--" ? argv.slice(1) : argv;
  if (args.length !== 2 || args[0] !== "--stage" || !args[1]) {
    throw new Error("用法：pnpm components:prepare-ffmpeg -- --stage <新暂存目录>");
  }
  return { stagingDirectory: args[1] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(publicEntryUrl)) {
  try {
    const result = await prepareFfmpegComponent(parseFfmpegArguments(process.argv.slice(2)));
    console.log(`FFmpeg ${result.version} Apple Silicon 暂存目录已准备：${result.stagingDirectory}`);
    console.log(`资产大小：${result.installedBytes} bytes`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "FFmpeg macOS 能力准备失败");
    process.exitCode = 1;
  }
}
