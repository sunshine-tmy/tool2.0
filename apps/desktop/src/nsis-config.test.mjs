import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const desktopRoot = fileURLToPath(new URL("..", import.meta.url));

test("NSIS installer is assisted and allows a user-selected install directory", async () => {
  const config = JSON.parse(await readFile(path.join(desktopRoot, "electron-builder.json"), "utf8"));

  expect(config.win.target).toEqual(["nsis"]);
  expect(config.nsis.oneClick).toBe(false);
  expect(config.nsis.allowToChangeInstallationDirectory).toBe(true);
  expect(config.nsis.perMachine).toBe(false);
});
