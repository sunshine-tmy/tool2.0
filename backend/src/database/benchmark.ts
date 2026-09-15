import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { ToolboxDatabase } from "./toolbox-database";

const RECORD_COUNT = 10_000;
const P95_BUDGET_MS = 100;
const temporaryRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "toolbox-db-benchmark-"));
const database = new ToolboxDatabase(path.join(temporaryRoot, "benchmark.db"));

try {
  const createdAt = new Date().toISOString();
  database.transaction(() => {
    for (let index = 0; index < RECORD_COUNT; index += 1) {
      database.upsert({
        id: `benchmark-${index.toString().padStart(5, "0")}`,
        kind: "task",
        status: "completed",
        payload: {
          id: `benchmark-${index.toString().padStart(5, "0")}`,
          toolId: "benchmark",
          status: "completed",
          progress: 100,
          createdAt,
          updatedAt: createdAt
        },
        createdAt,
        updatedAt: createdAt
      });
    }
  });

  database.list("task");
  const listSamples = sample(25, () => database.list("task"));
  const detailSamples = sample(250, (index) =>
    database.get("task", `benchmark-${(index * 37).toString().padStart(5, "0")}`)
  );
  const result = {
    records: RECORD_COUNT,
    listP95Ms: percentile(listSamples, 0.95),
    detailP95Ms: percentile(detailSamples, 0.95),
    budgetMs: P95_BUDGET_MS
  };
  console.log(JSON.stringify(result, null, 2));
  if (result.listP95Ms >= P95_BUDGET_MS || result.detailP95Ms >= P95_BUDGET_MS) process.exitCode = 1;
} finally {
  database.close();
  await fsp.rm(temporaryRoot, { recursive: true, force: true });
}

function sample(count: number, operation: (index: number) => unknown) {
  const values: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const startedAt = performance.now();
    operation(index);
    values.push(performance.now() - startedAt);
  }
  return values;
}

function percentile(values: number[], quantile: number) {
  const sorted = [...values].sort((left, right) => left - right);
  return Number(sorted[Math.ceil(sorted.length * quantile) - 1].toFixed(2));
}
