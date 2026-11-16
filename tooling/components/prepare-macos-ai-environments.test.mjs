import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  assertHashPinnedLock,
  assertNativeMachO,
  assertVenvIsolated,
  MACOS_AI_ENVIRONMENT_HELP,
  REWRITE_RECORD_HASH,
  addWheelHash,
  developerDylibDependencies,
  developerInstallIds,
  developerRpaths,
  macOSMinimumFromWheelFilename,
  parseMacOSAIEnvironmentArguments,
  parseComponentSelection,
  runtimeDependencyReplacement,
  withoutRequirement
} from "./prepare-macos-ai-environments.mjs";

test("Mach-O RECORD refresh updates every wheel that owns a shared binary", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "macos-record-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const sitePackages = path.join(root, "site-packages");
  const relative = "cv2/cv2.abi3.so";
  const target = path.join(sitePackages, relative);
  const payload = Buffer.from("ad-hoc signed Mach-O fixture");
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, payload);
  const owners = ["opencv_python", "opencv_contrib_python", "opencv_python_headless"];
  for (const owner of owners) {
    const directory = path.join(sitePackages, `${owner}-4.11.0.dist-info`);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, "RECORD"), `${relative},sha256=old,1\n`);
  }

  execFileSync("python3", ["-I", "-c", REWRITE_RECORD_HASH, sitePackages, relative, target]);

  const expectedDigest = createHash("sha256").update(payload).digest("base64url");
  for (const owner of owners) {
    const record = await fs.readFile(path.join(sitePackages, `${owner}-4.11.0.dist-info`, "RECORD"), "utf8");
    assert.equal(record, `${relative},sha256=${expectedDigest},${payload.length}\n`);
  }
});

test("Mac AI environment CLI requires explicit absolute paths and supports help", () => {
  assert.deepEqual(parseMacOSAIEnvironmentArguments(["--help"]), { help: true });
  assert.match(MACOS_AI_ENVIRONMENT_HELP, /离线构建.*wheelhouse 安装/u);
  assert.deepEqual(
    parseMacOSAIEnvironmentArguments([
      "--",
      "--python",
      "/tmp/python3.12",
      "--uv",
      "/tmp/uv",
      "--output",
      "/tmp/new-run",
      "--wheel-cache-root",
      "/tmp/verified-cache",
      "--audit-resume",
      "--components",
      "image-ai,video-ai"
    ]),
    {
      python: "/tmp/python3.12",
      uv: "/tmp/uv",
      output: "/tmp/new-run",
      components: ["image-ai", "video-ai"],
      wheelCacheRoot: "/tmp/verified-cache",
      auditResume: true
    }
  );
});

test("Mac AI environment CLI rejects relative, duplicate, unknown, and empty arguments", () => {
  assert.throws(() => parseMacOSAIEnvironmentArguments([]), /绝对路径/u);
  assert.throws(() => parseMacOSAIEnvironmentArguments(["--python", "relative"]), /绝对路径/u);
  assert.throws(
    () =>
      parseMacOSAIEnvironmentArguments([
        "--python",
        "/tmp/python",
        "--uv",
        "/tmp/uv",
        "--output",
        "/tmp/out",
        "--components",
        "image-ai,unknown"
      ]),
    /不支持/u
  );
  assert.throws(
    () =>
      parseMacOSAIEnvironmentArguments([
        "--python",
        "/tmp/python",
        "--uv",
        "/tmp/uv",
        "--output",
        "/tmp/out",
        "--components",
        "image-ai,image-ai"
      ]),
    /重复/u
  );
  assert.throws(() => parseMacOSAIEnvironmentArguments(["--help", "--uv", "/tmp/uv"]), /无效/u);
  assert.throws(() => parseMacOSAIEnvironmentArguments(["--audit-resume", "--audit-resume"]), /无效/u);
  assert.throws(
    () =>
      parseMacOSAIEnvironmentArguments([
        "--python",
        "/tmp/python",
        "--uv",
        "/tmp/uv",
        "--output",
        "/tmp/out",
        "--wheel-cache-root",
        "relative"
      ]),
    /wheel-cache-root.*绝对路径/u
  );
});

test("Mac AI component selection is non-empty, unique, and limited to the three M01 environments", () => {
  assert.deepEqual(parseComponentSelection(["image-ai", "chatterbox", "video-ai"]), [
    "image-ai",
    "chatterbox",
    "video-ai"
  ]);
  assert.throws(() => parseComponentSelection([]), /为空/u);
  assert.throws(() => parseComponentSelection(["image-ai", "image-ai"]), /重复/u);
  assert.throws(() => parseComponentSelection(["edge-tts"]), /仅可准备/u);
});

