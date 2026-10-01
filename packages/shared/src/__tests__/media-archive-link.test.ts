/** 平台识别不依赖网络；重点防止伪装域名、多个链接与分享令牌丢失。 */
import { describe, expect, it } from "vitest";
import { identifyArchiveLink } from "../media-archive-link";

describe("归档作品链接识别", () => {
  it.each([
    ["分享 https://www.xiaohongshu.com/discovery/item/abc?xsec_token=a%2Bb&source=pc_share。", "xiaohongshu"],
    ["https://www.xiaohongshu.com/explore/abc", "xiaohongshu"],
    ["http://xhslink.com/a/123", "xiaohongshu"],
    ["https://xhslink.cn/a/123", "xiaohongshu"],
    ["https://www.xhslink.cn/a/123", "xiaohongshu"],
    ["7.99 回理工。 https://v.douyin.com/PrWnsoVIg78/ 复制打开抖音", "douyin"],
    ["https://www.douyin.com/note/7594644721835798635", "douyin"],
    ["https://www.douyin.com/video/123456?modal_id=123456", "douyin"],
    ["https://www.iesdouyin.com/share/video/123456/", "douyin"]
  ])("识别分享作品：%s", (input, platform) => {
    expect(identifyArchiveLink(input)).toMatchObject({ ok: true, platform });
  });

  it("不移除访问作品所需的查询参数，并合并完全相同的重复链接", () => {
    const url = "https://www.xiaohongshu.com/explore/abc?xsec_token=a%2Bb&source=pc_share";
    expect(identifyArchiveLink(`${url} ${url}`)).toEqual({ ok: true, platform: "xiaohongshu", url });
  });

  it.each([
    "",
    "没有链接",
    "https://www.douyin.com/user/123",
    "https://live.douyin.com/123",
    "https://douyin.com.example.org/video/123",
    "https://example.org/?url=https://www.douyin.com/video/123",
    "https://douyin.com@evil.example/video/123",
    "https://www.douyin.com:3210/video/123",
    "https://www.xiaohongshu.com/user/profile/abc",
    "https://v.douyin.com/a/extra",
    "https://www.douyin.com/video/123 https://xhslink.com/abc"
  ])("拒绝非作品或不明确的输入：%s", (input) => {
    expect(identifyArchiveLink(input).ok).toBe(false);
  });

  it("显式平台与链接不符时要求用户修正，不静默切换平台", () => {
    expect(identifyArchiveLink("https://v.douyin.com/abc/", "xiaohongshu")).toMatchObject({
      ok: false,
      message: expect.stringContaining("不一致")
    });
    expect(identifyArchiveLink("https://xhslink.com/abc", "xiaohongshu").ok).toBe(true);
    expect(identifyArchiveLink("https://v.douyin.com/abc/", "douyin").ok).toBe(true);
  });
});
