import assert from "node:assert/strict";
import test from "node:test";
import {
  ensureStrictCodeSignature,
  reSignAndVerifyMacOSAppBundle,
  verifyStrictCodeSignature
} from "./macos-code-signing.mjs";

test("ad-hoc signs an invalid Mach-O and verifies the resulting signature", () => {
  let signed = false;
  const calls = [];
  const run = (command, args) => {
    calls.push({ command, args });
    if (args[0] === "--verify") {
      if (!signed) {
        const error = new Error("unsigned fixture");
        error.status = 1;
        throw error;
      }
      return Buffer.alloc(0);
    }
    signed = true;
    return Buffer.alloc(0);
  };

  assert.deepEqual(ensureStrictCodeSignature("/tmp/fixture.dylib", { run }), { status: "ad-hoc" });
  assert.equal(calls.filter(({ args }) => args[0] === "--verify").length, 2);
  assert.deepEqual(calls[1].args, ["--force", "--sign", "-", "--timestamp=none", "/tmp/fixture.dylib"]);
});

test("preserves a valid existing Mach-O signature", () => {
  const calls = [];
  const result = ensureStrictCodeSignature("/tmp/fixture.dylib", {
    run: (command, args) => calls.push({ command, args })
  });

  assert.deepEqual(result, { status: "verified-existing" });
  assert.equal(calls.length, 1);
});

test("reports invalid final bundle signatures without changing the bundle", () => {
  const result = verifyStrictCodeSignature("/tmp/Chromium.app", {
    deep: true,
    run: () => {
      const error = new Error("invalid fixture");
      error.status = 1;
      throw error;
    }
  });

  assert.equal(result, false);
});

test("re-signs a final Chromium app bundle and verifies all nested code", () => {
  const calls = [];
  const bundle = "/tmp/Chromium.app";
  reSignAndVerifyMacOSAppBundle(bundle, {
    run: (command, args) => {
      calls.push({ command, args });
      return Buffer.alloc(0);
    }
  });

  assert.deepEqual(calls[0].args, ["-cr", bundle]);
  assert.deepEqual(calls[1].args, ["-lr", bundle]);
  assert.deepEqual(calls[2].args, ["--force", "--deep", "--sign", "-", "--timestamp=none", bundle]);
  assert.deepEqual(calls[3].args, ["--verify", "--deep", "--strict", bundle]);
});

test("removes Finder and resource-fork attributes before signing the final app", () => {
  const calls = [];
  let attributeReads = 0;
  const bundle = "/tmp/Chromium.app";
  reSignAndVerifyMacOSAppBundle(bundle, {
    run: (command, args) => {
      calls.push({ command, args });
      if (args[0] === "-lr") {
        attributeReads += 1;
        return attributeReads === 1 ? `${bundle}: com.apple.FinderInfo: \n` : "";
      }
      return Buffer.alloc(0);
    }
  });

  assert.deepEqual(calls[0].args, ["-cr", bundle]);
  assert.deepEqual(calls[2].args, ["-d", "com.apple.FinderInfo", bundle]);
  assert.deepEqual(calls[4].args, ["--force", "--deep", "--sign", "-", "--timestamp=none", bundle]);
  assert.deepEqual(calls[5].args, ["--verify", "--deep", "--strict", bundle]);
});

test("surfaces the scoped Chromium framework link blocker instead of relaxing archive rules", () => {
  assert.throws(
    () =>
      reSignAndVerifyMacOSAppBundle("/tmp/Chromium.app", {
        run: (command, args) => {
          if (args[0] === "--force") {
            const error = new Error("codesign failed");
            error.stderr = Buffer.from("bundle format is ambiguous (could be app or framework)");
            throw error;
          }
          return Buffer.alloc(0);
        }
      }),
    /固定相对链接.*不得放宽全局归档链接规则/u
  );
});
