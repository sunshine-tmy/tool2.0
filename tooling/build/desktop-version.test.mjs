import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { withDesktopVersion } from "./desktop-version.mjs";
import { run } from "./package-desktop.mjs";

async function fixture(t, version = "0.1.9") {
  const scratch = await mkdtemp(path.join(os.tmpdir(), "toolbox-desktop-version-"));
  t.after(async () => {
    assert.equal(path.dirname(scratch), path.resolve(os.tmpdir()));
    assert.ok(path.basename(scratch).startsWith("toolbox-desktop-version-"));
    await rm(scratch, { recursive: true, force: true });
  });
  const desktopRoot = path.join(scratch, "中文 空格");
  await mkdir(desktopRoot);
  const manifestPath = path.join(desktopRoot, "package.json");
  await writeFile(manifestPath, `${JSON.stringify({ name: "desktop", version, productName: "Toolbox" }, null, 2)}\n`);
  return {
    desktopRoot,
    manifestPath,
    read: async () => JSON.parse(await readFile(manifestPath, "utf8")),
    build: (args, callback, env = {}) => withDesktopVersion({ desktopRoot, args, env }, callback)
  };
}

for (const [args, expected] of [
  [[], "0.1.10"],
  [["--bump", "patch"], "0.1.10"],
  [["--bump=minor"], "0.2.0"],
  [["--", "--make", "--bump", "major"], "1.0.0"],
  [["--version", "2.10.0"], "2.10.0"],
  [["--version=0.2.0"], "0.2.0"],
  [["--keep-version"], "0.1.9"]
]) {
  test(`desktop package ${args.join(" ") || "default"} selects ${expected} only on success`, async (t) => {
    const f = await fixture(t);
    assert.equal(
      await f.build(args, async (version) => {
        assert.equal(version, expected);
        assert.equal((await f.read()).version, "0.1.9");
        return "built";
      }),
      "built"
    );
    assert.equal((await f.read()).version, expected);
    assert.deepEqual(await readdir(f.desktopRoot), ["package.json"]);
  });
}

test("failed packaging does not consume a version or leave the lock, and the retry uses the same version", async (t) => {
  const f = await fixture(t);
  const before = await readFile(f.manifestPath, "utf8");
  await assert.rejects(
    f.build([], async () => {
      throw new Error("installer failed");
    }),
    /installer failed/
  );
  assert.equal(await readFile(f.manifestPath, "utf8"), before);
  assert.deepEqual(await readdir(f.desktopRoot), ["package.json"]);
  await f.build([], async (version) => assert.equal(version, "0.1.10"));
  await f.build([], async (version) => assert.equal(version, "0.1.11"));
  assert.equal((await f.read()).version, "0.1.11");
});

test("invalid, conflicting or non-increasing versions stop before packaging", async (t) => {
  const f = await fixture(t);
  for (const args of [
    ["--bump"],
    ["--bump", "auto"],
    ["--version"],
    ["--version", "v1.0.0"],
    ["--version", "1.01.0"],
    ["--version", "1.0.0-beta.1"],
    ["--version", "0.1.9"],
    ["--version", "0.1.8"],
    ["--version", "0.0.99"],
    ["--bump", "minor", "--keep-version"],
    ["--keep-version", "--version=1.0.0"],
    ["--typo"]
  ]) {
    await assert.rejects(f.build(args, async () => assert.fail("must not package invalid options")));
    assert.equal((await f.read()).version, "0.1.9");
    assert.deepEqual(await readdir(f.desktopRoot), ["package.json"]);
  }
  const invalid = await fixture(t, "01.0.0");
  await assert.rejects(
    invalid.build([], async () => assert.fail("invalid base version")),
    /Desktop package version/
  );
});

test("release builds use DESKTOP_VERSION exactly and never rewrite the tracked product version", async (t) => {
  const f = await fixture(t);
  const env = { DESKTOP_RELEASE: "1", DESKTOP_VERSION: " 2.3.4 " };
  await f.build([], async (version) => assert.equal(version, "2.3.4"), env);
  assert.equal((await f.read()).version, "0.1.9");
  await assert.rejects(
    f.build(["--bump", "minor"], async () => assert.fail("release must stay pinned"), env),
    /fixed/
  );
  await assert.rejects(
    f.build([], async () => assert.fail("missing release version"), { DESKTOP_RELEASE: "1" }),
    /DESKTOP_VERSION/
  );
});

test("simultaneous package operations fail before touching another build's output", async (t) => {
  const f = await fixture(t);
  await f.build([], async () => {
    await assert.rejects(
      f.build([], async () => assert.fail("second build must not run")),
      /Another desktop package operation/
    );
    assert.equal((await f.read()).version, "0.1.9");
    const lock = JSON.parse(await readFile(path.join(f.desktopRoot, ".desktop-package.lock"), "utf8"));
    assert.equal(lock.pid, process.pid);
  });
  assert.equal((await f.read()).version, "0.1.10");
});

