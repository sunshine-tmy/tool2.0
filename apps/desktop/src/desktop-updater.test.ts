import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readDesktopUpdateFeed } from "./desktop-update-feed";

let root: string | undefined;

afterEach(async () => {
  if (root) await fs.rm(root, { recursive: true, force: true });
  root = undefined;
});

describe("desktop update feed", () => {
  it("accepts only build-embedded HTTPS feed origins without credentials or query fragments", async () => {
    const appRoot = await writePackage({ desktopUpdateFeed: "https://updates.example.test/win32/x64/" });
    expect(readDesktopUpdateFeed(appRoot)).toBe("https://updates.example.test/win32/x64");
  });

  it.each([
    "http://updates.example.test/releases",
    "https://user:password@updates.example.test/releases",
    "https://updates.example.test/releases?channel=beta",
    "https://updates.example.test/releases#fragment"
  ])("rejects mutable or credential-bearing feed value %s", async (desktopUpdateFeed) => {
    const appRoot = await writePackage({ desktopUpdateFeed });
    expect(readDesktopUpdateFeed(appRoot)).toBeUndefined();
  });
});

async function writePackage(value: unknown) {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-desktop-updater-"));
  await fs.writeFile(path.join(root, "package.json"), JSON.stringify(value), "utf8");
  return root;
}
