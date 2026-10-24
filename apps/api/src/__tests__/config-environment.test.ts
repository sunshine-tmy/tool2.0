import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { getConfig } from "../config";
import { createRuntimeLayout } from "../runtime/runtime-layout";

it("preserves API dotenv parsing and process/empty override semantics after sharing primitives", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-api-env-"));
  try {
    await fs.writeFile(
      path.join(root, ".env"),
      "# comment\r\nAPI_PORT=3200\r\nAPI_PORT=' 3201 '\nSTORAGE_ROOT=\"商品 数据\"\n"
    );
    const layout = createRuntimeLayout({ appRoot: root });
    const config = getConfig({ layout, environment: { NODE_ENV: "test" } });
    expect(config.port).toBe(3201);
    expect(config.storageRoot).toBe(path.join(root, "商品 数据"));
    for (const [API_PORT, port] of [
      ["3202", 3202],
      ["", 3100],
      [" ", 3100]
    ] as const)
      expect(getConfig({ layout, environment: { NODE_ENV: "test", API_PORT } }).port).toBe(port);
    expect(() => getConfig({ layout, environment: { API_PORT: "65536" } })).toThrow(
      "API_PORT must be an integer between 1 and 65535"
    );
    expect(() => getConfig({ layout, environment: { DEPLOYMENT_MODE: "lan", ADMIN_PIN: "" } })).toThrow(
      "ADMIN_PIN is required"
    );
  } finally {
    expect(path.dirname(root)).toBe(path.resolve(os.tmpdir()));
    expect(path.basename(root)).toMatch(/^toolbox-api-env-/);
    await fs.rm(root, { recursive: true, force: true });
  }
});
