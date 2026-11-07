import { beforeEach, expect, it, vi } from "vitest";
import { getConfig } from "../config";
import { probeVideo } from "../domains/video-ai/media";
import { runMediaCommand } from "../core/media/process";
vi.mock("../core/media/process", () => ({ runMediaCommand: vi.fn() }));
const run = vi.mocked(runMediaCommand);
const metadata = {
  streams: [{ codec_type: "video", width: 1920, height: 1080, avg_frame_rate: "30000/1001", nb_frames: "300" }],
  format: { duration: "10.01" }
};
beforeEach(() => {
  vi.clearAllMocks();
  run.mockResolvedValue(JSON.stringify(metadata));
});
it("probes the verified executable without permitting network containers and preserves fractional durations", async () => {
  const config = getConfig({ environment: {} });
  config.videoAiFfprobePath = "C:/共享/ffprobe.exe";
  expect(await probeVideo(config, "C:/视频/input.bin", new AbortController().signal)).toEqual({
    width: 1920,
    height: 1080,
    fps: 30000 / 1001,
    audioStreams: 0,
    durationMs: 10010,
    frameCount: 300
  });
  expect(run.mock.calls[0][0]).toBe(config.videoAiFfprobePath);
  expect(run.mock.calls[0][1]).toEqual(
    expect.arrayContaining(["-protocol_whitelist", "file,pipe", "-format_whitelist", "C:/视频/input.bin"])
  );
});
it.each([
  "{}",
  "not json",
  JSON.stringify({ ...metadata, format: { duration: "21601" } }),
  JSON.stringify({ ...metadata, streams: [] }),
  JSON.stringify({ ...metadata, streams: [{ ...metadata.streams[0], width: 0 }] })
])("rejects malformed or out-of-budget metadata (%s)", async (raw) => {
  run.mockResolvedValue(raw);
  await expect(
    probeVideo(getConfig({ environment: {} }), "input.bin", new AbortController().signal)
  ).rejects.toMatchObject({ code: "INVALID_VIDEO", status: 422 });
});
it("does not treat attached cover art as the video track", async () => {
  run.mockResolvedValue(
    JSON.stringify({
      ...metadata,
      streams: [{ ...metadata.streams[0], width: 1, disposition: { attached_pic: 1 } }, metadata.streams[0]]
    })
  );
  expect((await probeVideo(getConfig({ environment: {} }), "input.bin", new AbortController().signal)).width).toBe(
    1920
  );
});
