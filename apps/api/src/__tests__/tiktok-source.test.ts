import { describe, expect, it } from "vitest";
import {
  normalizeTikTokItem,
  readTikTokPage,
  tikTokWorkIdentity
} from "../domains/content-archive/providers/tiktok/source";

const id = "7700596613189963029";
const video = () => ({
  id,
  desc: "商品介绍 #Tea [保留原文]",
  createTime: "1760000000",
  author: { id: "author", uniqueId: "shop", nickname: "商家" },
  video: {
    playAddr: "https://v19-webapp-prime.us.tiktok.com/play.mp4",
    cover: "https://p16.tiktokcdn-us.com/cover.webp",
    duration: 25,
    width: 576,
    height: 1024
  }
});
const html = (item: unknown) =>
  `<script nonce="fixture" id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify({ __DEFAULT_SCOPE__: { "webapp.video-detail": { statusCode: 0, itemInfo: { itemStruct: item } } } })}</script>`;

describe("TikTok public page normalization", () => {
  it("uses only page-supplied bitrate alternatives in order, including the official public play endpoint", () => {
    const result = normalizeTikTokItem(
      {
        ...video(),
        video: {
          ...video().video,
          downloadAddr: video().video.playAddr,
          bitrateInfo: [
            {
              PlayAddr: {
                UrlList: [
                  video().video.playAddr,
                  "https://v16.tiktok.com/alternate.mp4",
                  "https://www.tiktok.com/aweme/v1/play/?video_id=fixture",
                  "https://evil.test/other"
                ]
              }
            }
          ]
        }
      },
      id
    );
    expect(result.media[0].urls).toEqual([
      video().video.playAddr,
      "https://v16.tiktok.com/alternate.mp4",
      "https://www.tiktok.com/aweme/v1/play/?video_id=fixture"
    ]);
  });
  it("reads supported public JSON layouts and rejects empty/oversized galleries", () => {
    for (const [marker, value] of [
      ["SIGI_STATE", { ItemModule: { [id]: video() } }],
      ["__NEXT_DATA__", { props: { pageProps: { itemInfo: { itemStruct: video() } } } }]
    ])
      expect(readTikTokPage(`<script id="${marker}">${JSON.stringify(value)}</script>`, id)?.contentId).toBe(id);
    for (const images of [[], Array(101).fill({ imageURL: { urlList: ["https://p16.tiktokcdn-us.com/1.jpg"] } })])
      expect(() => normalizeTikTokItem({ ...video(), imagePost: { images } }, id)).toThrow("归档数量上限");
    expect(readTikTokPage('<script>unrelated</script><script id="SIGI_STATE">null</script>', id)).toBeUndefined();
  });
  it("preserves stable identity, raw text, author, dimensions, duration and HTTPS media", () => {
    const result = readTikTokPage(html(video()), id)!;
    expect(result).toMatchObject({
      platform: "tiktok",
      contentId: id,
      type: "video",
      canonicalUrl: `https://www.tiktok.com/@shop/video/${id}`,
      rawText: "商品介绍 #Tea [保留原文]",
      author: { id: "author", name: "商家" }
    });
    expect(result.media).toEqual([
      { kind: "video", index: 0, urls: [video().video.playAddr], width: 576, height: 1024, durationMs: 25000 },
      { kind: "cover", index: 1, urls: [video().video.cover] }
    ]);
    expect(result.topics[0].source).toBe("Tea");
  });
  it("preserves complete ordered photo posts and image alternatives", () => {
    const item = {
      ...video(),
      imagePost: {
        title: "三张商品图",
        images: [1, 2, 3].map((n) => ({
          imageURL: { urlList: [`https://p16.tiktokcdn-us.com/${n}.webp`, `https://p19.tiktokcdn-us.com/${n}.webp`] },
          imageWidth: 1086,
          imageHeight: 1448
        }))
      }
    };
    const result = normalizeTikTokItem(item, id);
    expect(result).toMatchObject({
      type: "image",
      title: "三张商品图",
      canonicalUrl: `https://www.tiktok.com/@shop/photo/${id}`
    });
    expect(result.media.map((m) => [m.kind, m.index, m.urls.length])).toEqual([
      ["image", 0, 2],
      ["image", 1, 2],
      ["image", 2, 2]
    ]);
  });
  it("never substitutes a recommended or redirected different work", () => {
    expect(() => readTikTokPage(html({ ...video(), id: "7700458638191627540" }), id)).toThrow("不一致");
    expect(
      readTikTokPage(`<script id="SIGI_STATE">${JSON.stringify({ ItemModule: { other: video() } })}</script>`, id)
    ).toBeUndefined();
  });
  it.each([
    "https://127.0.0.1/video",
    "http://v19.tiktok.com/video",
    "https://tiktok.com.evil.test/video",
    "https://a:b@v19.tiktok.com/video"
  ])("rejects hostile media: %s", (url) => {
    expect(() => normalizeTikTokItem({ ...video(), video: { playAddr: url } }, id)).toThrow("视频地址");
  });
  it("rejects restricted/private or incomplete data and leaves public shells unresolved", () => {
    expect(() => normalizeTikTokItem({ ...video(), privateItem: true }, id)).toThrow("匿名公开访问");
    expect(() => normalizeTikTokItem({ ...video(), imagePost: { images: [{ imageURL: {} }] } }, id)).toThrow(
      "不完整图集"
    );
    expect(() =>
      readTikTokPage(
        '<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">{"__DEFAULT_SCOPE__":{"webapp.video-detail":{"statusCode":10216}}}</script>',
        id
      )
    ).toThrow("匿名访问");
    expect(
      readTikTokPage('<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">{"__DEFAULT_SCOPE__":{}}</script>', id)
    ).toBeUndefined();
    expect(readTikTokPage('<script id="SIGI_STATE">invalid</script>', id)).toBeUndefined();
  });
  it("validates final work destinations independently of short input recognition", () => {
    expect(tikTokWorkIdentity(`https://www.tiktok.com/@shop/photo/${id}`)).toEqual({
      author: "shop",
      kind: "photo",
      id
    });
    expect(tikTokWorkIdentity(`https://www.tiktok.com.evil.test/@shop/video/${id}`)).toBeUndefined();
    expect(tikTokWorkIdentity("https://www.tiktok.com/login")).toBeUndefined();
  });
});
