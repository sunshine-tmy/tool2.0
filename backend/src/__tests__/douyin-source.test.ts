/** 使用脱敏结构夹具验证抖音普通视频、图集、实况配对和安全失败，不访问在线平台。 */
import { describe, expect, it } from "vitest";
import { DouyinSourceError, readDouyinApiResponse, readDouyinPage } from "../modules/media-archive/douyin-source";

const id = "7464977705159691570";
const cdn = "https://media.example.com";
const video = { width: 720, height: 960, duration: 2100, playAddr: [{ src: `${cdn}/video.mp4` }] };
const detail = {
  awemeId: id,
  awemeType: 0,
  desc: "2025新年快乐！ #烟花 #新年快乐",
  authorInfo: { uid: "author-1", nickname: "作者" },
  createTime: 1738075560,
  textExtra: [{ hashtagName: "烟花" }, { hashtagName: "烟花" }],
  video
};
function stream(tree: unknown) {
  return `<script>self.__pace_f.push(${JSON.stringify([1, "7:" + JSON.stringify(tree)])})</script>`;
}
function page(d: unknown) {
  return stream(["$", "$L1", null, { children: ["$", "$L2", null, { awemeId: id, aweme: { detail: d } }] }]);
}
function raw(overrides: Record<string, unknown> = {}) {
  return {
    status_code: 0,
    aweme_detail: {
      aweme_id: id,
      aweme_type: 0,
      desc: "完整文案",
      video: { width: 1080, height: 1920, duration: 15000, play_addr: { url_list: [`${cdn}/raw.mp4`] } },
      ...overrides
    }
  };
}

