import { rm } from "node:fs/promises";

await Promise.all(
  ["backend/dist", "frontend/dist", "packages/shared/dist", "coverage"].map((path) =>
    rm(path, { recursive: true, force: true })
  )
);
