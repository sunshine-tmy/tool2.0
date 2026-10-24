import { fileURLToPath } from "node:url";
import { runScriptTests } from "../tooling/testing/script-tests.mjs";

process.exitCode = runScriptTests(fileURLToPath(new URL("../", import.meta.url)), process.argv.slice(2));
