import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { generateSamples, parseArguments } from "./generate-macos-validation-samples.mjs";

const roots = new Set();
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), "macos-chatterbox-samples-"));
  roots.add(root);
  const assets = path.join(root, "assets");
  mkdirSync(path.join(assets, ".incoming"), { recursive: true });
  return { root, assets };
}

test("help and absolute assets directory are required", () => {
  assert.equal(parseArguments(["--help"]).help, true);
  assert.throws(() => parseArguments([]), /--assets-dir is required/);
  assert.throws(() => parseArguments(["--assets-dir", "relative"]), /absolute path/);
});

test("writes native say voice references and converts them to PCM WAV", async () => {
  const paths = fixture();
  const commands = [];
  const result = await generateSamples({
    assetsDirectory: paths.assets,
    runCommand(command, args) {
      commands.push({ command, args });
      if (command === "say") writeFileSync(args[args.indexOf("-o") + 1], "AIFF reference");
      else writeFileSync(args.at(-1), "RIFF" + "x".repeat(50));
    }
  });
  assert.equal(result.samples.length, 3);
  assert.deepEqual(
    result.samples.map(({ name, voice, language }) => [name, voice, language]),
    [
      ["reference-ms.wav", "Amira", "ms_MY"],
      ["reference-en.wav", "Samantha", "en_US"],
      ["reference-pt-BR.wav", "Luciana", "pt_BR"]
    ]
  );
  assert.equal(commands.length, 6);
  assert.equal(commands[0].command, "say");
  assert.equal(commands[1].command, "afconvert");
  assert.deepEqual(commands[1].args.slice(0, 6), ["-f", "WAVE", "-d", "LEI16@24000", "-c", "1"]);
  assert.ok(readFileSync(path.join(paths.assets, "samples", "reference-ms.wav")).length > 44);
});

test("refuses to overwrite existing sample assets", async () => {
  const paths = fixture();
  mkdirSync(path.join(paths.assets, "samples"));
  writeFileSync(path.join(paths.assets, "samples", "keep.wav"), "keep");
  await assert.rejects(
    generateSamples({ assetsDirectory: paths.assets, runCommand: () => assert.fail("must not run say") }),
    /Refusing to overwrite existing sample directory/
  );
  assert.equal(readFileSync(path.join(paths.assets, "samples", "keep.wav"), "utf8"), "keep");
});
