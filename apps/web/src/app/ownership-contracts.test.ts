// @vitest-environment happy-dom
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { audioLibraryPlayer as internalPlayer } from "../features/audio-library/player";
import { audioLibraryPlayer, AudioLibraryPlayback } from "../features/audio-library/integrations/playback";
import Playback from "../features/audio-library/AudioLibraryPlayback.vue";
import { SaveToAudioLibrary } from "../features/audio-library/integrations/speech";
import SaveAction from "../features/audio-library/SaveToAudioLibrary.vue";
import { router } from "./router";
afterAll(() => router.options.history.destroy());
describe("R08 application ownership contracts", () => {
  it("exposes the existing singleton and explicit save component without parallel instances", () => {
    expect(audioLibraryPlayer).toBe(internalPlayer);
    expect(AudioLibraryPlayback).toBe(Playback);
    expect(SaveToAudioLibrary).toBe(SaveAction);
    const source = readFileSync(resolve("src/app/App.vue"), "utf8");
    expect(source.match(/<AudioLibraryPlayback\s*\/>/g)).toHaveLength(1);
    expect(source.indexOf("<AudioLibraryPlayback")).toBeLessThan(source.indexOf("<router-view"));
    expect(source.indexOf("<DiagnosticPlaybackGuard")).toBeLessThan(source.indexOf("<router-view"));
  });
  it("keeps every page URL/name and legacy archive query/hash forwarding", () => {
    expect(
      router
        .getRoutes()
        .map((route) => [route.path, route.name])
        .sort()
    ).toEqual(
      [
        ["/", "home"],
        ["/settings", "desktop-settings"],
        ["/settings/diagnostics", "diagnostics"],
        ["/tools/audio-library", "audio-library"],
        ["/tools/edge-tts", "edge-tts"],
        ["/tools/image-ai", "image-ai"],
        ["/tools/image-compress", "image-compress"],
        ["/tools/lan-transfer", "lan-transfer"],
        ["/tools/media-archive", "xhs-archive"],
        ["/tools/xhs-archive", undefined]
      ].sort()
    );
    const redirect = router.getRoutes().find((route) => route.path === "/tools/xhs-archive")!.redirect;
    expect(typeof redirect).toBe("function");
    const query = { item: "retained", q: ["a", "b"] };
    expect(Reflect.apply(redirect as (...args: unknown[]) => unknown, undefined, [{ query, hash: "#media" }])).toEqual({
      path: "/tools/media-archive",
      query,
      hash: "#media"
    });
  });
  it("places feature entries under one source tree while leaving global CSS layering untouched", () => {
    for (const file of [
      "image-compress/page.vue",
      "image-ai/page.vue",
      "speech/page.vue",
      "audio-library/page.vue",
      "content-archive/page.vue",
      "lan-transfer/page.vue",
      "desktop-settings/DesktopSettingsPage.vue",
      "diagnostics/DiagnosticsPage.vue"
    ])
      expect(existsSync(resolve("src/features", file))).toBe(true);
    const styles = readFileSync(resolve("src/styles/index.css"), "utf8");
    expect(styles).toContain("@layer");
    expect(styles).toContain("global.css");
    expect(styles).toContain("redesign.css");
  });
});
