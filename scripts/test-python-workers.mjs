import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { runWorkerSuite } from "../tooling/testing/python-workers.mjs";

const { values } = parseArgs({
  options: {
    python: { type: "string" },
    suite: { type: "string" },
    vendor: { type: "string" },
    help: { type: "boolean", short: "h" }
  }
});
if (values.help)
  console.log(
    "pnpm test:python:workers --python <absolute Python 3.12 path> --suite image|chatterbox [--vendor <existing Chatterbox vendor directory>]\nUses existing dependencies only, isolated synthetic storage, no model downloads or external network connections."
  );
else {
  try {
    if (!values.python || !values.suite) throw new Error("Both --python and --suite are required; use --help");
    runWorkerSuite({
      repoRoot: fileURLToPath(new URL("../", import.meta.url)),
      python: values.python,
      suite: values.suite,
      vendor: values.vendor
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
