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
    // Requested TikTok and audio-edit routes are additive; the 273 historical routes remain frozen.
    expect(routeInventory(app.printRoutes({ commonPrefix: false }))).toEqual(
      [
        ...snapshot,
        "GET /api/v1/tools/media-archive/runtime/tiktok",
        "HEAD /api/v1/tools/media-archive/runtime/tiktok",
        ...[
          "GET import/template.csv",
          "HEAD import/template.csv",
          "POST import/preview",
          "GET import/batches",
          "HEAD import/batches",
          "POST import/batches",
          "GET import/batches/:id",
          "HEAD import/batches/:id",
          "DELETE import/batches/:id",
          "POST import/batches/:id/cancel",
          "POST import/batches/:id/retry",
          "GET import/batches/:id/results.csv",
          "HEAD import/batches/:id/results.csv",
          "GET groups",
          "HEAD groups",
          "POST groups",
          "PATCH groups/:id",
          "DELETE groups/:id",
          "POST groups/assign",
          "GET tiktok-profiles",
          "HEAD tiktok-profiles",
          "POST tiktok-profiles",
          "GET tiktok-profiles/:id",
          "HEAD tiktok-profiles/:id",
          "DELETE tiktok-profiles/:id",
          "GET tiktok-profiles/:id/works",
          "HEAD tiktok-profiles/:id/works",
          "POST tiktok-profiles/:id/archive",
          "POST tiktok-profiles/:id/discover",
          "POST tiktok-profiles/:id/cancel",
          "POST tiktok-profiles/:id/retry",
          "GET tiktok-profiles/:id/results.csv",
          "HEAD tiktok-profiles/:id/results.csv",
          "GET video-edit-runtime",
          "PATCH items/:id/publication",
          "HEAD video-edit-runtime",
          "GET items/:id/media/:mediaId/audio-edits",
          "HEAD items/:id/media/:mediaId/audio-edits",
          "POST items/:id/media/:mediaId/audio-edits",
          "GET video-edits/:taskId",
          "HEAD video-edits/:taskId",
          "DELETE video-edits/:taskId",
          "GET video-edits/:taskId/preview",
          "HEAD video-edits/:taskId/preview",
          "GET items/:id/media/:mediaId/original",
          "HEAD items/:id/media/:mediaId/original",
          "GET items/:id/media/:mediaId/saved-music",
          "HEAD items/:id/media/:mediaId/saved-music"
        ].map((entry) => {
          const [method, path] = entry.split(" ");
          return `${method} /api/v1/tools/media-archive/${path}`;
        })
      ].sort()
    );
    expect((await app.inject({ method: "GET", url: "/health/live" })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/health/ready" })).statusCode).toBe(200);
  } finally {
    await app?.close();
    expect(path.dirname(root)).toBe(path.resolve(os.tmpdir()));
    expect(path.basename(root)).toMatch(/^toolbox-refactor-contracts-/);
    await fs.rm(root, { recursive: true, force: true });
  }
});
