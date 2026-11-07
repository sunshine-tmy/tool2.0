import path from "node:path";
import os from "node:os";
import { afterEach, expect, it, vi } from "vitest";
import { createSourceComponentManager } from "../runtime/source-component-manager";
import { createDesktopComponentSelfTest } from "../modules/components/desktop-component-self-test";
import { packagedComponentCatalog } from "../modules/components/catalog.generated";

vi.mock("../modules/components/desktop-component-self-test", () => ({
  createDesktopComponentSelfTest: vi.fn(() => vi.fn(async () => undefined))
}));
afterEach(() => vi.restoreAllMocks());

it("wires source self-tests to the same manager's verified FFmpeg and Python dependencies", async () => {
  const run = vi.fn(async () => "ok");
  const manager = createSourceComponentManager(
    { root: path.join(os.tmpdir(), "source-wiring-no-io"), catalog: { manifests: [], trustedPublicKeys: {} } },
    run
  );
  const call = vi.mocked(createDesktopComponentSelfTest).mock.calls.at(-1)!;
  expect(call[0]).toBe(run);
  const verified = {
    path: "verified/python.exe",
    generationRoot: "verified",
    manifest: packagedComponentCatalog.manifests[0]
  };
  const media = vi
    .spyOn(manager, "resolveInstalledAsset")
    .mockResolvedValue({ ...verified, path: "verified/ffmpeg.exe" });
  const python = vi.spyOn(manager, "resolveInstalledPython").mockResolvedValue(verified);
  expect(await call[1]!("bin/ffmpeg.exe")).toBe("verified/ffmpeg.exe");
  expect(media).toHaveBeenCalledWith("ffmpeg", "bin/ffmpeg.exe");
  expect(await call[2]!("video-ai")).toBe(verified);
  expect(python).toHaveBeenCalledWith("video-ai");
  python.mockRejectedValueOnce(new Error("dependency signature invalid"));
  await expect(call[2]!("video-ai")).rejects.toThrow("signature invalid");
});
