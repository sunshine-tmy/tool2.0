import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  assertCapabilities,
  assertMachOArm64,
  assertMinimumOS,
  assertNoTemporaryBuildReferences,
  assertSystemOnlyDylibs,
  buildFfmpegConfigureArgs,
  createLamePkgConfigAlias,
  MACOS_MEDIA_SOURCE_LOCK,
  parseFfmpegArguments,
  sanitizeBuildPaths,
  validateSourceListing
} from "./prepare-ffmpeg-component.mjs";

test("macOS media source lock pins all source artifacts and target constraints", () => {
  assert.equal(MACOS_MEDIA_SOURCE_LOCK.target.minimumMacOS, "14.0");
  for (const source of Object.values(MACOS_MEDIA_SOURCE_LOCK.sources)) {
    assert.ok(source.version || source.revision);
    assert.match(source.sha256 ?? source.revision, /^[a-f0-9]{40,64}$/u);
  }
});

test("FFmpeg config keeps static external codecs, required capabilities and isolation flags", () => {
  const args = buildFfmpegConfigureArgs();
  for (const flag of [
    "--disable-autodetect",
    "--disable-shared",
    "--enable-static",
    "--enable-gpl",
    "--enable-zlib",
    "--enable-libx264",
    "--enable-libmp3lame",
    "--enable-libvorbis",
    "--enable-libopus",
    "--enable-encoder=libx264",
    "--enable-encoder=libmp3lame",
    "--enable-encoder=libvorbis",
    "--enable-encoder=libopus",
    "--enable-filter=overlay",
    "--enable-muxer=ogg"
  ]) {
    assert.ok(args.includes(flag), `missing ${flag}`);
  }
  assert.ok(args.includes("--prefix=/usr/local"));
  assert.ok(!args.some((argument) => /\/opt\/homebrew|\/usr\/local\/opt|\/\.package\//u.test(argument)));
});

test("source archive listing accepts only the expected root and safe relative entries", () => {
  assert.doesNotThrow(() => validateSourceListing("ffmpeg-8.1.2/\nffmpeg-8.1.2/configure\n"));
  for (const listing of [
    "",
    "/tmp/evil",
    "ffmpeg-8.1.2/../../outside",
    "ffmpeg-8.1.2:stream/configure",
    "other-root/configure"
  ]) {
    assert.throws(() => validateSourceListing(listing), /源码归档/u);
  }
});

test("FFmpeg CLI accepts pnpm argument separator and keeps strict stage parsing", () => {
  assert.deepEqual(parseFfmpegArguments(["--", "--stage", ".package/媒体 验证"]), {
    stagingDirectory: ".package/媒体 验证"
  });
  assert.deepEqual(parseFfmpegArguments(["--stage", "stage"]), { stagingDirectory: "stage" });
  assert.throws(() => parseFfmpegArguments(["--", "--stage"]), /用法/u);
  assert.throws(() => parseFfmpegArguments(["--stage", "stage", "--force"]), /用法/u);
});

test("LAME pkg-config alias exposes the module name expected by FFmpeg", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lame-pkgconfig-"));
  const pkgConfigDirectory = path.join(root, "usr", "local", "lib", "pkgconfig");
  await fs.mkdir(pkgConfigDirectory, { recursive: true });
  await fs.writeFile(
    path.join(pkgConfigDirectory, "lame.pc"),
    "Name: lame\nVersion: 4.0\nLibs: -lmp3lame\nCflags: -I${includedir}/lame\n"
  );
  try {
    await createLamePkgConfigAlias(root);
    const alias = await fs.readFile(path.join(pkgConfigDirectory, "libmp3lame.pc"), "utf8");
    assert.match(alias, /^Cflags: -I\$\{includedir\}$/mu);
    assert.match(alias, /^Version: 4\.0$/mu);
    assert.match(alias, /^Libs: -lmp3lame$/mu);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("Mach-O inspection requires a single arm64 executable and macOS 14 minimum", () => {
  assert.doesNotThrow(() => assertMachOArm64("ffmpeg: Mach-O 64-bit executable arm64", "arm64"));
  assert.throws(() => assertMachOArm64("ffmpeg: Mach-O 64-bit executable x86_64", "x86_64"), /arm64/u);
  assert.doesNotThrow(() => assertMinimumOS("cmd LC_BUILD_VERSION\n minos 14.0\n sdk 15.5", "14.0"));
  assert.throws(() => assertMinimumOS("cmd LC_BUILD_VERSION\n minos 14.1", "14.0"), /最低系统/u);
  assert.throws(() => assertMinimumOS("no build version", "14.0"), /最低系统/u);
});

test("dynamic library audit accepts system libraries and rejects developer libraries", () => {
  assert.doesNotThrow(() =>
    assertSystemOnlyDylibs(
      "ffmpeg:\n\t/usr/lib/libSystem.B.dylib (compatibility version 1.0.0)\n\t/System/Library/Frameworks/CoreFoundation.framework/Versions/A/CoreFoundation"
    )
  );
  assert.throws(
    () => assertSystemOnlyDylibs("ffmpeg:\n\t/opt/homebrew/lib/libopus.0.dylib (compatibility version 1.0.0)"),
    /libopus/u
  );
});

test("temporary build path audit ignores otool headers and rejects embedded load commands", () => {
  const workRoot = "/project/.package/ffmpeg-build-123";
  assert.doesNotThrow(() =>
    assertNoTemporaryBuildReferences(
      `${workRoot}/bin/ffmpeg:\nLoad command 0\n cmd LC_BUILD_VERSION`,
      `${workRoot}/bin/ffmpeg:\n\t/usr/lib/libSystem.B.dylib`,
      workRoot
    )
  );
  assert.throws(
    () =>
      assertNoTemporaryBuildReferences(
        "ffmpeg:\nLoad command 1\n cmd LC_RPATH\n path /project/.package/ffmpeg-build-123/lib",
        "ffmpeg:\n\t/usr/lib/libSystem.B.dylib",
        workRoot
      ),
    /临时构建目录/u
  );
});

test("build provenance replaces temporary and user-specific paths with stable placeholders", () => {
  const workRoot = "/Users/example/project/.package/ffmpeg-build-123";
  const installRoot = `${workRoot}/local-root`;
  assert.equal(
    sanitizeBuildPaths(`${installRoot}/usr/local/include -L${installRoot}/usr/local/lib`, workRoot, installRoot),
    "<ISOLATED_DESTDIR>/usr/local/include -L<ISOLATED_DESTDIR>/usr/local/lib"
  );
  assert.equal(sanitizeBuildPaths(`${workRoot}/sources/ffmpeg`, workRoot, installRoot), "<BUILD_ROOT>/sources/ffmpeg");
});

test("capability audit reports every missing business codec/filter/container", () => {
  const expected = { encoders: ["libx264", "libopus"], filters: ["overlay"], muxers: ["ogg"] };
  assert.doesNotThrow(() =>
    assertCapabilities({ encoders: ["libx264", "libopus"], filters: ["overlay"], muxers: ["ogg"] }, expected)
  );
  assert.throws(
    () => assertCapabilities({ encoders: ["libx264"], filters: [], muxers: [] }, expected),
    /encoders：libopus/u
  );
});
