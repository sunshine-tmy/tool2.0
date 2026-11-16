#!/usr/bin/env node
import { parseMacosRuntimeArgs, runMacosRuntime } from "../tooling/testing/macos-runtime.mjs";
import { fileURLToPath } from "node:url";

const abortController = new AbortController();
const abort = () => abortController.abort();
process.once("SIGINT", abort);
process.once("SIGTERM", abort);

try {
  const options = parseMacosRuntimeArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${options.helpText}\n`);
  } else {
    const result = await runMacosRuntime(options, {
      repoRoot: fileURLToPath(new URL("../", import.meta.url)),
      signal: abortController.signal
    });
    process.stdout.write(
      `${result.report.status}: ${result.report.error?.message ?? "runtime validation completed"}\n` +
        `modelValidation: ${result.report.modelValidation}\n` +
        `report: ${result.report.paths.output}/report.json\n`
    );
    process.exitCode = result.exitCode;
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 2;
} finally {
  process.removeListener("SIGINT", abort);
  process.removeListener("SIGTERM", abort);
}
