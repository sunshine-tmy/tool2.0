import { describe, expect, it } from "vitest";
import type { VideoTextAnalysis, VideoTextTimelineItem } from "@toolbox/shared/video-text";
import { analyzeVideoInsightRules } from "../modules/video-insight-rules";

function transcript(
  cues: Array<Pick<VideoTextTimelineItem, "text" | "startSeconds" | "endSeconds">>,
  lowConfidenceIndexes: number[] = []
): VideoTextAnalysis {
  const timeline = cues.map((cue, index) => ({ index: index + 1, ...cue }));
  const fullText = timeline.map((cue) => cue.text).join("\n");
  return {
    title: "黄金脚本",
    fullText,
    timeline,
    segments: timeline,
    summary: [],
    chapters: [],
    stats: {
      characterCount: fullText.length,
      wordCount: fullText.length,
      sentenceCount: timeline.length,
      cueCount: timeline.length,
      estimatedReadingMinutes: 1
    },
    recognitionQuality: {
      lowConfidenceSegments: lowConfidenceIndexes.map((index) => ({ ...timeline[index - 1]!, index }))
    }
  };
}

describe("video insight precision rules", () => {
  it("extracts the complete persuasion chain with timed evidence", () => {
    const analysis = analyzeVideoInsightRules({
      title: "小个子风衣测评",
      durationMs: 23_000,
      text: "",
      transcript: transcript([
        { startSeconds: 0, endSeconds: 3, text: "小个子女生买风衣，是不是总怕压个子？" },
        { startSeconds: 3, endSeconds: 6, text: "这件长度98厘米，上身直接显高5厘米。" },
        { startSeconds: 6, endSeconds: 11, text: "腰线提高3厘米，采用垂感面料，不贴腿也更利落。" },
        { startSeconds: 11, endSeconds: 16, text: "我拿普通版做对比，右边明显更利落。" },
        { startSeconds: 16, endSeconds: 20, text: "原价299，今晚券后199，前100名送腰带。" },
        { startSeconds: 20, endSeconds: 23, text: "点小黄车链接下单，选择你的尺码。" }
      ])
    });

    const kinds = analysis.keyPoints.map((point) => point.kind);
    expect(analysis.version).toBe(3);
    expect(analysis.hookAnalysis).toMatchObject({ type: "pain-question" });
    expect(analysis.hookAnalysis?.evidence).toMatchObject({ startSeconds: 0, endSeconds: 3 });
    expect(analysis.hookAnalysis?.evidence.text).toContain("小个子女生");
    expect(kinds).toEqual(
      expect.arrayContaining(["audience", "pain", "promise", "mechanism", "proof", "offer", "cta"])
    );
    expect(analysis.keywords.product).toContain("小个子风衣");
    expect(analysis.keywords.price).toEqual(expect.arrayContaining(["原价299", "券后199"]));
    expect(analysis.scriptBlueprint.formula).toContain("可信证明");
    expect(analysis.scriptBlueprint.formula).toContain("行动指令");
    expect(analysis.sellingPointChains[0]).toMatchObject({
      userBenefit: expect.stringContaining("显高5厘米"),
      proof: expect.stringContaining("对比")
    });
    expect(analysis.scriptBlueprint.pacing).toMatchObject({ conversionStartSeconds: 16, totalSeconds: 23 });
    expect(analysis.missingElements).not.toContain("缺少实测、数据、对比、认证或用户反馈证明");
    expect(analysis.finalOutput.sections.filter((section) => section.origin === "placeholder")).toEqual([]);
    expect(analysis.finalOutput).toMatchObject({ source: "rules", status: "ready" });
    expect(analysis.finalOutput.fullScript).toContain("点小黄车链接下单");
    expect(analysis.changeLog.map((item) => item.area)).toEqual(expect.arrayContaining(["开场钩子", "脚本顺序"]));
  });

  it("supports multiple intents without dropping offer or CTA", () => {
    const analysis = analyzeVideoInsightRules({
      text: "怕贵？原价299，今天99元，点链接下单。",
      title: "测试商品"
    });
    const kinds = analysis.keyPoints.map((point) => point.kind);
    expect(kinds).toEqual(expect.arrayContaining(["pain", "offer", "cta"]));
  });

  it("does not turn negated terms into positive offers or purchase instructions", () => {
    const analysis = analyzeVideoInsightRules({
      text: "这不是优惠，也不建议你现在购买，先看完参数再决定。",
      title: "参数说明"
    });
    expect(analysis.keyPoints.some((point) => point.kind === "offer")).toBe(false);
    expect(analysis.keyPoints.some((point) => point.kind === "cta")).toBe(false);
  });

  it("reports missing stages instead of fabricating a complete structure", () => {
    const analysis = analyzeVideoInsightRules({ text: "大家好，今天分享一款恒温电热水杯。", title: "恒温电热水杯" });
    expect(analysis.keyPoints).toEqual([]);
    expect(analysis.segments.every((segment) => segment.kind === "hook")).toBe(true);
    expect(analysis.keywords.product).toContain("恒温电热水杯");
    expect(analysis.finalOutput.status).toBe("needs-transcript");
    expect(analysis.improvements.length).toBeGreaterThan(0);
    expect(analysis.missingElements).toEqual(
      expect.arrayContaining([
        "未提取到清晰的用户结果承诺",
        "缺少实测、数据、对比、认证或用户反馈证明",
        "缺少清晰且唯一的下一步行动指令"
      ])
    );
  });

  it("selects the informative hook line after a generic greeting", () => {
    const analysis = analyzeVideoInsightRules({
      text: "",
      title: "油皮底妆",
      transcript: transcript([
        { startSeconds: 0, endSeconds: 1, text: "姐妹们。" },
        { startSeconds: 1, endSeconds: 4, text: "油皮夏天是不是一化妆就脱妆？" },
        { startSeconds: 4, endSeconds: 7, text: "这个方法能让底妆更持久。" }
      ])
    });
    expect(analysis.hookAnalysis?.evidence.text).toContain("油皮夏天");
    expect(analysis.hookAnalysis?.evidence.text).not.toBe("姐妹们");
  });

  it("downgrades facts from low-confidence transcript cues", () => {
    const analysis = analyzeVideoInsightRules({
      text: "",
      title: "商品报价",
      transcript: transcript([{ startSeconds: 0, endSeconds: 3, text: "券后99元，点击链接下单。" }], [1])
    });
    const offer = analysis.keyPoints.find((point) => point.kind === "offer");
    expect(offer?.confidence).toBe("low");
    expect(analysis.quality.lowConfidenceCueRatio).toBe(1);
    expect(analysis.quality.reasons.join(" ")).toContain("低置信");
  });

  it("extracts viewpoint, conflict and resolution from emotional copywriting", () => {
    const analysis = analyzeVideoInsightRules({
      text: "",
      title: "其实旁人是能看出你的难的 #情感共鸣 #人生 #文案",
      transcript: transcript([
        { startSeconds: 0, endSeconds: 1.3, text: "最近刷到了一句话。" },
        { startSeconds: 1.3, endSeconds: 3.5, text: "其实旁人是能够看得到你的难的。" },
        { startSeconds: 3.5, endSeconds: 6, text: "就像你能看见小孩子眼泪拌饭一样。" },
        { startSeconds: 6, endSeconds: 10, text: "他们知道你已经摇摇欲坠，更知道你需要一把降落伞。" },
        { startSeconds: 10, endSeconds: 15, text: "只不过帮不帮你这件事，对他们来说意义不大。" },
        { startSeconds: 15, endSeconds: 20, text: "这不是你的问题，因为现实就是如此。" },
        { startSeconds: 20, endSeconds: 25, text: "每个人都站在各自的立场，所有人都在袖手旁观。" },
        { startSeconds: 25, endSeconds: 28, text: "所以别再等别人来救你了。" },
        { startSeconds: 28, endSeconds: 31, text: "这世界的降落伞，从来都是自己给自己准备的。" }
      ])
    });

    const kinds = analysis.keyPoints.map((point) => point.kind);
    expect(analysis.brief.contentMode).toBe("opinion");
    expect(analysis.hookAnalysis?.type).toBe("quote-led");
    expect(kinds).toEqual(
      expect.arrayContaining(["context", "conflict", "viewpoint", "turning-point", "resolution", "golden-line"])
    );
    expect(analysis.brief.coreMessage).toBeTruthy();
    expect(analysis.brief.oneSentenceSummary).toContain("收束到");
    expect(analysis.missingElements.every((item) => !item.includes("价格") && !item.includes("CTA"))).toBe(true);
    expect(analysis.keywords.product).toEqual([]);
    expect(analysis.finalOutput.fullScript).toContain("自己给自己准备的");
    expect(analysis.changeLog.length).toBeGreaterThan(0);
  });
});