test("version persistence preserves unrelated edits and refuses to overwrite a manually changed version", async (t) => {
  const f = await fixture(t);
  await f.build([], async () => {
    await writeFile(f.manifestPath, JSON.stringify({ ...(await f.read()), description: "concurrent edit" }));
  });
  assert.equal((await f.read()).description, "concurrent edit");
  await assert.rejects(
    f.build([], async () => {
      await writeFile(f.manifestPath, JSON.stringify({ ...(await f.read()), version: "2.0.0" }));
    }),
    /changed during packaging/
  );
  assert.equal((await f.read()).version, "2.0.0");
  assert.deepEqual(await readdir(f.desktopRoot), ["package.json"]);
});

async function packagingFixture(t) {
  const f = await fixture(t);
  const write = async (relative, content = "test fixture, not an executable") => {
    const filename = path.join(f.desktopRoot, relative);
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, content);
  };
  for (const directory of ["backend", "frontend", "scripts", "tooling"]) {
    await mkdir(path.join(f.desktopRoot, ".stage", directory), { recursive: true });
  }
  for (const name of ["electron", "electron-updater", "tslib"]) {
    await write(`node_modules/${name}/package.json`, JSON.stringify({ name, version: "44.4.3" }));
  }
  await write(".electron-cache/electron-v44.4.3-win32-x64.zip");
  await write("assets/ecommerce-toolbox.ico");
  await write("installer-custom.nsh", "  ; @@GENERATED_PROGRAM_FILE_REMOVALS@@");
  await write("electron-builder.json", JSON.stringify({ directories: {}, nsis: {} }));
  const packager = async (options) => {
    assert.equal(options.appVersion, options.buildVersion);
    assert.ok(options.ignore.some((rule) => rule.test("/.desktop-package.lock")));
    const buildPath = path.join(f.desktopRoot, "out", "EcommerceToolbox-win32-x64");
    await mkdir(buildPath, { recursive: true });
    await copyFile(f.manifestPath, path.join(buildPath, "package.json"));
    for (const hook of options.afterCopy) {
      await new Promise((resolve, reject) =>
        hook(buildPath, "44.4.3", "win32", "x64", (error) => (error ? reject(error) : resolve()))
      );
    }
    assert.equal(JSON.parse(await readFile(path.join(buildPath, "package.json"), "utf8")).version, options.appVersion);
    for (const relative of [
      "EcommerceToolbox.exe",
      "resources/backend/dist/desktop-entry.js",
      "resources/frontend/index.html",
      "resources/app.asar"
    ]) {
      await write(path.relative(f.desktopRoot, path.join(buildPath, relative)));
    }
    return [buildPath];
  };
  return { ...f, write, packager };
}

test("packager, embedded app metadata and installer share one version; installer failure does not persist it", async (t) => {
  for (const make of [false, true]) {
    await t.test(make ? "installer success/failure" : "application directory", async (t) => {
      const f = await packagingFixture(t);
      let failInstaller = make;
      const options = {
        packager: f.packager,
        desktopRoot: f.desktopRoot,
        targetPlatform: "win32",
        targetArch: "x64",
        args: make ? ["--make", "--bump", "minor"] : [],
        env: {},
        installerBuilder: async (_app, release, configPath) => {
          assert.equal(release.version, "0.2.0");
          assert.equal((await f.read()).version, "0.1.9");
          const config = JSON.parse(await readFile(configPath, "utf8"));
          assert.equal(config.nsis.include, "installer-custom.nsh");
          assert.equal(config.extraMetadata.version, release.version);
          assert.equal(config.buildVersion, release.version);
          if (failInstaller) throw new Error("fixture installer failure");
          await f.write("out/make/nsis/EcommerceToolboxSetup.exe");
          await f.write("out/make/nsis/EcommerceToolboxSetup.exe.blockmap");
        }
      };
      if (make) {
        await assert.rejects(run(options), /fixture installer failure/);
        assert.equal((await f.read()).version, "0.1.9");
        failInstaller = false;
      }
      await run(options);
      assert.equal((await f.read()).version, make ? "0.2.0" : "0.1.10");
    });
  }
});

test("signed-release installer configuration keeps its explicit version even when the source version differs", async (t) => {
  const f = await packagingFixture(t);
  await run({
    packager: f.packager,
    desktopRoot: f.desktopRoot,
    targetPlatform: "win32",
    targetArch: "x64",
    args: ["--make"],
    env: {
      DESKTOP_RELEASE: "1",
      DESKTOP_VERSION: "1.2.3",
      DESKTOP_UPDATE_FEED_URL: "https://updates.example.test/desktop",
      WINDOWS_CERTIFICATE_FILE: "unused-test-fixture.pfx",
      WINDOWS_CERTIFICATE_PASSWORD: "unused-test-fixture"
    },
    installerBuilder: async (_app, release, configPath) => {
      const config = JSON.parse(await readFile(configPath, "utf8"));
      assert.equal(config.extraMetadata.version, "1.2.3");
      assert.equal(config.buildVersion, "1.2.3");
      assert.equal(config.publish[0].url, release.updateFeed);
      await f.write("out/make/nsis/EcommerceToolboxSetup.exe");
      await f.write("out/make/nsis/EcommerceToolboxSetup.exe.blockmap");
      await f.write("out/make/nsis/latest.yml", "version: 1.2.3\n");
    }
  });
  assert.equal((await f.read()).version, "0.1.9");
});