describe("抖音普通浏览器数据适配", () => {
  it("验证码页明确要求人工处理，不把正文中的验证码字样当成访问门禁", () => {
    try {
      readDouyinPage("<html><title>验证码中间页</title></html>", id);
    } catch (error) {
      expect(error).toMatchObject({ code: "DOUYIN_CHALLENGE_REQUIRED" });
    }
    expect(() => readDouyinPage("<TITLE> 安全验证 </TITLE>", id)).toThrow("正常完成");
    expect(readDouyinPage(page({ ...detail, desc: "教程：如何使用验证码" }), id)?.description).toContain("验证码");
  });
  it("读取嵌套视频 SSR，保留全文、作者、发布时间并去重话题", () => {
    const result = readDouyinPage(page(detail), id);
    expect(result).toMatchObject({
      platform: "douyin",
      contentId: id,
      type: "video",
      description: detail.desc,
      title: detail.desc,
      author: { id: "author-1", name: "作者" },
      tags: ["烟花"]
    });
    expect(result?.publishedAt).toBe(new Date(detail.createTime * 1000).toISOString());
    expect(result?.media).toEqual([
      { kind: "video", index: 0, urls: [`${cdn}/video.mp4`], width: 720, height: 960, durationMs: 2100 }
    ]);
  });

  it("视频 SSR 为空时不把推荐作品当当前作品，允许调用方等待正常 API", () => {
    const recommended = { ...detail, awemeId: "7685962392984216805" };
    expect(readDouyinPage(page(null) + stream(recommended), id)).toBeUndefined();
    expect(readDouyinPage(stream({ ...recommended, desc: detail.desc }), id)).toBeUndefined();
  });

  it("兼容 RENDER_DATA 旧格式、单引号 ID、大小写标签及分号", () => {
    const html = `<SCRIPT ID='RENDER_DATA' type="application/json">${encodeURIComponent(JSON.stringify({ detail }))}</SCRIPT>`;
    expect(readDouyinPage(html, id)?.contentId).toBe(id);
    expect(readDouyinPage(page(detail).replace(")</script>", ");</script>"), id)?.contentId).toBe(id);
  });

  it("通过真实 API 的 snake_case 结构读取视频，并丢弃页面认证字段", () => {
    const result = readDouyinApiResponse(
      raw({
        authentication_token: "secret",
        author: { uid: "1", nickname: "作者" },
        text_extra: [{ hashtag_name: "新年" }],
        item_title: "独立标题"
      }),
      id
    );
    expect(result.title).toBe("独立标题");
    expect(result.tags).toEqual(["新年"]);
    expect(result.media[0].urls).toEqual([`${cdn}/raw.mp4`]);
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(result.canonicalUrl).toBe(`https://www.douyin.com/video/${id}`);
  });

  it("图集严格保留图片顺序，不保存作为背景音的顶层 video", () => {
    const images = [2, 1, 3].map((index) => ({
      urlList: [`${cdn}/${index}.webp`],
      width: 1308,
      height: 1744,
      video: null,
      livePhotoType: 0
    }));
    const result = readDouyinPage(page({ ...detail, awemeType: 68, images }), id);
    expect(result?.type).toBe("image");
    expect(result?.media.map((m) => m.urls[0])).toEqual([`${cdn}/2.webp`, `${cdn}/1.webp`, `${cdn}/3.webp`]);
    expect(result?.canonicalUrl).toBe(`https://www.douyin.com/note/${id}`);
  });

  it("14 组实况完整保留图片与视频配对，混合普通图片也不打乱 index", () => {
    const images = Array.from({ length: 14 }, (_, index) => ({
      urlList: [`${cdn}/${index}.webp`],
      video: { ...video, playAddr: [{ src: `${cdn}/${index}.mp4` }] },
      livePhotoType: 1
    }));
    const result = readDouyinPage(page({ ...detail, awemeType: 68, images }), id);
    expect(result?.type).toBe("live-photo");
    expect(result?.media).toHaveLength(28);
    expect(result?.media.map((m) => [m.index, m.kind])).toEqual(
      images.flatMap((_, i) => [
        [i, "image"],
        [i, "live-photo"]
      ])
    );
    expect(
      readDouyinApiResponse(
        raw({
          aweme_type: 68,
          images: [
            {
              url_list: [`${cdn}/one.webp`],
              video: { play_addr: { url_list: [`${cdn}/one.mp4`] } },
              live_photo_type: 1
            }
          ]
        }),
        id
      ).media
    ).toHaveLength(2);
  });

  it.each([
    { images: [{ urlList: [] }] },
    { images: [{ urlList: [`${cdn}/image.webp`], video: { playAddr: [] }, livePhotoType: 1 }] },
    { images: [{ urlList: [`${cdn}/image.webp`], livePhotoType: 1 }] },
    { awemeType: 68, images: [] },
    { video: {} },
    {
      video: {
        playAddr: [
          "http://example.org/video.mp4",
          "javascript:alert(1)",
          "https://user:password@example.org/file",
          "https://example.org:3210/file"
        ]
      }
    }
  ])("媒体缺失时整体失败，不能静默归档部分数据：%o", (overrides) => {
    expect(() => readDouyinPage(page({ ...detail, ...overrides }), id)).toThrowError(DouyinSourceError);
    try {
      readDouyinPage(page({ ...detail, ...overrides }), id);
    } catch (error) {
      expect((error as DouyinSourceError).code).toBe("DOUYIN_MEDIA_INCOMPLETE");
    }
  });

  it("限制媒体候选并去重，保留有效 URL 的令牌与回退顺序", () => {
    const result = readDouyinPage(
      page({
        ...detail,
        video: {
          playAddr: [
            null,
            {},
            "bad",
            `${cdn}/file?token=first`,
            `${cdn}/file?token=first`,
            { src: `${cdn}/file?token=second` }
          ]
        }
      }),
      id
    );
    expect(result?.media[0].urls).toEqual([`${cdn}/file?token=first`, `${cdn}/file?token=second`]);
  });

  it("明确登录门禁或私有权限时拒绝，不把未知平台状态码猜成登录错误", () => {
    expect(() => readDouyinApiResponse(raw({ pc_need_login: true }), id)).toThrow("登录");
    expect(() => readDouyinPage(page({ ...detail, pcNeedLogin: true }), id)).toThrow("登录");
    expect(() => readDouyinPage(page({ ...detail, isPrivate: true }), id)).toThrow("访问权限");
    expect(() => readDouyinPage(page({ ...detail, isFriendLimit: true }), id)).toThrow("访问权限");
    expect(() => readDouyinApiResponse(raw({ status: { is_private: true } }), id)).toThrow("访问权限");
    expect(() => readDouyinApiResponse({ status_code: 8 }, id)).toThrow("没有返回");
  });

  it("身份不符、畸形响应或异常状态必须失败", () => {
    expect(() => readDouyinApiResponse(raw({ aweme_id: "7685962392984216805" }), id)).toThrow("不一致");
    expect(() => readDouyinApiResponse(raw(), "bad")).toThrow("不一致");
    expect(() => readDouyinApiResponse({ status_code: 1, aweme_detail: {} }, id)).toThrow("没有返回");
    expect(() => readDouyinApiResponse({ ...raw(), status_code: 1 }, id)).toThrow("响应状态");
    expect(() => readDouyinApiResponse(undefined, id)).toThrow("没有返回");
    expect(() => readDouyinPage(page({ ...detail, images: "wrong" }), id)).toThrow("列表格式");
  });

  it("纯 JSON 解析拒绝可执行脚本、无效片段，合法片段仍可继续寻找", () => {
    const prefix =
      '<script>self.__pace_f.push((globalThis.leak=1,[]))</script><script>self.__pace_f.push([1,"bad"])</script><script id="RENDER_DATA">%invalid</script>';
    expect(readDouyinPage(prefix + page(detail), id)?.contentId).toBe(id);
    expect(readDouyinPage(page(detail).replace(")</script>", ");globalThis.leak=1</script>"), id)).toBeUndefined();
    expect(readDouyinPage('<script>self.__pace_f.push([2,"7:{}"])</script>', id)).toBeUndefined();
    expect(readDouyinPage('<script>self.__pace_f.push([1,"missing-colon"])</script>', id)).toBeUndefined();
  });

  it("对体积、深度、节点数和图片数使用有界解析", () => {
    expect(() => readDouyinPage("x".repeat(4 * 1024 * 1024 + 1), id)).toThrow("页面超过");
    let nested: unknown = { value: 1 };
    for (let i = 0; i < 35; i++) nested = { children: nested };
    expect(() => readDouyinPage(stream(nested), id)).toThrow("嵌套");
    expect(() => readDouyinPage(stream(Array.from({ length: 25001 }, () => ({}))), id)).toThrow("节点数量");
    expect(() => readDouyinPage(page({ ...detail, images: Array.from({ length: 101 }, () => ({})) }), id)).toThrow(
      "媒体数量"
    );
  });

  it("标题回退不截断完整文案，无效时间和尺寸不伪造", () => {
    const description = "新年快乐🎆".repeat(30);
    const result = readDouyinApiResponse(
      raw({ desc: description, create_time: -1, video: { play_addr: { url_list: [`${cdn}/ok.mp4`] } } }),
      id
    );
    expect(Array.from(result.title)).toHaveLength(80);
    expect(result.description).toBe(description);
    expect(result.publishedAt).toBeUndefined();
    expect(result.media[0].width).toBeUndefined();
    expect(readDouyinApiResponse(raw({ desc: null }), id).title).toBe(`抖音作品 ${id}`);
  });
});
