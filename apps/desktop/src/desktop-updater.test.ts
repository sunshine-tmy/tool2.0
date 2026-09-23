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
  it("accepts only electron-builder generic HTTPS feed origins without credentials or query fragments", async () => {
    const resourcesRoot = await writeUpdateConfig("provider: generic\nurl: https://updates.example.test/win32/x64/\n");
    expect(readDesktopUpdateFeed(resourcesRoot)).toBe("https://updates.example.test/win32/x64");
  });

  it.each([
    "http://updates.example.test/releases",
    "https://user:password@updates.example.test/releases",
    "https://updates.example.test/releases?channel=beta",
    "https://updates.example.test/releases#fragment"
  ])("rejects mutable or credential-bearing feed value %s", async (updateFeed) => {
    const resourcesRoot = await writeUpdateConfig(`provider: generic\nurl: ${updateFeed}\n`);
    expect(readDesktopUpdateFeed(resourcesRoot)).toBeUndefined();
  });

  it("requires electron-builder's generic provider declaration", async () => {
    const resourcesRoot = await writeUpdateConfig("provider: github\nurl: https://updates.example.test/releases\n");
    expect(readDesktopUpdateFeed(resourcesRoot)).toBeUndefined();
  });
});

async function writeUpdateConfig(contents: string) {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-desktop-updater-"));
  await fs.writeFile(path.join(root, "app-update.yml"), contents, "utf8");
  return root;
}
