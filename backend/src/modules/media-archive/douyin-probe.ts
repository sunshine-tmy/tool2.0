/** MA01 在线验收工具：独立匿名浏览器、白名单作品 DTO、流式下载、SHA-256 与本地解码。 */
import fs from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { parseArgs } from "node:util";
import sharp from "sharp";
import { identifyArchiveLink } from "@toolbox/shared";
import { createRemoteFetch, assertRemoteResponseSize, limitedResponseStream } from "../../security/remote-fetch";
import { DouyinSourceError } from "./douyin-source";
import { openDouyinBrowser, DouyinBrowserError } from "./douyin-browser";
import { readDouyinWork } from "./douyin-reader";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const { values } = parseArgs({
  options: {
    url: { type: "string" },
    browser: { type: "string" },
    output: { type: "string" },
    profile: { type: "string" },
    headed: { type: "boolean", default: false }
  }
});
const link = identifyArchiveLink(values.url || "", "douyin");
if (!link.ok || !values.browser || !values.output)
  throw new Error("请显式提供 --url 抖音作品 --browser 浏览器可执行文件 --output .package 内的新目录");
if (values.profile && !/^[a-z0-9][a-z0-9-]{0,39}$/.test(values.profile))
  throw new Error("测试 Profile 名称只能包含小写字母、数字和连字符");
const output = path.resolve(values.output);
const base = path.join(root, ".package");
const relative = path.relative(base, output);
if (!relative || relative.startsWith("..") || path.isAbsolute(relative))
  throw new Error("验收输出必须是本项目 .package 内的新子目录");
await fs.mkdir(path.dirname(output), { recursive: true });
// 拒绝符号链接把输出导向用户 storage 或其他目录；既有输出也不得覆盖。
const actualBase = await fs.realpath(base);
const actualParent = await fs.realpath(path.dirname(output));
const parentRelative = path.relative(actualBase, actualParent);
if (parentRelative.startsWith("..") || path.isAbsolute(parentRelative)) throw new Error("输出父目录越过测试缓存边界");
await fs.mkdir(output);

