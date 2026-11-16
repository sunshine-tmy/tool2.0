import assert from "node:assert/strict";
import { it } from "node:test";
import { stripPnpmSeparator } from "./cli-arguments.mjs";

it("accepts direct node arguments and pnpm's forwarded separator", () => {
  assert.deepEqual(stripPnpmSeparator(["--stage", "stage"]), ["--stage", "stage"]);
  assert.deepEqual(stripPnpmSeparator(["--", "--stage", "stage"]), ["--stage", "stage"]);
});
