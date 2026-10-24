/** Relocation guards: synthetic DTOs and missing-argument CLI checks, never an online work or browser. */
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, it, vi } from "vitest";
import { DouyinRuntimeManager } from "../domains/content-archive/providers/douyin/douyin-runtime";
import { readDouyinApiResponse } from "../domains/content-archive/providers/douyin/douyin-source";
import { ComponentManagerError } from "../modules/components/component-manager";

function components() {
  return {
    list: vi.fn(async () => []),
    resolveInstalledAsset: vi
      .fn()
      .mockRejectedValue(new ComponentManagerError("COMPONENT_NOT_INSTALLED", "synthetic missing component"))
  };
}
const options = { platform: "win32" as const, arch: "x64", installationMode: "managed" as const };
const link = "https://www.douyin.com/video/7464977705159691570";

it("does not query assets or create a second queue on construction", async () => {
  const source = components();
  const runtime = new DouyinRuntimeManager(source, options);
  try {
    expect(runtime.isActive()).toBe(false);
    expect(source.list).not.toHaveBeenCalled();
    expect(source.resolveInstalledAsset).not.toHaveBeenCalled();
  } finally {
    await runtime.close();
  }
});

it("keeps the original abort reason and does not claim runtime ownership before asset checks", async () => {
  const source = components();
  const runtime = new DouyinRuntimeManager(source, options);
  const controller = new AbortController();
  const reason = new Error("synthetic cancellation");
  controller.abort(reason);
  try {
    await expect(runtime.extract(link, { signal: controller.signal })).rejects.toBe(reason);
    expect(runtime.isActive()).toBe(false);
    expect(source.list).not.toHaveBeenCalled();
    expect(source.resolveInstalledAsset).not.toHaveBeenCalled();
  } finally {
    await runtime.close();
  }
});

it("keeps permanent close and its promise local to one runtime instance", async () => {
  const source = components();
  const closed = new DouyinRuntimeManager(source, options);
  const other = new DouyinRuntimeManager(source, options);
  try {
    const closing = closed.close();
    expect(closed.close()).toBe(closing);
    await closing;
    await expect(closed.extract(link)).rejects.toMatchObject({ code: "DOUYIN_RUNTIME_STOPPED" });
    expect(source.list).not.toHaveBeenCalled();
    expect(source.resolveInstalledAsset).not.toHaveBeenCalled();
    expect(await other.status()).toMatchObject({ state: "not-installed", mode: "anonymous", available: false });
  } finally {
    await Promise.all([closed.close(), other.close()]);
  }
});

it("keeps returned missing-asset status detached and does not expose the underlying component message", async () => {
  const source = components();
  const runtime = new DouyinRuntimeManager(source, options);
  try {
    const status = await runtime.status();
    expect(status.errorCode).toBe("DOUYIN_COMPONENT_NOT_INSTALLED");
    expect(JSON.stringify(status)).not.toContain("synthetic missing component");
    status.message = "caller edit";
    status.available = true;
    const next = await runtime.status();
    expect(next.available).toBe(false);
    expect(next.message).not.toBe("caller edit");
  } finally {
    await runtime.close();
  }
});

it("keeps the Unicode title boundary, full text and candidate order without mutating source data", () => {
  const id = "7464977705159691570";
  const description = "😀".repeat(81) + " #完整原文";
  const input = {
    status_code: 0,
    aweme_detail: {
      aweme_id: id,
      desc: description,
      video: { play_addr: { url_list: ["https://cdn.test/one?token=public", "https://cdn.test/two"] } }
    }
  };
  const before = structuredClone(input);
  const result = readDouyinApiResponse(input, id);
  expect(result.title).toBe("😀".repeat(80));
  expect(result.description).toBe(description);
  expect(result.media[0].urls).toEqual(input.aweme_detail.video.play_addr.url_list);
  expect(result.media[0].urls).not.toBe(input.aweme_detail.video.play_addr.url_list);
  result.media[0].urls.push("https://cdn.test/caller-edit");
  expect(input).toEqual(before);
});

it("keeps normalized metadata independent across repeated reads of the same provider response", () => {
  const id = "7464977705159691570";
  const input = {
    status_code: 0,
    aweme_detail: {
      aweme_id: id,
      desc: "original",
      author: { uid: "synthetic-author", nickname: "作者" },
      text_extra: [{ hashtag_name: "话题" }],
      images: [{ url_list: ["https://cdn.test/image.png"] }]
    }
  };
  const result = readDouyinApiResponse(input, id);
  result.tags.push("caller edit");
  result.author.name = "caller edit";
  result.media[0].index = 100;
  expect(readDouyinApiResponse(input, id)).toMatchObject({
    platform: "douyin",
    canonicalUrl: `https://www.douyin.com/note/${id}`,
    tags: ["话题"],
    author: { name: "作者" },
    media: [{ index: 0 }]
  });
});

it.each([
  { label: "no options", args: [] },
  { label: "URL only", args: ["--url", link] }
])(
  "keeps probe:douyin reachable from another cwd and rejects $label before opening a browser",
  async ({ args }) => {
    const packageFile = new URL("../../package.json", import.meta.url);
    const manifest = JSON.parse(await fs.readFile(packageFile, "utf8")) as { scripts: Record<string, string> };
    const command = manifest.scripts["probe:douyin"];
    expect(command).toMatch(/^tsx src\/[\w/-]+\.ts$/);
    const entry = path.resolve(path.dirname(fileURLToPath(packageFile)), command.slice("tsx ".length));
    expect((await fs.stat(entry)).isFile()).toBe(true);
    const requireApi = createRequire(packageFile);
    await expect(
      promisify(execFile)(
        process.execPath,
        [
          requireApi.resolve("tsx/cli"),
          "--tsconfig",
          fileURLToPath(new URL("../../tsconfig.json", import.meta.url)),
          entry,
          ...args
        ],
        {
          cwd: os.tmpdir(),
          timeout: 15_000,
          windowsHide: true,
          env: { ...process.env, NODE_ENV: "test" }
        }
      )
    ).rejects.toMatchObject({ code: 1, stdout: "", stderr: expect.stringContaining("请显式提供") });
  },
  20_000
);