const lifetime = new AbortController();
const browser = await openDouyinBrowser({
  executablePath: path.resolve(values.browser),
  headless: !values.headed,
  profileRoot: values.profile ? path.join(base, "ma01-douyin", "profiles", values.profile) : undefined,
  signal: lifetime.signal
});
const fetchRemote = createRemoteFetch({ requireHttps: true, maxRedirects: 3 });
const report: {
  status: string;
  source?: string;
  browserVersion: string;
  contentId?: string;
  type?: string;
  canonicalUrl?: string;
  media: Record<string, unknown>[];
  failures?: Record<string, unknown>[];
  longLinkMatches?: boolean;
  errorCode?: string;
  network?: ReturnType<typeof browser.networkStatus>;
  profileUsed?: boolean;
} = { status: "IN_PROGRESS", browserVersion: browser.browserVersion, profileUsed: Boolean(values.profile), media: [] };
const totalTimeout = setTimeout(() => lifetime.abort(new DOMException("验收超时", "TimeoutError")), 6 * 60 * 1000);
const cancel = () => lifetime.abort(new DOMException("验收已取消", "AbortError"));
process.once("SIGINT", cancel);
process.once("SIGTERM", cancel);
try {
  const context = browser.context;
  const page = await context.newPage();
  const { source, via } = await readDouyinWork(page, link.url, { signal: lifetime.signal });
  report.source = via;
  report.contentId = source.contentId;
  report.type = source.type;
  report.canonicalUrl = source.canonicalUrl;
  // 只保存规范化作品字段，不把页面或 API 的 Cookie、认证令牌和账户状态落盘。
  await fs.writeFile(path.join(output, "source.json"), JSON.stringify(source, null, 2), { flag: "wx" });
  let totalBytes = 0;
  for (const [position, media] of source.media.entries()) {
    const stem = `${String(position + 1).padStart(2, "0")}-${media.kind}`;
    // 视频保留扩展名以便浏览器正常解码；图片的最终后缀必须以实际格式为准。
    const temporary = path.join(output, stem + (media.kind === "image" ? ".partial" : ".partial.mp4"));
    let received = false;
    for (const url of media.urls.slice(0, 3)) {
      try {
        const response = await fetchRemote(url, {
          headers: { Referer: "https://www.douyin.com/" },
          signal: AbortSignal.any([lifetime.signal, AbortSignal.timeout(120_000)])
        });
        if (response.status !== 200) {
          (report.failures ??= []).push({ position, host: new URL(url).hostname, status: response.status });
          await response.body?.cancel();
          continue;
        }
        const limit = media.kind === "image" ? 20 * 1024 * 1024 : 200 * 1024 * 1024;
        try {
          assertRemoteResponseSize(response, limit);
        } catch (error) {
          await response.body?.cancel();
          throw error;
        }
        await pipeline(limitedResponseStream(response, limit), createWriteStream(temporary, { flags: "wx" }));
        const size = (await fs.stat(temporary)).size;
        if (!size || totalBytes + size > 512 * 1024 * 1024) throw new Error("验收下载超过总量上限");
        const hash = createHash("sha256");
        for await (const chunk of createReadStream(temporary)) hash.update(chunk);
        const sha256 = hash.digest("hex");
        let metadata: Record<string, unknown> = {};
        let extension = ".mp4";
        if (media.kind === "image") {
          // 图片已受 20 MiB 上限约束；从 Buffer 解码，避免 libvips 文件缓存锁住 Windows 暂存路径。
          const image = await sharp(await fs.readFile(temporary), { limitInputPixels: 40_000_000 }).metadata();
          if (!["webp", "jpeg", "png", "avif"].includes(image.format || "")) throw new Error("响应不是支持的图片");
          metadata = { width: image.width, height: image.height, format: image.format };
          extension = image.format === "jpeg" ? ".jpg" : `.${image.format}`;
        }
        if (media.kind !== "image") {
          const fixture = path.join(output, "playback.html");
          await fs.writeFile(
            fixture,
            `<!doctype html><video muted controls src="./${path.basename(temporary)}"></video>`
          );
          const preview = await context.newPage();
          try {
            await preview.goto(pathToFileURL(fixture).href);
            await preview.waitForFunction(() => document.querySelector("video")!.readyState >= 2, undefined, {
              timeout: 20_000
            });
            metadata = await preview.evaluate(async () => {
              const element = document.querySelector("video")!;
              await element.play();
              element.pause();
              return {
                width: element.videoWidth,
                height: element.videoHeight,
                duration: element.duration,
                playable: !element.error
              };
            });
          } finally {
            await preview.close();
          }
        }
        // 下载和实际解码都成功后再提交；失败回退不会遗留目标文件或重复累计总字节数。
        const filename = stem + extension;
        await fs.rename(temporary, path.join(output, filename));
        totalBytes += size;
        report.media.push({
          position,
          index: media.index,
          kind: media.kind,
          filename,
          bytes: size,
          sha256,
          ...metadata
        });
        received = true;
        break;
      } catch (error) {
        const failure = error as { name?: string; code?: string; cause?: { code?: string }; message?: string };
        (report.failures ??= []).push({
          position,
          host: new URL(url).hostname,
          errorName: failure.name,
          errorCode: failure.code,
          causeCode: failure.cause?.code
        });
        await fs.unlink(temporary).catch(() => undefined);
        lifetime.signal.throwIfAborted();
        // 所有候选都失败时不宣布成功；只删除本次新建的暂存文件，不涉及已有归档。
      }
    }
    if (!received)
      throw new DouyinSourceError("DOUYIN_MEDIA_INCOMPLETE", `第 ${position + 1} 个媒体无法完整下载和解码`);
  }
  // 用同一匿名上下文再打开长链接，比较作品身份和媒体顺序，不受临时 URL 签名变化影响。
  const { source: repeated } = await readDouyinWork(page, source.canonicalUrl, { signal: lifetime.signal });
  report.longLinkMatches = Boolean(
    repeated?.contentId === source.contentId &&
    JSON.stringify(repeated.media.map((m) => [m.kind, m.index, m.width, m.height])) ===
      JSON.stringify(source.media.map((m) => [m.kind, m.index, m.width, m.height]))
  );
  if (!report.longLinkMatches) throw new DouyinSourceError("DOUYIN_PARSE_FAILED", "长短链接的作品或媒体顺序不一致");
  const videos = report.media.filter((media) => media.kind !== "image");
  if (videos.length) {
    // 验收后留下可再次打开的本地播放器；不能继续引用已原子移动的暂存文件。
    await fs.writeFile(
      path.join(output, "playback.html"),
      `<!doctype html><meta charset="utf-8">${videos.map((media) => `<video muted controls preload="none" width="640" src="./${media.filename}"></video>`).join("\n")}`
    );
  }
  report.status = "PASSED";
} catch (error) {
  report.status = "FAILED";
  report.errorCode = lifetime.signal.aborted
    ? lifetime.signal.reason?.name === "TimeoutError"
      ? "DOUYIN_PROBE_TIMEOUT"
      : "DOUYIN_PROBE_CANCELLED"
    : error instanceof DouyinSourceError || error instanceof DouyinBrowserError
      ? error.code
      : "DOUYIN_PROBE_FAILED";
  process.exitCode = 1;
} finally {
  clearTimeout(totalTimeout);
  process.removeListener("SIGINT", cancel);
  process.removeListener("SIGTERM", cancel);
  await browser.close();
  report.network = browser.networkStatus();
  await fs.writeFile(path.join(output, "result.json"), JSON.stringify(report, null, 2), { flag: "wx" });
  console.log(JSON.stringify(report));
}
