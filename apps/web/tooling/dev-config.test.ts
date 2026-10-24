import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveApiProxyTarget } from "./dev-config";

async function fixture(run: (root: string) => Promise<void>) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-web-config-"));
  try {
    await run(root);
  } finally {
    expect(path.dirname(root)).toBe(path.resolve(os.tmpdir()));
    expect(path.basename(root)).toMatch(/^toolbox-web-config-/);
    await fs.rm(root, { recursive: true, force: true });
  }
}

describe("API proxy configuration", () => {
  it("defaults without an env file and never creates files", () =>
    fixture(async (root) => {
      expect(resolveApiProxyTarget(root, {}, {})).toBe("http://127.0.0.1:3100");
      expect(await fs.readdir(root)).toEqual([]);
    }));
  it("keeps process > repository .env > default, including empty process values", () =>
    fixture(async (root) => {
      await fs.writeFile(path.join(root, ".env"), "# ignored\r\nAPI_PORT=3200\r\nAPI_PORT=' 3201 '\n");
      await fs.writeFile(path.join(root, ".env.local"), "API_PORT=9999\n");
      expect(resolveApiProxyTarget(root, {}, {})).toBe("http://127.0.0.1:3201");
      expect(resolveApiProxyTarget(root, {}, { API_PORT: "3202" })).toBe("http://127.0.0.1:3202");
      expect(resolveApiProxyTarget(root, {}, { API_PORT: "" })).toBe("http://127.0.0.1:3100");
      expect(resolveApiProxyTarget(root, {}, { API_PORT: "   " })).toBe("http://127.0.0.1:3100");
    }));
  it("keeps an explicit proxy ahead of API parsing and rejects invalid fallback ports", () =>
    fixture(async (root) => {
      await fs.writeFile(path.join(root, ".env"), "API_PORT=invalid\n");
      expect(
        resolveApiProxyTarget(
          root,
          { VITE_API_PROXY_TARGET: " http://localhost:4321 " },
          { TOOLBOX_LEGACY_DATA_ROOT: "relative" }
        )
      ).toBe("http://localhost:4321");
      expect(() => resolveApiProxyTarget(root, {}, {})).toThrow("API_PORT must be an integer between 1 and 65535");
      expect(() => resolveApiProxyTarget(root, { VITE_API_PROXY_TARGET: " " }, { API_PORT: "65536" })).toThrow(
        "API_PORT must be an integer between 1 and 65535"
      );
    }));
  it("reads an explicitly selected legacy config directory without changing the Vite root", () =>
    fixture(async (root) => {
      const selected = path.join(root, "旧 配置 空间");
      await fs.mkdir(selected);
      await fs.writeFile(path.join(selected, ".env"), 'API_PORT="4322"\n');
      await fs.writeFile(path.join(root, ".env"), "API_PORT=4323\n");
      expect(resolveApiProxyTarget(root, {}, { TOOLBOX_LEGACY_DATA_ROOT: selected })).toBe("http://127.0.0.1:4322");
      expect(() => resolveApiProxyTarget(root, {}, { TOOLBOX_LEGACY_DATA_ROOT: "relative" })).toThrow(
        "absolute existing directory"
      );
      expect(() => resolveApiProxyTarget(root, {}, { TOOLBOX_LEGACY_DATA_ROOT: path.join(root, "missing") })).toThrow();
      expect(() => resolveApiProxyTarget(root, {}, { TOOLBOX_LEGACY_DATA_ROOT: path.join(root, ".env") })).toThrow(
        "existing directory"
      );
    }));
});
