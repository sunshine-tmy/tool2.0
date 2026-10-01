/** 在线验收 CLI 的离线回归：网络与浏览器隔离模拟，真实文件仅写入本次 .package 测试目录。 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  values: { url: "", browser: "", output: "", profile: undefined as string | undefined, headed: false },
  detail: {} as Record<string, unknown>,
  image: Buffer.alloc(0),
  api: undefined as { host: string; status: number; id?: string; body: Buffer } | undefined,
  emptySsr: false,
  statuses: [] as number[],
  requests: [] as { url: string; headers?: HeadersInit }[],
  decodeFailures: 0,
  repeatMismatch: false,
  navigations: 0,
  close: vi.fn(),
  previewClose: vi.fn()
}));
vi.mock("node:util", async (original) => ({
  ...(await original<typeof import("node:util")>()),
  parseArgs: () => ({ values: state.values })
}));
vi.mock("../modules/media-archive/browser-network", () => ({
  createBrowserNetwork: async () => ({
    proxy: { server: "http://127.0.0.1:1", username: "test", password: "secret" },
    args: ["--disable-quic"],
    status: () => ({ established: 1, rejected: 0, failed: 0, active: 0 }),
    close: async () => undefined
  })
}));
vi.mock("../security/remote-fetch", async (original) => ({
  ...(await original<typeof import("../security/remote-fetch")>()),
  createRemoteFetch: () => async (url: string, options: RequestInit) => {
    state.requests.push({ url, headers: options.headers });
    const status = state.statuses.shift() ?? 200;
    return new Response(new Uint8Array(state.image), { status });
  }
}));
vi.mock("playwright-core", () => ({
  chromium: {
    launch: async () => ({
      version: () => "153.0.8010.12",
      close: state.close,
      newContext: async () => {
        let pages = 0;
        let responseListener:
          | ((response: {
              url: () => string;
              status: () => number;
              headers: () => Record<string, string>;
              body: () => Promise<Buffer>;
            }) => void)
          | undefined;
        return {
          on: vi.fn(),
          newPage: async () =>
            ++pages === 1
              ? {
                  on: (_event: string, listener: typeof responseListener) => {
                    responseListener = listener;
                  },
                  off: vi.fn(),
                  goto: async () => {
                    state.navigations++;
                    if (state.api) {
                      const api = state.api;
                      responseListener?.({
                        url: () =>
                          `https://${api.host}/aweme/v1/web/aweme/detail/${api.id ? `?aweme_id=${api.id}` : ""}`,
                        status: () => api.status,
                        headers: () => ({}),
                        body: async () => api.body
                      });
                      await Promise.resolve();
                    }
                  },
                  url: () => "https://www.douyin.com/video/7464977705159691570",
                  content: async () => {
                    if (state.emptySsr) return "<html></html>";
                    const detail =
                      state.repeatMismatch && state.navigations > 1
                        ? { ...state.detail, images: [{ urlList: ["https://media.example.com/repeat.png"] }] }
                        : state.detail;
                    return `<script>self.__pace_f.push(${JSON.stringify([1, "7:" + JSON.stringify(detail)])})</script>`;
                  }
                }
              : {
                  goto: vi.fn(),
                  waitForFunction: async () => {
                    if (state.decodeFailures-- > 0) throw new Error("模拟解码失败");
                  },
                  evaluate: async () => ({ width: 720, height: 1280, duration: 15, playable: true }),
                  close: state.previewClose
                }
        };
      }
    })
  }
}));

const root = fileURLToPath(new URL("../../../", import.meta.url));
let directory: string;
let previousExitCode: typeof process.exitCode;
beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  const base = path.join(root, ".package", "ma01-probe-tests");
  await fs.mkdir(base, { recursive: true });
  directory = await fs.mkdtemp(path.join(base, "case-"));
  state.values = {
    url: "https://v.douyin.com/D_DcsZsE5O8/",
    browser: "test-browser.exe",
    output: path.join(directory, "output"),
    profile: undefined,
    headed: false
  };
  state.detail = {
    awemeId: "7464977705159691570",
    desc: "测试作品",
    video: { playAddr: ["https://media.example.com/one.mp4", "https://media.example.com/two.mp4"] }
  };
  state.image = await sharp({ create: { width: 2, height: 3, channels: 3, background: "#123456" } })
    .png()
    .toBuffer();
  state.statuses = [];
  state.api = undefined;
  state.emptySsr = false;
  state.requests = [];
  state.decodeFailures = 0;
  state.repeatMismatch = false;
  state.navigations = 0;
  previousExitCode = process.exitCode;
  process.exitCode = undefined;
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});
afterEach(async () => {
  process.exitCode = previousExitCode;
  vi.restoreAllMocks();
  // 只清理 mkdtemp 为当前场景创建的目录，绝不扫描或清理用户归档。
  if (!directory.startsWith(path.join(root, ".package", "ma01-probe-tests", "case-")))
    throw new Error("测试清理路径越界");
  await fs.rm(directory, { recursive: true, force: true });
});
async function run() {
  await import("../modules/media-archive/douyin-probe");
  return JSON.parse(await fs.readFile(path.join(state.values.output, "result.json"), "utf8"));
}

describe("抖音在线验收工具安全与失败回退", () => {
  it("Profile 名称不能变成任意用户目录，校验失败不创建输出", async () => {
    state.values.profile = "../../xhs-archive";
    await expect(run()).rejects.toThrow("Profile 名称");
    expect(await fs.readdir(directory)).toEqual([]);
    expect(state.close).not.toHaveBeenCalled();
  });
  it("普通视频 SSR 为空时消费正常浏览器的作品 API，而非推荐数据", async () => {
    state.emptySsr = true;
    state.api = {
      host: "www.douyin.com",
      status: 200,
      id: "7464977705159691570",
      body: Buffer.from(
        JSON.stringify({
          status_code: 0,
          aweme_detail: {
            aweme_id: "7464977705159691570",
            video: { play_addr: { url_list: ["https://media.example.com/video.mp4"] } }
          }
        })
      )
    };
    expect(await run()).toMatchObject({ status: "PASSED", source: "normal-browser-api", longLinkMatches: true });
  });

  it.each([
    { host: "evil.example.com", status: 200, id: "7464977705159691570", body: Buffer.from("{}") },
    { host: "www.douyin.com", status: 403, id: "7464977705159691570", body: Buffer.from("{}") },
    { host: "www.douyin.com", status: 429, id: "7464977705159691570", body: Buffer.from("{}") },
    { host: "www.douyin.com", status: 200, body: Buffer.from("{}") },
    { host: "www.douyin.com", status: 200, id: "7464977705159691570", body: Buffer.from("not-json") },
    { host: "www.douyin.com", status: 200, id: "7464977705159691570", body: Buffer.alloc(4 * 1024 * 1024 + 1) }
  ])("忽略来源不符、异常或过大的 API，不替代合法 SSR：%o", async (api) => {
    state.api = api;
    expect(await run()).toMatchObject({ status: "PASSED", source: "normal-browser-ssr" });
  });

  it("完整视频下载、摘要和播放验收后才标记通过，并关闭浏览器", async () => {
    const report = await run();
    expect(report).toMatchObject({ status: "PASSED", longLinkMatches: true, browserVersion: "153.0.8010.12" });
    expect(report.media).toHaveLength(1);
    expect(report.media[0]).toMatchObject({ filename: "01-video.mp4", playable: true, bytes: state.image.length });
    expect(report.media[0].sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(state.close).toHaveBeenCalledOnce();
    expect(state.previewClose).toHaveBeenCalledOnce();
    expect(state.requests[0].headers).toEqual({ Referer: "https://www.douyin.com/" });
    const player = await fs.readFile(path.join(state.values.output, "playback.html"), "utf8");
    expect(player).toContain('src="./01-video.mp4"');
    expect(player).not.toContain(".partial");
  });

  it("真实图片格式决定文件后缀，不能把 PNG 错存为 WebP", async () => {
    state.detail.images = [{ urlList: ["https://media.example.com/image"] }];
    const report = await run();
    expect(report.media[0]).toMatchObject({ filename: "01-image.png", format: "png", width: 2, height: 3 });
    expect(await fs.readFile(path.join(state.values.output, "01-image.png"))).toEqual(state.image);
  });

  it("首个 CDN 状态异常时回退，不记录带令牌的完整地址", async () => {
    state.statuses = [403, 200];
    const report = await run();
    expect(report.status).toBe("PASSED");
    expect(state.requests).toHaveLength(2);
    expect(report.failures).toEqual([{ position: 0, host: "media.example.com", status: 403 }]);
  });

  it("视频解码失败时清理暂存再回退，不遗留目标文件或重复计数", async () => {
    state.decodeFailures = 1;
    const report = await run();
    expect(report.status).toBe("PASSED");
    expect(report.media).toHaveLength(1);
    expect(state.requests).toHaveLength(2);
    expect((await fs.readdir(state.values.output)).some((name) => name.includes(".partial"))).toBe(false);
    expect(state.previewClose).toHaveBeenCalledTimes(2);
  });

  it("所有媒体失败必须失败，保留脱敏证据，不伪造完成项", async () => {
    state.statuses = [404, 403];
    const report = await run();
    expect(report).toMatchObject({ status: "FAILED", errorCode: "DOUYIN_MEDIA_INCOMPLETE", media: [] });
    expect(process.exitCode).toBe(1);
    expect(state.close).toHaveBeenCalledOnce();
  });

  it("无效图片不会提交，即使上游返回 HTTP 200", async () => {
    state.detail.images = [{ urlList: ["https://media.example.com/error"] }];
    state.image = Buffer.from("not an image");
    expect(await run()).toMatchObject({ status: "FAILED", errorCode: "DOUYIN_MEDIA_INCOMPLETE" });
    expect(await fs.readdir(state.values.output)).toEqual(["result.json", "source.json"]);
  });

  it("长短链媒体顺序不一致时不能宣布验收通过", async () => {
    state.repeatMismatch = true;
    expect(await run()).toMatchObject({ status: "FAILED", longLinkMatches: false, errorCode: "DOUYIN_PARSE_FAILED" });
  });

  it("明确登录门禁保留错误分类，不下载媒体", async () => {
    state.detail.pcNeedLogin = true;
    expect(await run()).toMatchObject({ status: "FAILED", errorCode: "DOUYIN_AUTH_REQUIRED" });
    expect(state.requests).toHaveLength(0);
  });

  it("拒绝输出根目录、越界目录和已存在目录", async () => {
    state.values.output = path.join(root, ".package");
    await expect(run()).rejects.toThrow("新子目录");
    vi.resetModules();
    state.values.output = directory;
    await expect(run()).rejects.toThrow("EEXIST");
    vi.resetModules();
    state.values.output = path.join(root, "storage");
    await expect(run()).rejects.toThrow("新子目录");
  });

  it("拒绝非抖音链接或缺失浏览器参数，不启动浏览器", async () => {
    state.values.url = "https://evil.example.com/video/12345";
    await expect(run()).rejects.toThrow("显式提供");
    vi.resetModules();
    state.values.url = "https://v.douyin.com/D_DcsZsE5O8/";
    state.values.browser = "";
    await expect(run()).rejects.toThrow("显式提供");
    expect(state.close).not.toHaveBeenCalled();
  });
});
