/** Public route inventory is frozen independently of source paths and registration order. */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { createApp } from "../app";
import { getConfig } from "../config";

function routeInventory(tree: string) {
  const parents: string[] = [];
  const routes: string[] = [];
  for (const line of tree.trim().split(/\r?\n/)) {
    const match = /^([│ ]*)[├└]── (.*?)(?: \(([^)]+)\))?$/.exec(line);
    if (!match) throw new Error(`Unrecognized Fastify route tree: ${line}`);
    const depth = match[1].length / 4;
    if (!Number.isInteger(depth)) throw new Error(`Unrecognized route indentation: ${line}`);
    parents.length = depth;
    const fullPath = parents.join("") + match[2];
    parents[depth] = match[2];
    if (fullPath.startsWith("/api/") || fullPath.startsWith("/health/")) {
      for (const method of match[3]?.split(", ") ?? []) routes.push(`${method} ${fullPath}`);
    }
  }
  return routes.sort();
}

it("normalizes nested methods and suffix routes without losing their parent paths", () => {
  expect(
    routeInventory(
      "├── /api/v1/items (POST, GET)\n│   └── /:id (DELETE)\n│       └── /subtitle (GET)\n│           └── .bilingual (GET)\n└── * (OPTIONS)"
    )
  ).toEqual([
    "DELETE /api/v1/items/:id",
    "GET /api/v1/items",
    "GET /api/v1/items/:id/subtitle",
    "GET /api/v1/items/:id/subtitle.bilingual",
    "POST /api/v1/items"
  ]);
  expect(() => routeInventory("Unexpected format")).toThrow("Unrecognized Fastify route tree");
});

it("keeps every API and health method/path while allowing internal source relocation", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-refactor-contracts-"));
  const config = getConfig({
    dotenvPath: false,
    environment: { STORAGE_ROOT: root, DATABASE_PATH: path.join(root, "toolbox.db") }
  });
  // Missing frontend assets make this independent of whether a developer has built the web app.
  config.runtime.frontendDistRoot = path.join(root, "missing-frontend");
  let app: Awaited<ReturnType<typeof createApp>> | undefined;
  try {
    const snapshot: string[] = JSON.parse(
      await fs.readFile(path.join(config.runtime.appRoot, "docs/refactoring/api-routes.json"), "utf8")
    );
    expect(snapshot).toHaveLength(273);
    app = await createApp({ config });
    expect(routeInventory(app.printRoutes({ commonPrefix: false }))).toEqual(snapshot);
    expect((await app.inject({ method: "GET", url: "/health/live" })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/health/ready" })).statusCode).toBe(200);
  } finally {
    await app?.close();
    expect(path.dirname(root)).toBe(path.resolve(os.tmpdir()));
    expect(path.basename(root)).toMatch(/^toolbox-refactor-contracts-/);
    await fs.rm(root, { recursive: true, force: true });
  }
});