test("environment preparation rejects incomplete or unhashed dependency locks", () => {
  const valid = ["numpy==2.3.5 " + String.fromCharCode(92), "    --hash=sha256:" + "a".repeat(64), ""].join("\n");
  assert.doesNotThrow(() => assertHashPinnedLock(valid, "image-ai"));
  assert.throws(() => assertHashPinnedLock("", "image-ai"), /缺少固定版本/u);
  assert.throws(() => assertHashPinnedLock("numpy==2.3.5\n", "image-ai"), /未哈希固定项/u);
});

test("source-only dependencies are omitted only from wheel downloads and built wheel hashes are added", () => {
  const hash = "a".repeat(64);
  const lock = [
    "alpha==1.0 \\",
    "    --hash=sha256:" + "b".repeat(64),
    "    # via",
    "    #   basicsr",
    "basicsr==1.4.2 \\",
    "    --hash=sha256:" + "c".repeat(64),
    "    # via",
    "    #   realesrgan",
    "omega==2.0 \\",
    "    --hash=sha256:" + "d".repeat(64),
    ""
  ].join("\n");
  const downloadLock = withoutRequirement(lock, "basicsr");
  assert.doesNotMatch(downloadLock, /^basicsr==/mu);
  assert.match(downloadLock, /^alpha==/mu);
  assert.match(downloadLock, /^omega==/mu);
  assert.match(downloadLock, /#   basicsr/u);
  const installLock = addWheelHash(lock, "basicsr", hash);
  const basicsrBlock = installLock.split("\n").slice(4, 7).join("\n");
  assert.equal(
    basicsrBlock,
    [
      "basicsr==1.4.2 " + String.fromCharCode(92),
      "    --hash=sha256:" + "c".repeat(64) + " " + String.fromCharCode(92),
      `    --hash=sha256:${hash}`
    ].join("\n")
  );
  assert.doesNotThrow(() => assertHashPinnedLock(installLock, "image-ai"));
  assert.throws(() => withoutRequirement(lock, "missing"), /恰有一个/u);
  assert.throws(() => addWheelHash(lock, "basicsr", "invalid"), /SHA-256/u);
});

test("venv isolation requires system packages disabled and a local interpreter", () => {
  assert.doesNotThrow(() =>
    assertVenvIsolated("include-system-site-packages = false\n", "/tmp/run/env/venv/bin/python", "/tmp/run")
  );
  assert.throws(
    () => assertVenvIsolated("include-system-site-packages = true\n", "/tmp/run/env/venv/bin/python", "/tmp/run"),
    /不得启用/u
  );
  assert.throws(
    () => assertVenvIsolated("include-system-site-packages = false\n", "/usr/bin/python", "/tmp/run"),
    /必须位于/u
  );
});

test("Mach-O audit ignores otool filename headers and checks architecture, minimum OS, and dylib origins", () => {
  const file = "/Users/example/.package/macos-validation/run/image/venv/lib/pkg.so";
  assert.doesNotThrow(() =>
    assertNativeMachO({
      fileOutput: `${file}: Mach-O 64-bit bundle arm64`,
      architectures: "arm64",
      loadCommands: `${file}:\nLoad command 0\n cmd LC_BUILD_VERSION\n minos 11.0\n sdk 15.0`,
      dylibs: `${file} (architecture x86_64):\n\t/usr/lib/libSystem.B.dylib (compatibility version 1.0.0)\n${file} (architecture arm64):\n\t/usr/lib/libSystem.B.dylib (compatibility version 1.0.0)`,
      name: "sample.so"
    })
  );
  assert.throws(
    () =>
      assertNativeMachO({
        fileOutput: "sample.so: Mach-O 64-bit bundle x86_64",
        architectures: "x86_64",
        loadCommands: "sample.so:\n minos 11.0",
        dylibs: "sample.so:\n\t/usr/lib/libSystem.B.dylib",
        name: "sample.so"
      }),
    /arm64/u
  );
  assert.throws(
    () =>
      assertNativeMachO({
        fileOutput: "sample.so: Mach-O 64-bit bundle arm64",
        architectures: "arm64",
        loadCommands: "sample.so:\n minos 14.1",
        dylibs: "sample.so:\n\t/opt/homebrew/lib/libexample.dylib",
        name: "sample.so"
      }),
    /macOS 14/u
  );
  assert.throws(
    () =>
      assertNativeMachO({
        fileOutput: "sample.so: Mach-O 64-bit bundle arm64",
        architectures: "arm64",
        loadCommands:
          "sample.so:\n cmd LC_RPATH\n path /opt/homebrew/lib (offset 12)\n cmd LC_BUILD_VERSION\n minos 11.0",
        dylibs: "sample.so:\n\t/usr/lib/libSystem.B.dylib",
        name: "sample.so"
      }),
    /开发机路径/u
  );
});

test("development-machine LC_RPATH entries are identified for removal while loader-relative entries remain", () => {
  const commands = [
    "Load command 0",
    " cmd LC_RPATH",
    " path /Users/ec2-user/runner/_work/_temp/conda_environment/lib (offset 12)",
    "Load command 1",
    " cmd LC_RPATH",
    " path @loader_path/.dylibs (offset 12)",
    "Load command 2",
    " cmd LC_RPATH",
    " path /opt/homebrew/lib (offset 12)"
  ].join("\n");
  assert.deepEqual(developerRpaths(commands), [
    "/Users/ec2-user/runner/_work/_temp/conda_environment/lib",
    "/opt/homebrew/lib"
  ]);
});

test("development-machine LC_ID_DYLIB paths are normalized to loader-relative install names", () => {
  const commands = [
    "Load command 0",
    " cmd LC_ID_DYLIB",
    " name /DLC/torchvision/.dylibs/libc++.1.0.dylib (offset 24)",
    "Load command 1",
    " cmd LC_ID_DYLIB",
    " name @rpath/libanother.dylib (offset 24)"
  ].join("\n");
  assert.deepEqual(developerInstallIds(commands), [
    {
      original: "/DLC/torchvision/.dylibs/libc++.1.0.dylib",
      normalized: "@loader_path/libc++.1.0.dylib"
    }
  ]);
});

test("Paddle OpenBLAS and GCC runtime references map to bundled arm64 libraries", () => {
  const commands = [
    "Load command 0",
    " cmd LC_LOAD_DYLIB",
    " name /opt/homebrew/opt/openblas/lib/libopenblas.0.dylib (offset 24)",
    "Load command 1",
    " cmd LC_LOAD_DYLIB",
    " name /opt/homebrew/opt/gcc/lib/gcc/current/libgfortran.5.dylib (offset 24)",
    "Load command 2",
    " cmd LC_LOAD_DYLIB",
    " name /opt/homebrew/opt/gcc/lib/gcc/current/libgomp.1.dylib (offset 24)",
    "Load command 3",
    " cmd LC_LOAD_DYLIB",
    " name @@HOMEBREW_PREFIX@@/opt/libomp/lib/libomp.dylib (offset 24)",
    "Load command 5",
    " cmd LC_LOAD_DYLIB",
    " name @rpath/libgcc_s.1.1.dylib (offset 24)",
    "Load command 4",
    " cmd LC_LOAD_DYLIB",
    " name @rpath/libSystem.B.dylib (offset 24)"
  ].join("\n");
  assert.deepEqual(developerDylibDependencies(commands), [
    { original: "/opt/homebrew/opt/openblas/lib/libopenblas.0.dylib", normalized: "@loader_path/libopenblas.0.dylib" },
    {
      original: "/opt/homebrew/opt/gcc/lib/gcc/current/libgfortran.5.dylib",
      normalized: "@loader_path/libgfortran.5.dylib"
    },
    {
      original: "/opt/homebrew/opt/gcc/lib/gcc/current/libgomp.1.dylib",
      normalized: "@loader_path/../../torch/lib/libomp.dylib"
    },
    {
      original: "@@HOMEBREW_PREFIX@@/opt/libomp/lib/libomp.dylib",
      normalized: "@loader_path/../../torch/lib/libomp.dylib"
    },
    { original: "@rpath/libgcc_s.1.1.dylib", normalized: "@loader_path/libgcc_s.1.dylib" }
  ]);
  assert.equal(
    runtimeDependencyReplacement("/opt/homebrew/opt/gcc/lib/gcc/current/libquadmath.0.dylib"),
    "@loader_path/libquadmath.0.dylib"
  );
  assert.throws(
    () =>
      developerDylibDependencies(
        "Load command 0\n cmd LC_LOAD_DYLIB\n name /Users/builder/libcustom.dylib (offset 24)"
      ),
    /缺少受支持的动态库替代项/u
  );
  assert.equal(macOSMinimumFromWheelFilename("paddlepaddle-3.3.1-cp312-cp312-macosx_11_0_arm64.whl"), "11.0");
  assert.throws(
    () => macOSMinimumFromWheelFilename("paddlepaddle-3.3.1-cp312-cp312-manylinux_aarch64.whl"),
    /macOS arm64/u
  );
});
