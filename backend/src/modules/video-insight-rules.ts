import type {
  InsightAnalysis,
  InsightConfidence,
  InsightContentBrief,
  InsightEvidence,
  InsightHookAnalysis,
  InsightHookType,
  InsightImprovementSuggestion,
  InsightKeyPoint,
  InsightKeyPointKind,
  InsightKeywordGroups,
  InsightScriptBlueprint,
  InsightSegment,
  InsightSegmentKind,
  VideoInsightTranscript
} from "@toolbox/shared";

type VideoInsightRuleInput = {
  title?: string;
  text: string;
  transcript?: VideoInsightTranscript["analysis"];
  transcriptWarning?: string;
  durationMs?: number;
};

type TextUnit = {
  index: number;
  sourceIndex: number;
  text: string;
  startSeconds?: number;
  endSeconds?: number;
  lowConfidence: boolean;
};

type SignalPattern = { pattern: RegExp; signal: string; weight: number };
type ClassificationRule = {
  kind: InsightKeyPointKind;
  label: string;
  segmentKind: InsightSegmentKind;
  whyItMatters: string;
  objective: string;
  patterns: SignalPattern[];
};

type ClassifiedPoint = InsightKeyPoint & { unit: TextUnit; segmentKind: InsightSegmentKind; objective: string };

const classificationRules: ClassificationRule[] = [
  {
    kind: "context",
    label: "话题铺垫",
    segmentKind: "context",
    whyItMatters: "交代观点或故事从哪里开始，为后续冲突建立语境。",
    objective: "用一句经历、现象或引用快速建立话题",
    patterns: [
      {
        pattern: /最近.{0,12}(?:看到|刷到|听到|遇到)|有句话|听过一句|很多人都|我们经常/,
        signal: "话题引入",
        weight: 27
      },
      { pattern: /以前|曾经|那天|有一次|一开始|最开始/, signal: "故事背景", weight: 24 }
    ]
  },
  {
    kind: "conflict",
    label: "情绪冲突",
    segmentKind: "conflict",
    whyItMatters: "冲突决定观众是否继续听，也是观点内容的张力来源。",
    objective: "揭示期待与现实之间的落差",
    patterns: [
      { pattern: /只不过|可惜|偏偏|明明.{0,16}(?:却|但是)|但是|然而|却|反而/, signal: "转折冲突", weight: 29 },
      { pattern: /意义不大|袖手旁观|没人|不在乎|不理解|不愿意|帮不帮|搭上更多/, signal: "关系落差", weight: 27 },
      { pattern: /眼泪|崩溃|委屈|孤独|遥遥欲坠|摇摇欲坠|无助|撑不住/, signal: "高情绪词", weight: 25 }
    ]
  },
  {
    kind: "viewpoint",
    label: "核心观点",
    segmentKind: "viewpoint",
    whyItMatters: "这是脚本真正想让观众记住的判断或认知。",
    objective: "提出清晰、可复述的中心观点",
    patterns: [
      { pattern: /其实|本质上|说到底|归根结底|真正的|关键是|事实是/, signal: "观点标记", weight: 29 },
      { pattern: /这不是你的问题|世道就是如此|每个人都|所有人都|人性就是|现实就是/, signal: "判断句", weight: 28 },
      { pattern: /(?:我想说|你要明白|你会发现|这说明).{2,28}/, signal: "观点输出", weight: 27 }
    ]
  },
  {
    kind: "turning-point",
    label: "认知转折",
    segmentKind: "turning-point",
    whyItMatters: "把前面的情绪或事实转化为新的认知，是观点脚本的推进点。",
    objective: "从现象转向结论或行动主张",
    patterns: [
      { pattern: /所以|因此|于是|直到|后来才|但真正|换句话说|也就是说/, signal: "逻辑转折", weight: 28 },
      { pattern: /不是.{0,16}而是|与其.{0,16}不如/, signal: "认知重构", weight: 30 }
    ]
  },
  {
    kind: "resolution",
    label: "观点收束",
    segmentKind: "resolution",
    whyItMatters: "给观众一个能带走的结论、态度或行动方向。",
    objective: "用一句明确主张完成情绪释放和记忆收口",
    patterns: [
      { pattern: /别再|不要再|要学会|记住|你应该|你需要|不如从现在开始/, signal: "行动主张", weight: 30 },
      { pattern: /只有自己|靠自己|自己给自己|从来都是自己|先救自己|成为自己的/, signal: "自我解法", weight: 31 },
      { pattern: /愿你|希望你|最后想说|这才是/, signal: "情绪收束", weight: 24 }
    ]
  },
  {
    kind: "golden-line",
    label: "记忆金句",
    segmentKind: "viewpoint",
    whyItMatters: "隐喻、对仗或高度凝练的表达最容易形成记忆和传播。",
    objective: "用可单独传播的一句话承载核心认知",
    patterns: [
      { pattern: /就像|如同|好比|仿佛|降落伞|救命稻草|避风港/, signal: "隐喻表达", weight: 27 },
      { pattern: /从来都|从来不是|永远不要|所有人都|天下.{0,12}皆为/, signal: "强判断金句", weight: 28 }
    ]
  },
  {
    kind: "pain",
    label: "用户痛点",
    segmentKind: "pain-point",
    whyItMatters: "用于建立问题共鸣，让观众确认内容与自己有关。",
    objective: "放大目标用户正在经历的问题或损失",
    patterns: [
      { pattern: /还在|是不是也|有没有遇到|每次都|总是|最怕|受够了/, signal: "痛点提问", weight: 28 },
      { pattern: /困扰|麻烦|难搞|难用|费时|浪费|踩坑|焦虑|头疼|不方便/, signal: "负面处境", weight: 24 },
      {
        pattern: /太贵|太慢|不够|没效果|怕.{0,8}(?:贵|麻烦|没用|踩坑|压个子)|容易.{0,6}(?:坏|脏|掉|卡|忘)/,
        signal: "明确问题",
        weight: 25
      },
      { pattern: /别再|不要再|千万别/, signal: "损失规避", weight: 18 }
    ]
  },
  {
    kind: "audience",
    label: "目标人群",
    segmentKind: "audience",
    whyItMatters: "明确内容在对谁说话，决定脚本的共鸣精度。",
    objective: "点名目标人群或使用场景",
    patterns: [
      { pattern: /如果你是|尤其适合|特别适合|适合.{0,12}(?:人|党|族|用户)/, signal: "直接点名人群", weight: 32 },
      {
        pattern: /宝妈|学生党|上班族|打工人|新手|小白|懒人|租房党|通勤|敏感肌|油皮|干皮|小个子|大码|微胖|孕妈/,
        signal: "人群标签",
        weight: 27
      },
      { pattern: /经常.{0,12}的|需要.{0,12}的|想要.{0,12}的/, signal: "需求人群", weight: 18 }
    ]
  },
  {
    kind: "promise",
    label: "核心承诺",
    segmentKind: "selling-point",
    whyItMatters: "回答观众继续观看或购买能获得什么结果。",
    objective: "给出清晰、可感知的结果承诺",
    patterns: [
      { pattern: /(?:只要|不用|无需).{0,18}(?:就能|也能|即可)/, signal: "低门槛结果", weight: 30 },
      {
        pattern: /(?:让你|帮你|可以|能够|直接).{0,16}(?:解决|改善|提升|减少|告别|省下|搞定|完成)/,
        signal: "结果承诺",
        weight: 30
      },
      { pattern: /(?:立刻|马上|快速|轻松).{0,12}(?:变|做到|完成|解决|拥有)/, signal: "即时收益", weight: 24 },
      {
        pattern: /(?:直接|马上|立刻).{0,12}(?:显高|显瘦|提亮|保湿|控油|变白|变亮|变干净|省时|省钱)/,
        signal: "可感知结果",
        weight: 28
      },
      { pattern: /从.{1,12}变成|用了?之后.{0,16}(?:更|不再|直接)/, signal: "前后变化", weight: 24 }
    ]
  },
  {
    kind: "feature",
    label: "产品特性",
    segmentKind: "selling-point",
    whyItMatters: "说明产品具体有什么，而不是只给空泛评价。",
    objective: "交代可验证的功能、规格或材质",
    patterns: [
      { pattern: /(?:支持|配备|搭载|内置|拥有|自带).{1,24}/, signal: "明确功能", weight: 27 },
      {
        pattern: /(?:容量|尺寸|重量|功率|续航|浓度|含量|材质|规格).{0,8}(?:\d|是|达到)/,
        signal: "规格参数",
        weight: 29
      },
      {
        pattern: /\d+(?:\.\d+)?\s*(?:毫升|ml|升|l|克|g|公斤|kg|小时|分钟|天|档|层|种|倍)/i,
        signal: "量化规格",
        weight: 27
      }
    ]
  },
  {
    kind: "mechanism",
    label: "实现机制",
    segmentKind: "mechanism",
    whyItMatters: "解释结果为什么成立，是卖点可信度的核心。",
    objective: "解释成分、技术、设计或工作原理",
    patterns: [
      {
        pattern: /(?:采用|通过|利用|基于|搭载).{2,24}(?:技术|设计|结构|算法|工艺|材质|成分)?/,
        signal: "实现方式",
        weight: 31
      },
      { pattern: /(?:因为|原理是|关键在于|核心是).{3,28}/, signal: "因果解释", weight: 29 },
      { pattern: /(?:含有|添加|不含).{1,20}(?:成分|配方|酒精|香精|糖|油)?/, signal: "成分依据", weight: 25 }
    ]
  },
  {
    kind: "benefit",
    label: "用户收益",
    segmentKind: "selling-point",
    whyItMatters: "把产品特性翻译成用户真正能感知的价值。",
    objective: "说明功能最终给用户带来的好处",
    patterns: [
      { pattern: /更(?:快|省|稳|轻|薄|方便|干净|安全|舒服|持久|清晰)/, signal: "比较收益", weight: 23 },
      { pattern: /省时|省钱|省力|方便|轻松|简单|耐用|持久|不占地|随身/, signal: "实际收益", weight: 24 },
      { pattern: /不用.{0,12}(?:担心|反复|手动|额外|再买|等待)/, signal: "减少成本", weight: 23 }
    ]
  },
  {
    kind: "demo",
    label: "使用演示",
    segmentKind: "demo",
    whyItMatters: "通过具体动作降低理解和使用门槛。",
    objective: "展示产品怎么使用以及即时表现",
    patterns: [
      { pattern: /(?:先|第一步).{0,18}(?:再|然后|接着)/, signal: "操作步骤", weight: 27 },
      { pattern: /(?:打开|倒入|涂上|按下|放入|连接|选择|喷|擦|搅拌).{0,20}/, signal: "使用动作", weight: 24 },
      { pattern: /给你们看|大家看|看这里|实际操作|现场演示|实拍/, signal: "演示提示", weight: 25 }
    ]
  },
  {
    kind: "proof",
    label: "可信证明",
    segmentKind: "proof",
    whyItMatters: "用事实、对比或第三方背书支撑卖点，降低怀疑。",
    objective: "提供数据、实测、对比、认证或用户反馈",
    patterns: [
      { pattern: /实测|测试结果|前后对比|对比一下|做.{0,4}对比|实拍|用了?\d+/, signal: "实测证据", weight: 31 },
      {
        pattern: /\d+(?:\.\d+)?\s*(?:%|万|千|倍|天|小时).{0,12}(?:提升|降低|用户|销量|好评|回购)?/,
        signal: "量化证据",
        weight: 32
      },
      { pattern: /认证|检测报告|专利|官方数据|权威|实验室/, signal: "权威背书", weight: 31 },
      { pattern: /好评|回购|复购|销量|卖了|用户反馈|评论区/, signal: "社会证明", weight: 27 }
    ]
  },
  {
    kind: "objection",
    label: "异议化解",
    segmentKind: "objection",
    whyItMatters: "提前回答观众不买、不会用或担心风险的理由。",
    objective: "解除价格、效果、门槛或适配性顾虑",
    patterns: [
      { pattern: /不用担心|别担心|不怕|完全不会|不会.{0,10}(?:伤|刺激|麻烦|复杂)/, signal: "直接消除顾虑", weight: 30 },
      { pattern: /即使|哪怕|就算.{0,20}(?:也|都)/, signal: "极端场景保证", weight: 24 },
      { pattern: /不是.{0,14}而是|看起来.{0,12}其实/, signal: "反转异议", weight: 27 },
      { pattern: /不挑|都能用|通用|零基础|新手也/, signal: "降低门槛", weight: 25 }
    ]
  },
  {
    kind: "offer",
    label: "价格利益",
    segmentKind: "offer",
    whyItMatters: "给出成交条件，并通过优惠或稀缺性推动决策。",
    objective: "说明价格、优惠、赠品或时效",
    patterns: [
      {
        pattern:
          /(?:¥|￥)\s?\d+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?\s*(?:元|块钱)|(?:原价|售价|现价|到手价|券后价?|活动价)\s*(?:¥|￥)?\s?\d+(?:\.\d{1,2})?\s*(?:元|块钱)?/i,
        signal: "明确价格",
        weight: 32
      },
      { pattern: /限时|优惠|满减|领券|折扣|秒杀|赠品|买一送一|到手价|立减/, signal: "促销利益", weight: 28 },
      { pattern: /只剩|最后\d+|今天截止|恢复原价|库存不多/, signal: "稀缺时效", weight: 29 }
    ]
  },
  {
    kind: "cta",
    label: "行动指令",
    segmentKind: "call-to-action",
    whyItMatters: "明确告诉观众下一步做什么，承接转化。",
    objective: "给出唯一、清楚的下一步行动",
    patterns: [
      { pattern: /点击|下单|购买|拍下|加购|领券|抢购|去看看/, signal: "购买指令", weight: 31 },
      { pattern: /评论区|评论.{0,8}(?:告诉|留下|打出)|私信|联系|咨询/, signal: "留资互动", weight: 28 },
      { pattern: /关注|收藏|点赞|转发/, signal: "互动指令", weight: 25 },
      { pattern: /链接|橱窗|主页|左下角|下方/, signal: "行动路径", weight: 22 }
    ]
  }
];

const pricePattern =
  /(?:¥|￥)\s?\d+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?\s*(?:元|块钱)|(?:原价|售价|现价|到手价|券后价?|活动价)\s*(?:¥|￥)?\s?\d+(?:\.\d{1,2})?\s*(?:元|块钱)?/gi;
const promotionPattern = /限时|优惠|满减|领券|折扣|买一送一|秒杀|福利|赠品|立减|到手价/g;
const actionPattern = /点击|下单|购买|拍下|收藏|关注|评论|私信|领取|领券|抢购|加购/g;
const fillerOnlyPattern = /^(?:嗯+|啊+|呃+|这个|那个|然后|就是|对吧|好吧|好的|那么|所以)+[，。！？,.!?\s]*$/;
const genericTitleWords = /(?:实测|测评|分享|推荐|好物|开箱|教程|合集|必看|别错过|视频|商品|产品)/g;
const productSuffixPattern =
  /[A-Za-z0-9\u4e00-\u9fff]{1,10}(?:面膜|洗面奶|精华液|防晒霜|粉底液|口红|眼霜|洗发水|护发素|耳机|手机|电脑|相机|充电器|吸尘器|吹风机|咖啡机|空气炸锅|保温杯|收纳盒|数据线|软件|课程|服务|工具|茶|粉|霜|液|膏|油|片|仪|机|器|锅|杯|鞋|衣|裤|包|灯|床|枕|桌|椅)/gi;

export function analyzeVideoInsightRules(input: VideoInsightRuleInput): InsightAnalysis {
  const text = normalizeText(input.transcript?.fullText || input.text);
  const units = buildTextUnits(text, input.transcript);
  const classified = classifyUnits(units, Boolean(input.transcript));
  const keyPoints = selectKeyPoints(classified);
  const sellingPointChains = buildSellingPointChains(classified);
  const hookAnalysis = analyzeHook(units, Boolean(input.transcript));
  const hook = hookAnalysis ? hookToSegment(hookAnalysis) : undefined;
  const segments = buildSegments(classified, hook);
  const keywords = extractKeywords(input.title || "", text);
  const brief = buildBrief(input.title || "", hookAnalysis, keyPoints, keywords);
  if (brief.contentMode === "opinion" || brief.contentMode === "story") {
    keywords.product = [];
    brief.productOrService = [];
  }
  const scriptBlueprint = buildBlueprint(classified, hookAnalysis, input.durationMs);
  const quality = assessQuality(text, units, input.transcript, classified, input.transcriptWarning);
  const missingElements = findMissingElements(keyPoints, hookAnalysis, brief.contentMode);
  const reusablePhrases = selectReusablePhrases(keyPoints, hookAnalysis);
  const risks = buildRisks(input.transcriptWarning, quality, keyPoints);
  const improvements = buildImprovements({
    brief,
    hook: hookAnalysis,
    quality,
    missingElements,
    sellingPointChains,
    risks
  });
  const finalOutput = buildFinalOutput(input.title || "", brief, scriptBlueprint, improvements, risks, quality);
  const changeLog = buildChangeLog(hookAnalysis, scriptBlueprint, finalOutput, quality);

  return {
    version: 3,
    source: "rules",
    generatedAt: new Date().toISOString(),
    hook,
    hookAnalysis,
    segments,
    keyPoints,
    sellingPointChains,
    brief,
    scriptBlueprint,
    quality,
    missingElements,
    improvements,
    finalOutput,
    changeLog,
    keywords,
    reusablePhrases,
    risks
  };
}

function buildSellingPointChains(points: ClassifiedPoint[]) {
  const benefits = points
    .filter((point) => point.kind === "promise" || point.kind === "benefit")
    .sort((left, right) => right.score - left.score);
  const chains = benefits.slice(0, 4).map((benefit) => {
    const mechanism = nearestPoint(points, benefit, ["feature", "mechanism"], 4);
    const proof = nearestPoint(points, benefit, ["proof"], 5, true);
    const score = clamp(
      Math.round(
        benefit.score * 0.6 +
          (mechanism?.score ?? benefit.score) * 0.18 +
          (proof?.score ?? benefit.score) * 0.22 +
          (mechanism ? 4 : 0) +
          (proof ? 7 : 0)
      ),
      0,
      100
    );
    return {
      claim: benefit.statement,
      featureOrMechanism: mechanism?.statement,
      userBenefit: benefit.statement,
      proof: proof?.statement,
      confidence: confidenceFromScore(score),
      score,
      evidence: uniqueEvidence([...(mechanism?.evidence ?? []), ...benefit.evidence, ...(proof?.evidence ?? [])])
    };
  });
  return chains.filter((chain, index) => chains.findIndex((candidate) => candidate.claim === chain.claim) === index);
}

function nearestPoint(
  points: ClassifiedPoint[],
  anchor: ClassifiedPoint,
  kinds: InsightKeyPointKind[],
  maxDistance: number,
  preferAfter = false
) {
  return points
    .filter(
      (point) =>
        kinds.includes(point.kind) &&
        point !== anchor &&
        Math.abs(point.unit.index - anchor.unit.index) <= maxDistance &&
        (!preferAfter || point.unit.index >= anchor.unit.index)
    )
    .sort((left, right) => {
      const distance = Math.abs(left.unit.index - anchor.unit.index) - Math.abs(right.unit.index - anchor.unit.index);
      return distance || right.score - left.score;
    })[0];
}

function uniqueEvidence(values: InsightEvidence[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = `${value.startSeconds ?? ""}:${value.endSeconds ?? ""}:${value.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildTextUnits(text: string, transcript?: VideoInsightTranscript["analysis"]) {
  const lowConfidence = transcript?.recognitionQuality?.lowConfidenceSegments ?? [];
  const source = transcript?.timeline.length
    ? transcript.timeline
    : [{ index: 1, text, startSeconds: undefined, endSeconds: undefined }];
  const units: TextUnit[] = [];

  for (const cue of source) {
    const parts = splitSemanticParts(cue.text);
    const totalCharacters = Math.max(
      1,
      parts.reduce((sum, part) => sum + part.length, 0)
    );
    let consumed = 0;
    for (const part of parts) {
      const cleaned = cleanSpeech(part);
      if (cleaned.length < 2 || fillerOnlyPattern.test(cleaned)) {
        consumed += part.length;
        continue;
      }
      const startRatio = consumed / totalCharacters;
      consumed += part.length;
      const endRatio = consumed / totalCharacters;
      const duration =
        cue.endSeconds !== undefined && cue.startSeconds !== undefined ? cue.endSeconds - cue.startSeconds : undefined;
      units.push({
        index: units.length + 1,
        sourceIndex: cue.index,
        text: cleaned,
        startSeconds: duration !== undefined ? cue.startSeconds! + duration * startRatio : cue.startSeconds,
        endSeconds: duration !== undefined ? cue.startSeconds! + duration * endRatio : cue.endSeconds,
        lowConfidence: lowConfidence.some(
          (item) =>
            item.index === cue.index ||
            timeRangesOverlap(item.startSeconds, item.endSeconds, cue.startSeconds, cue.endSeconds)
        )
      });
    }
  }

  return deduplicateUnits(units).slice(0, 160);
}

function splitSemanticParts(text: string) {
  const normalized = normalizeText(text);
  const parts = normalized.match(/[^。！？!?；;\n]+[。！？!?；;]?/g) ?? [];
  return parts.map((part) => part.trim()).filter(Boolean);
}

function cleanSpeech(text: string) {
  return text
    .replace(/^[，。！？,.!?\s]+|[\s]+$/g, "")
    .replace(/^(?:嗯+|啊+|呃+|然后呢|那么|就是说)[，,\s]*/g, "")
    .replace(/\s+/g, " ")
    .replace(/([！!？?。])\1+/g, "$1")
    .trim();
}

function deduplicateUnits(units: TextUnit[]) {
  const result: TextUnit[] = [];
  for (const unit of units) {
    const normalized = unit.text.replace(/[，。！？,.!?\s]/g, "").toLowerCase();
    const previous = result[result.length - 1];
    const previousNormalized = previous?.text.replace(/[，。！？,.!?\s]/g, "").toLowerCase();
    if (normalized && normalized === previousNormalized) continue;
    result.push({ ...unit, index: result.length + 1 });
  }
  return result;
}

function classifyUnits(units: TextUnit[], hasTranscript: boolean) {
  const classified: ClassifiedPoint[] = [];
  for (const unit of units) {
    for (const rule of classificationRules) {
      if (isNegatedClassification(rule.kind, unit.text)) continue;
      const matches = rule.patterns.filter(({ pattern }) => pattern.test(unit.text));
      if (!matches.length) continue;
      const signals = [...new Set(matches.map((match) => match.signal))];
      const strongest = Math.max(...matches.map((match) => match.weight));
      const extraSignalBonus = Math.min(16, (matches.length - 1) * 7);
      const concreteBonus = /\d|%|对比|因为|采用|报告|认证/.test(unit.text) ? 7 : 0;
      const lengthBonus = unit.text.length >= 8 && unit.text.length <= 60 ? 5 : unit.text.length > 100 ? -8 : 0;
      const reliabilityPenalty = unit.lowConfidence ? -18 : 0;
      const rawScore = clamp(
        Math.round(28 + strongest + extraSignalBonus + concreteBonus + lengthBonus + reliabilityPenalty),
        0,
        100
      );
      const score = Math.min(rawScore, hasTranscript ? (unit.startSeconds === undefined ? 64 : 100) : 52);
      if (score < 48) continue;
      classified.push({
        kind: rule.kind,
        label: rule.label,
        statement: unit.text,
        confidence: confidenceFromScore(score),
        score,
        whyItMatters: rule.whyItMatters,
        evidence: [toEvidence(unit, score, signals)],
        unit,
        segmentKind: rule.segmentKind,
        objective: rule.objective
      });
    }
  }
  return classified;
}

function isNegatedClassification(kind: InsightKeyPointKind, text: string) {
  if (kind === "offer") {
    return /(?:不是|并非|没有|不算|不属于).{0,5}(?:优惠|折扣|福利|赠品)|(?:优惠|折扣).{0,4}(?:没有|取消|结束)/.test(
      text
    );
  }
  if (kind === "cta") {
    return /(?:不建议|不要|不用|别).{0,8}(?:买|购买|下单|点击|拍下|加购|抢购)/.test(text);
  }
  if (kind === "proof") {
    return /(?:没有|并无|缺少).{0,6}(?:数据|认证|报告|好评|反馈)|(?:销量|好评|回购).{0,4}(?:不好|不高|很低)/.test(text);
  }
  if (kind === "promise" || kind === "benefit") {
    return /(?:不能|无法|并不能|没有).{0,10}(?:解决|改善|提升|减少|省|效果)/.test(text);
  }
  return false;
}

function selectKeyPoints(points: ClassifiedPoint[]) {
  const selected: ClassifiedPoint[] = [];
  const countByKind = new Map<InsightKeyPointKind, number>();
  for (const point of [...points].sort(
    (left, right) => right.score - left.score || left.unit.index - right.unit.index
  )) {
    const count = countByKind.get(point.kind) ?? 0;
    if (count >= 2) continue;
    if (selected.some((item) => item.statement === point.statement && item.kind === point.kind)) continue;
    selected.push(point);
    countByKind.set(point.kind, count + 1);
    if (selected.length >= 12) break;
  }
  return selected.map(({ unit: _unit, segmentKind: _segmentKind, objective: _objective, ...point }) => point);
}

function analyzeHook(units: TextUnit[], hasTranscript: boolean): InsightHookAnalysis | undefined {
  if (!units.length) return undefined;
  const openingUnits = units.filter(
    (unit, index) => index === 0 || (unit.startSeconds ?? Number.POSITIVE_INFINITY) < 5
  );
  const candidates = openingUnits.length ? openingUnits : [units[0]];
  const text = candidates
    .map((unit) => unit.text)
    .join(" ")
    .slice(0, 160);
  const mechanisms: string[] = [];
  let type: InsightHookType = "direct-topic";

  const hookRules: Array<{ type: InsightHookType; label: string; pattern: RegExp; mechanism: string; weight: number }> =
    [
      {
        type: "quote-led",
        label: "金句引入",
        pattern: /最近.{0,10}(?:刷到|看到|听到)|有句话|听过一句/,
        mechanism: "借一句话建立认知期待",
        weight: 28
      },
      {
        type: "story-led",
        label: "故事开场",
        pattern: /以前|曾经|那天|有一次|一开始|最开始/,
        mechanism: "用具体经历带入叙事",
        weight: 25
      },
      {
        type: "emotion-resonance",
        label: "情绪共鸣",
        pattern: /难|眼泪|委屈|崩溃|孤独|无助|撑不住|遥遥欲坠|摇摇欲坠/,
        mechanism: "用高情绪场景触发共鸣",
        weight: 27
      },
      {
        type: "pain-question",
        label: "痛点提问",
        pattern: /是不是|有没有|还在|总是|为什么|怎么|你也.{0,10}吗|[？?]/,
        mechanism: "用问题触发自我代入",
        weight: 30
      },
      {
        type: "result-first",
        label: "结果前置",
        pattern: /终于|直接|立刻|马上|只要|就能|告别|解决|提升|省下|变成/,
        mechanism: "先给结果再解释过程",
        weight: 25
      },
      {
        type: "curiosity-gap",
        label: "悬念缺口",
        pattern: /没想到|居然|秘密|真相|关键|很多人不知道|看到最后|到底/,
        mechanism: "制造信息缺口",
        weight: 22
      },
      {
        type: "contrarian",
        label: "反常识",
        pattern: /别再|不要再|不是.{0,12}而是|错了|误区|千万别|我劝你/,
        mechanism: "用反常识打断惯性",
        weight: 25
      },
      {
        type: "number-list",
        label: "数字清单",
        pattern: /\d+个|\d+步|\d+种|\d+秒|第[一二三四五\d]|只需\d+/,
        mechanism: "用数字降低理解成本",
        weight: 21
      },
      {
        type: "scarcity-offer",
        label: "利益稀缺",
        pattern: /限时|优惠|到手价|立减|只剩|最后|恢复原价/,
        mechanism: "用即时利益推动停留",
        weight: 22
      },
      {
        type: "social-proof",
        label: "结果证明",
        pattern: /卖了|销量|好评|回购|实测|认证|数据|用了?\d+/,
        mechanism: "先用证据建立可信度",
        weight: 23
      }
    ];
  let strongest: { type: InsightHookType; label: string; weight: number } = {
    type,
    label: "直接陈述",
    weight: 8
  };
  for (const rule of hookRules) {
    if (!rule.pattern.test(text)) continue;
    mechanisms.push(rule.mechanism);
    if (rule.weight > strongest.weight) strongest = rule;
  }
  type = strongest.type;
  const keyUnit = [...candidates]
    .map((unit) => ({
      unit,
      score:
        hookRules.reduce((sum, rule) => sum + (rule.pattern.test(unit.text) ? rule.weight : 0), 0) +
        (/\d|%|元|对比|结果/.test(unit.text) ? 9 : 0) +
        (/你|宝妈|学生|上班族|新手|小白|敏感肌|油皮|干皮|小个子|大码|微胖/.test(unit.text) ? 7 : 0) -
        (/^(?:哈喽|嗨|大家好|姐妹们|朋友们|今天给大家)/.test(unit.text) ? 15 : 0) -
        (unit.lowConfidence ? 18 : 0)
    }))
    .sort((left, right) => right.score - left.score || left.unit.index - right.unit.index)[0]!.unit;
  const concrete = /\d|%|元|对比|结果/.test(text);
  const audience = /你|宝妈|学生|上班族|新手|小白|敏感肌|油皮|干皮|小个子|大码|微胖/.test(text);
  const shortEnough = text.length >= 6 && text.length <= 70;
  const score = clamp(
    28 +
      strongest.weight +
      Math.min(18, (mechanisms.length - 1) * 7) +
      (concrete ? 9 : 0) +
      (audience ? 7 : 0) +
      (shortEnough ? 6 : -5) -
      (keyUnit.lowConfidence ? 18 : 0) -
      (hasTranscript ? 0 : 18),
    0,
    100
  );
  const strengths = uniqueStrings([
    ...mechanisms,
    ...(concrete ? ["包含数字、价格或结果等具体信息"] : []),
    ...(audience ? ["直接与目标观众建立关系"] : []),
    ...(shortEnough ? ["开场信息密度适中"] : [])
  ]);
  const weaknesses = uniqueStrings([
    ...(!mechanisms.length ? ["没有明显的冲突、结果或悬念机制"] : []),
    ...(!concrete ? ["缺少数字、结果或可验证细节"] : []),
    ...(!audience ? ["没有明确点名目标人群或其场景"] : []),
    ...(text.length > 70 ? ["开场信息偏长，核心利益点出现较慢"] : []),
    ...(!hasTranscript ? ["当前仅基于标题或描述，无法验证真实前五秒"] : []),
    ...(keyUnit.lowConfidence ? ["开场转写置信度偏低，需回看原视频"] : [])
  ]);
  return {
    type,
    label: strongest.label,
    text,
    confidence: confidenceFromScore(score),
    score,
    mechanisms,
    strengths,
    weaknesses,
    evidence: toEvidence(keyUnit, score, [...mechanisms, ...(keyUnit.lowConfidence ? ["低置信转写"] : [])])
  };
}

function hookToSegment(hook: InsightHookAnalysis): InsightSegment {
  return {
    kind: "hook",
    label: `开场钩子 · ${hook.label}`,
    text: hook.text,
    startSeconds: hook.evidence.startSeconds,
    endSeconds: hook.evidence.endSeconds,
    reason: hook.mechanisms.join("；") || "直接进入主题，未检测到强钩子机制。",
    confidence: hook.confidence,
    score: hook.score,
    signals: hook.evidence.signals
  };
}

function buildSegments(points: ClassifiedPoint[], hook?: InsightSegment) {
  const bestByRole = new Map<InsightSegmentKind, ClassifiedPoint>();
  for (const point of points) {
    const current = bestByRole.get(point.segmentKind);
    if (!current || point.score > current.score) bestByRole.set(point.segmentKind, point);
  }
  const segments: InsightSegment[] = hook ? [hook] : [];
  for (const point of [...bestByRole.values()].sort((left, right) => left.unit.index - right.unit.index)) {
    segments.push({
      kind: point.segmentKind,
      label: point.label,
      startSeconds: point.unit.startSeconds,
      endSeconds: point.unit.endSeconds,
      text: point.statement,
      reason: `${point.evidence[0].signals.join("、")}；${point.whyItMatters}`,
      confidence: point.confidence,
      score: point.score,
      signals: point.evidence[0].signals
    });
  }
  return segments;
}

function extractKeywords(title: string, text: string): InsightKeywordGroups {
  return {
    product: extractProducts(title, text),
    price: matchAll(text, pricePattern),
    promotion: matchAll(text, promotionPattern),
    action: matchAll(text, actionPattern)
  };
}

function extractProducts(title: string, text: string) {
  const titleCandidates = title
    .replace(/#[^\s#]+/g, " ")
    .replace(genericTitleWords, " ")
    .split(/[|｜·,，。:：!！?？\-—_\s]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && item.length <= 18);
  const suffixMatches = [...`${title} ${text}`.matchAll(productSuffixPattern)].map((match) =>
    match[0]
      .replace(/^.*(?:分享一款|推荐一款|介绍一款|这款|这个|这台|这瓶|这套|一款|一个)/, "")
      .replace(/^(?:今天|现在|大家|分享|推荐)+/, "")
  );
  return uniqueStrings([...titleCandidates, ...suffixMatches])
    .filter((item) => !/^(?:这个|那个|东西|商品|产品|真的|今天|大家)$/.test(item))
    .filter((item, index, values) => !values.slice(0, index).some((value) => value.includes(item)))
    .slice(0, 8);
}

function buildBrief(
  title: string,
  hook: InsightHookAnalysis | undefined,
  points: InsightKeyPoint[],
  keywords: InsightKeywordGroups
): InsightContentBrief {
  const audience = points.filter((point) => point.kind === "audience").map((point) => concise(point.statement, 36));
  const promise = bestPoint(points, ["promise", "benefit"]);
  const proof = bestPoint(points, ["proof"]);
  const offer = bestPoint(points, ["offer"]);
  const viewpoint = bestPoint(points, ["viewpoint", "resolution", "golden-line"]);
  const conflict = bestPoint(points, ["conflict", "pain"]);
  const contentMode = inferContentMode(points);
  const product = keywords.product[0] || cleanTitle(title) || "该产品/服务";
  const conversionGoal = inferConversionGoal(points);
  const contentAngle =
    contentMode === "opinion"
      ? `${hook?.label || "观点切入"}${conflict ? " + 情绪冲突" : ""}${viewpoint ? " + 认知收束" : ""}`
      : hook
        ? `${hook.label}${proof ? " + 证据支撑" : ""}${offer ? " + 成交利益" : ""}`
        : "信息不足，未识别出明确内容角度";
  const oneSentenceSummary =
    contentMode === "opinion" && viewpoint
      ? `围绕“${concise(cleanTitle(title) || "当前话题", 30)}”，以${hook?.label || "观点陈述"}切入${conflict ? `，通过“${concise(conflict.statement, 38)}”制造情绪张力` : ""}，最终收束到“${concise(viewpoint.statement, 52)}”。`
      : promise
        ? `围绕${product}，以${hook?.label || "直接陈述"}切入，核心强调“${concise(promise.statement, 52)}”${proof ? `，并用“${concise(proof.statement, 36)}”增强可信度` : ""}${offer ? `，最后以“${concise(offer.statement, 32)}”承接转化` : ""}。`
        : `围绕${product}展开，但当前文本没有提取到证据充分的核心观点或结果承诺。`;
  return {
    oneSentenceSummary,
    contentMode,
    productOrService: keywords.product,
    targetAudience: uniqueStrings(audience).slice(0, 5),
    coreMessage: viewpoint?.statement || promise?.statement,
    corePromise: promise?.statement,
    primaryConversionGoal: conversionGoal,
    contentAngle
  };
}

function buildBlueprint(
  points: ClassifiedPoint[],
  hook: InsightHookAnalysis | undefined,
  durationMs?: number
): InsightScriptBlueprint {
  const bestByRole = new Map<InsightSegmentKind, ClassifiedPoint>();
  for (const point of points) {
    const current = bestByRole.get(point.segmentKind);
    if (!current || point.score > current.score) bestByRole.set(point.segmentKind, point);
  }
  const stages = [...bestByRole.values()]
    .sort((left, right) => left.unit.index - right.unit.index)
    .map((point, index) => ({
      order: index + (hook ? 2 : 1),
      role: point.segmentKind,
      label: point.label,
      objective: point.objective,
      summary: point.statement,
      confidence: point.confidence,
      score: point.score,
      evidence: point.evidence
    }));
  if (hook) {
    stages.unshift({
      order: 1,
      role: "hook",
      label: `开场钩子 · ${hook.label}`,
      objective: "在前五秒建立相关性、结果预期或信息缺口",
      summary: hook.text,
      confidence: hook.confidence,
      score: hook.score,
      evidence: [hook.evidence]
    });
  }
  const conversion = stages.find((stage) => stage.role === "offer" || stage.role === "call-to-action");
  return {
    formula: stages.length ? stages.map((stage) => stage.label).join(" → ") : "未识别出可靠脚本结构",
    stages,
    pacing: {
      hookEndSeconds: hook?.evidence.endSeconds,
      conversionStartSeconds: conversion?.evidence[0]?.startSeconds,
      totalSeconds: durationMs && durationMs > 0 ? Math.round(durationMs / 100) / 10 : undefined
    }
  };
}

function assessQuality(
  text: string,
  units: TextUnit[],
  transcript: VideoInsightTranscript["analysis"] | undefined,
  points: ClassifiedPoint[],
  warning?: string
) {
  const timedCount = units.filter((unit) => unit.startSeconds !== undefined && unit.endSeconds !== undefined).length;
  const lowConfidenceCount = units.filter((unit) => unit.lowConfidence).length;
  const timedCueRatio = units.length ? timedCount / units.length : 0;
  const lowConfidenceCueRatio = units.length ? lowConfidenceCount / units.length : 0;
  const distinctRoles = new Set(points.map((point) => point.kind)).size;
  let score = transcript ? 42 : 18;
  score += Math.min(20, Math.floor(text.length / 30));
  score += Math.round(timedCueRatio * 14);
  score += Math.min(16, distinctRoles * 2);
  score -= Math.round(lowConfidenceCueRatio * 30);
  if (warning) score -= 12;
  score = clamp(score, 0, 100);
  const reasons = uniqueStrings([
    transcript ? "已使用原始转写文本" : "仅基于标题或描述，无法还原真实口播结构",
    timedCueRatio >= 0.8 ? "大部分证据具有时间定位" : "部分证据缺少时间定位",
    lowConfidenceCueRatio > 0.2 ? "较多转写片段被识别为低置信" : "未发现大面积低置信转写",
    text.length < 80 ? "有效文本偏短，关键点可能不完整" : "文本长度可支持结构拆解",
    distinctRoles < 3 ? "可识别的脚本功能环节较少" : `识别到 ${distinctRoles} 类脚本功能环节`,
    ...(warning ? [warning] : [])
  ]);
  return {
    score,
    level: confidenceFromScore(score),
    transcriptAvailable: Boolean(transcript),
    timedCueRatio: roundRatio(timedCueRatio),
    lowConfidenceCueRatio: roundRatio(lowConfidenceCueRatio),
    reasons
  };
}

function findMissingElements(
  points: InsightKeyPoint[],
  hook: InsightHookAnalysis | undefined,
  contentMode: InsightContentBrief["contentMode"]
) {
  const kinds = new Set(points.map((point) => point.kind));
  if (contentMode === "opinion" || contentMode === "story") {
    return [
      ...(!hook || hook.score < 60 ? ["开场缺少具体情绪、冲突、金句或故事期待"] : []),
      ...(!kinds.has("context") ? ["缺少清晰的话题背景或故事起点"] : []),
      ...(!kinds.has("conflict") && !kinds.has("pain") ? ["缺少推动观看的情绪冲突或现实落差"] : []),
      ...(!kinds.has("viewpoint") && !kinds.has("golden-line") ? ["核心观点不够明确，缺少可复述的判断句"] : []),
      ...(!kinds.has("turning-point") ? ["前后认知缺少明确转折"] : []),
      ...(!kinds.has("resolution") ? ["结尾缺少能带走的态度、结论或行动主张"] : [])
    ];
  }
  if (contentMode === "knowledge") {
    return [
      ...(!hook || hook.score < 60 ? ["开场缺少明确问题、结果或知识缺口"] : []),
      ...(!kinds.has("mechanism") && !kinds.has("feature") ? ["缺少核心原理或方法解释"] : []),
      ...(!kinds.has("demo") && !kinds.has("proof") ? ["缺少示例、演示、数据或对比验证"] : []),
      ...(!kinds.has("resolution") && !kinds.has("cta") ? ["结尾缺少总结或下一步行动"] : [])
    ];
  }
  return [
    ...(!hook || hook.score < 60 ? ["开场缺少明确的痛点、结果或悬念机制"] : []),
    ...(!kinds.has("audience") ? ["未明确点名目标人群或典型使用场景"] : []),
    ...(!kinds.has("promise") && !kinds.has("benefit") ? ["未提取到清晰的用户结果承诺"] : []),
    ...(!kinds.has("mechanism") && !kinds.has("feature") ? ["缺少支撑卖点的功能、成分或实现机制"] : []),
    ...(!kinds.has("proof") ? ["缺少实测、数据、对比、认证或用户反馈证明"] : []),
    ...(!kinds.has("offer") ? ["未说明明确价格、优惠或成交条件"] : []),
    ...(!kinds.has("cta") ? ["缺少清晰且唯一的下一步行动指令"] : [])
  ];
}

function buildImprovements(input: {
  brief: InsightContentBrief;
  hook?: InsightHookAnalysis;
  quality: InsightAnalysis["quality"];
  missingElements: string[];
  sellingPointChains: InsightAnalysis["sellingPointChains"];
  risks: string[];
}) {
  const suggestions: InsightImprovementSuggestion[] = [];
  const push = (suggestion: Omit<InsightImprovementSuggestion, "id">) => {
    suggestions.push({ id: `improvement-${suggestions.length + 1}`, ...suggestion });
  };

  if (!input.hook || input.hook.score < 68 || input.hook.weaknesses.length) {
    push({
      priority: !input.hook || input.hook.score < 55 ? "critical" : "high",
      category: "hook",
      title: "把核心冲突或结果前置到前 3 秒",
      problem: input.hook?.weaknesses.join("；") || "当前开场没有形成明确的停留理由。",
      recommendation:
        input.brief.contentMode === "opinion" || input.brief.contentMode === "story"
          ? "删掉泛化问候，直接抛出最有冲突的判断、情绪场景或金句，再补充背景。"
          : "用“目标人群 + 具体痛点/结果 + 一个可验证细节”重写第一句，控制在 25 字左右。",
      rewriteExample: buildHookRewriteExample(input.brief),
      expectedImpact: "提高前 3–5 秒的信息密度和停留率。",
      evidence: input.hook?.evidence
    });
  }

  if (input.quality.level === "low") {
    push({
      priority: "critical",
      category: "transcription",
      title: "先提高转写证据质量再定稿",
      problem: input.quality.reasons.join("；"),
      recommendation: "回看低置信时间段，修正错字、数字、品牌名和关键金句，然后重新执行规则拆解。",
      expectedImpact: "避免基于错误口播生成错误卖点、价格或观点结论。"
    });
  }

  for (const missing of input.missingElements) {
    push(missingElementSuggestion(missing, input.brief));
  }

  for (const chain of input.sellingPointChains.filter((item) => !item.proof)) {
    push({
      priority: "high",
      category: "evidence",
      title: "为核心卖点补充可验证证明",
      problem: `“${concise(chain.claim, 48)}”目前只有主张，没有紧邻的数据、对比、实测或第三方依据。`,
      recommendation: "在卖点之后立即增加同场景对比、真实使用过程、量化结果或来源清晰的认证信息。",
      rewriteExample: `“${concise(chain.claim, 36)}。接着展示【真实测试条件】，并说明【可核验结果】。”`,
      expectedImpact: "降低观众怀疑，让卖点从口号变成可信理由。",
      evidence: chain.evidence[0]
    });
  }

  const complianceRisks = input.risks.filter((risk) => /^(?:检测到|属于高风险)/.test(risk));
  if (complianceRisks.length) {
    push({
      priority: "critical",
      category: "compliance",
      title: "重写高风险承诺并补充事实来源",
      problem: complianceRisks.join("；"),
      recommendation: "删除绝对化、保证性、医疗功效或无来源排名，改成有条件、可验证的客观描述。",
      rewriteExample: "将“保证/绝对有效”改为“在【真实条件】下观察到【客观结果】，实际效果因人而异”。",
      expectedImpact: "降低平台审核、广告合规和用户信任风险。"
    });
  }

  return suggestions.slice(0, 14);
}

function buildHookRewriteExample(brief: InsightContentBrief) {
  const message = concise(brief.coreMessage || brief.corePromise || "最重要的结果或观点", 46);
  if (brief.contentMode === "opinion" || brief.contentMode === "story") {
    return `“${message}”——先说结论，再用后面的经历或冲突解释为什么。`;
  }
  const audience = concise(brief.targetAudience[0] || "目标人群", 20);
  return `“${audience}如果正在被【具体痛点】困扰，先看这个结果：${message}。”`;
}

function missingElementSuggestion(
  missing: string,
  brief: InsightContentBrief
): Omit<InsightImprovementSuggestion, "id"> {
  if (/人群|场景/.test(missing)) {
    return {
      priority: "high",
      category: "audience",
      title: "明确点名目标人群和触发场景",
      problem: missing,
      recommendation: "在开场后补充“谁在什么情况下会遇到什么问题”，不要只说“大家”“所有人”。",
      rewriteExample: "“如果你是【目标人群】，每次在【具体场景】都会遇到【具体问题】，这段一定要看完。”",
      expectedImpact: "提升相关性，让真正的目标用户更快产生代入。"
    };
  }
  if (/证明|示例|演示|数据|对比|验证/.test(missing)) {
    return {
      priority: "high",
      category: "evidence",
      title: "补充紧邻主张的真实证据",
      problem: missing,
      recommendation: "补充真实前后对比、操作演示、用户反馈、测试条件或来源清晰的数据；没有证据时不要写确定性结论。",
      rewriteExample: "“在【测试条件】下实测【时间/样本】，结果从【之前】变为【之后】。”",
      expectedImpact: "提高可信度和说服力，减少空泛感。"
    };
  }
  if (/价格|优惠|成交条件/.test(missing)) {
    return {
      priority: "medium",
      category: "conversion",
      title: "把真实报价和活动条件说完整",
      problem: missing,
      recommendation: "明确原价、实际到手价、优惠门槛、赠品、库存和截止时间，并在发布前再次核对。",
      rewriteExample: "“原价【金额】，满足【真实条件】后到手【金额】，活动到【真实截止时间】。”",
      expectedImpact: "减少决策阻力，避免用户因价格信息不完整而流失。"
    };
  }
  if (/行动指令|下一步行动|CTA/.test(missing)) {
    return {
      priority: "high",
      category: "conversion",
      title: "结尾只保留一个明确行动",
      problem: missing,
      recommendation: "说明观众下一步要做什么、去哪里做、为什么现在做；避免同时要求点赞、评论、关注和购买。",
      rewriteExample: "“如果你需要【结果】，现在点击【真实入口】完成【唯一动作】。”",
      expectedImpact: "缩短转化路径，提高行动完成率。"
    };
  }
  if (/承诺|观点|判断句|原理|机制/.test(missing)) {
    return {
      priority: "high",
      category: "clarity",
      title: brief.contentMode === "opinion" ? "凝练一个可复述的中心观点" : "把功能翻译成明确结果",
      problem: missing,
      recommendation:
        brief.contentMode === "opinion"
          ? "用一句完整判断回答“这段内容到底想让观众相信什么”，后续所有例子都服务于这句话。"
          : "用“通过什么机制，为谁解决什么问题，得到什么结果”表达核心卖点。",
      rewriteExample:
        brief.contentMode === "opinion"
          ? "“真正重要的不是【表面现象】，而是【核心观点】。”"
          : "“通过【真实功能/机制】，帮助【目标人群】在【场景】获得【可验证结果】。”",
      expectedImpact: "让观众能准确复述内容核心，而不是只记住零散信息。"
    };
  }
  if (/开场/.test(missing)) {
    return {
      priority: "critical",
      category: "hook",
      title: "重写前 3 秒停留理由",
      problem: missing,
      recommendation: "第一句直接使用具体问题、反常识结论、结果或情绪冲突，删除问候和自我介绍。",
      rewriteExample: buildHookRewriteExample(brief),
      expectedImpact: "提高开场停留和后续信息到达率。"
    };
  }
  return {
    priority: "medium",
    category: "structure",
    title: "补齐脚本推进环节",
    problem: missing,
    recommendation: "在不编造事实的前提下补充背景、冲突、转折或结论，并让每一段只承担一个功能。",
    rewriteExample: "按“背景 → 冲突 → 核心结论 → 证据/例子 → 收束”补充缺失部分。",
    expectedImpact: "减少跳跃感，让脚本逻辑更顺畅。"
  };
}

function buildFinalOutput(
  title: string,
  brief: InsightContentBrief,
  blueprint: InsightScriptBlueprint,
  improvements: InsightImprovementSuggestion[],
  risks: string[],
  quality: InsightAnalysis["quality"]
): InsightAnalysis["finalOutput"] {
  const roleOrder = optimizedRoleOrder(brief.contentMode);
  const stageByRole = new Map(blueprint.stages.map((stage) => [stage.role, stage]));
  const sections: InsightAnalysis["finalOutput"]["sections"] = [];
  const seenText = new Set<string>();

  for (const [roleIndex, role] of roleOrder.entries()) {
    const stage = stageByRole.get(role);
    if (!stage || seenText.has(stage.summary)) continue;
    const laterRoleUsesSameEvidence = roleOrder
      .slice(roleIndex + 1)
      .some((laterRole) => stageByRole.get(laterRole)?.summary === stage.summary);
    if (laterRoleUsesSameEvidence) continue;
    const originalIndex = blueprint.stages.findIndex((item) => item.role === role);
    const rewrittenText = normalizeFinalLine(stage.summary);
    const expressionChanged =
      rewrittenText.replace(/[。！？!?]$/, "") !== stage.summary.trim().replace(/[。！？!?]$/, "");
    seenText.add(stage.summary);
    sections.push({
      role,
      label: stage.label,
      text: rewrittenText,
      origin: expressionChanged ? "rewritten" : originalIndex === sections.length ? "original" : "reordered",
      evidence: stage.evidence[0]
    });
  }

  for (const placeholder of requiredPlaceholders(brief.contentMode, new Set(sections.map((section) => section.role)))) {
    sections.push(placeholder);
  }

  const needsEvidence =
    sections.some((section) => section.origin === "placeholder") ||
    improvements.some(
      (item) => item.priority === "critical" && ["evidence", "compliance", "transcription"].includes(item.category)
    );
  const status = !quality.transcriptAvailable ? "needs-transcript" : needsEvidence ? "needs-evidence" : "ready";
  const verificationNotes = uniqueStrings([
    ...(!quality.transcriptAvailable ? ["当前没有视频转写，最终稿仅是结构示例，不能直接发布。"] : []),
    ...(needsEvidence ? ["最终稿包含【待补充】内容或关键问题，处理完成后才能发布。"] : []),
    ...risks.filter((risk) => /核对|检测到|高风险|低|来源|时效/.test(risk)),
    ...improvements.filter((item) => item.priority === "critical").map((item) => `发布前必须处理：${item.title}`)
  ]);
  return {
    source: "rules",
    status,
    title: title.trim() || "优化版短视频脚本",
    strategy: finalStrategy(brief.contentMode),
    fullScript: sections.map((section) => section.text).join("\n"),
    sections,
    verificationNotes
  };
}

function optimizedRoleOrder(mode: InsightContentBrief["contentMode"]): InsightSegmentKind[] {
  if (mode === "opinion") return ["hook", "context", "conflict", "viewpoint", "turning-point", "resolution"];
  if (mode === "story") return ["hook", "context", "conflict", "turning-point", "viewpoint", "resolution"];
  if (mode === "knowledge")
    return ["hook", "context", "pain-point", "mechanism", "demo", "proof", "viewpoint", "resolution", "call-to-action"];
  if (mode === "commerce")
    return [
      "hook",
      "audience",
      "pain-point",
      "selling-point",
      "mechanism",
      "demo",
      "proof",
      "objection",
      "offer",
      "call-to-action"
    ];
  return [
    "hook",
    "context",
    "conflict",
    "pain-point",
    "viewpoint",
    "selling-point",
    "mechanism",
    "proof",
    "turning-point",
    "resolution",
    "call-to-action"
  ];
}

function requiredPlaceholders(
  mode: InsightContentBrief["contentMode"],
  existing: Set<InsightSegmentKind>
): InsightAnalysis["finalOutput"]["sections"] {
  const required: Array<{ role: InsightSegmentKind; label: string; text: string }> =
    mode === "commerce"
      ? [
          { role: "hook", label: "开场钩子", text: "【待补充：前 3 秒的具体痛点、结果或冲突】" },
          { role: "proof", label: "可信证明", text: "【待补充：真实实测、对比、数据或用户反馈】" },
          { role: "offer", label: "真实报价", text: "【待补充：当前真实价格、优惠条件和截止时间】" },
          { role: "call-to-action", label: "行动指令", text: "【待补充：唯一行动、真实入口和行动理由】" }
        ]
      : mode === "opinion" || mode === "story"
        ? [
            { role: "hook", label: "开场钩子", text: "【待补充：一句有冲突或情绪价值的开场】" },
            { role: "conflict", label: "核心冲突", text: "【待补充：一个具体场景或现实落差】" },
            { role: "viewpoint", label: "核心观点", text: "【待补充：一句可复述的中心判断】" },
            { role: "resolution", label: "观点收束", text: "【待补充：观众能带走的结论或行动主张】" }
          ]
        : mode === "knowledge"
          ? [
              { role: "hook", label: "开场钩子", text: "【待补充：明确问题、结果或知识缺口】" },
              { role: "mechanism", label: "核心原理", text: "【待补充：准确的方法、机制或原因】" },
              { role: "proof", label: "示例验证", text: "【待补充：真实示例、演示或数据验证】" }
            ]
          : [];
  return required
    .filter((item) => !existing.has(item.role))
    .map((item) => ({ ...item, origin: "placeholder" as const }));
}

function finalStrategy(mode: InsightContentBrief["contentMode"]) {
  return {
    commerce: "按“相关性 → 痛点 → 结果 → 机制 → 证明 → 报价 → 单一行动”重排，所有事实沿用原始证据。",
    opinion: "按“金句/情绪钩子 → 现实冲突 → 核心观点 → 认知转折 → 共鸣收束”压缩重复表达。",
    knowledge: "按“问题/结果 → 原理 → 步骤 → 示例验证 → 总结”重排，优先保留可验证信息。",
    story: "按“悬念 → 背景 → 冲突升级 → 转折 → 主题收束”重排，删除不推进情节的句子。",
    unknown: "按证据强度保留关键句并减少重复；内容信息不足时明确标记待补充项。"
  }[mode];
}

function normalizeFinalLine(value: string) {
  const raw = value.replace(/\s+/g, " ").trim();
  const cleaned = raw
    .replace(/^(?:嗯+|啊+|呃+|哈喽|嗨|大家好|姐妹们|朋友们)[，,。！!\s]*/g, "")
    .replace(/^(?:然后呢|那么|就是说)[，,\s]*/g, "")
    .trim();
  const line = cleaned || raw;
  return /[。！？!?】]$/.test(line) ? line : `${line}。`;
}

function buildChangeLog(
  hook: InsightHookAnalysis | undefined,
  blueprint: InsightScriptBlueprint,
  finalOutput: InsightAnalysis["finalOutput"],
  quality: InsightAnalysis["quality"]
): InsightAnalysis["changeLog"] {
  const changes: InsightAnalysis["changeLog"] = [];
  const finalHook = finalOutput.sections.find((section) => section.role === "hook");
  changes.push({
    area: "开场钩子",
    before: hook?.text || "未识别到有效钩子",
    after: finalHook?.text || "已标记为需要重写",
    reason: "优先保留最有冲突、结果或情绪价值的开场证据。"
  });
  changes.push({
    area: "脚本顺序",
    before: blueprint.formula,
    after: finalOutput.sections.map((section) => section.label).join(" → ") || "待重建",
    reason: "按内容类型的最佳信息路径重新排序，而不是机械沿用原口播顺序。"
  });
  const placeholders = finalOutput.sections.filter((section) => section.origin === "placeholder");
  for (const section of finalOutput.sections.filter((item) => item.origin === "rewritten")) {
    changes.push({
      area: `${section.label}表达`,
      before: section.evidence?.text || "原口播",
      after: section.text,
      reason: "删除问候、口癖或无信息开场，并统一标点，不新增事实。"
    });
  }
  for (const section of placeholders) {
    changes.push({
      area: section.label,
      before: "原脚本未识别到可靠内容",
      after: section.text,
      reason: "明确缺口和所需事实类型，避免规则引擎编造内容。"
    });
  }
  if (quality.lowConfidenceCueRatio > 0) {
    changes.push({
      area: "证据可靠性",
      before: `${Math.round(quality.lowConfidenceCueRatio * 100)}% 的分析片段命中低置信转写`,
      after: "相关结论已降权，并列入发布前核对项",
      reason: "避免把识别错误的数字、品牌名或金句写入最终稿。"
    });
  }
  return changes;
}

function selectReusablePhrases(points: InsightKeyPoint[], hook?: InsightHookAnalysis) {
  const preferredKinds = new Set<InsightKeyPointKind>([
    "promise",
    "benefit",
    "proof",
    "objection",
    "cta",
    "viewpoint",
    "turning-point",
    "resolution",
    "golden-line"
  ]);
  return uniqueStrings([
    ...(hook && hook.score >= 60 ? [hook.text] : []),
    ...points.filter((point) => preferredKinds.has(point.kind) && point.score >= 60).map((point) => point.statement)
  ]).slice(0, 6);
}

function buildRisks(warning: string | undefined, quality: InsightAnalysis["quality"], points: InsightKeyPoint[]) {
  const hasClaims = points.some((point) => point.kind === "promise" || point.kind === "proof");
  const hasOffer = points.some((point) => point.kind === "offer");
  const claimsText = points.map((point) => point.statement).join(" ");
  return uniqueStrings([
    ...(warning ? [warning] : []),
    ...(quality.level === "low" ? ["当前证据充分度较低，关键结论需回看原视频核对。"] : []),
    ...(hasClaims ? ["效果、数据、认证和对比类表述必须核验来源，避免绝对化承诺。"] : []),
    ...(/百分百|100%|绝对|永久|全网第一|最低价|最[好强快]|保证/.test(claimsText)
      ? ["检测到绝对化、排名或保证性表述，发布前应删除或补充可验证依据。"]
      : []),
    ...(/治愈|根治|降糖|降压|瘦\d+斤|减肥|治疗|药效/.test(claimsText)
      ? ["检测到医疗健康或减重功效表述，属于高风险内容，需按平台和广告法规专项审核。"]
      : []),
    ...(hasOffer ? ["价格、优惠、库存和活动时效需在复用前重新核对。"] : []),
    "复用原话或素材前请核对版权、品牌规范和平台广告规则。"
  ]);
}

function inferContentMode(points: InsightKeyPoint[]): InsightContentBrief["contentMode"] {
  const kinds = new Set(points.map((point) => point.kind));
  const commerceScore = ["offer", "cta", "promise", "feature", "benefit"].filter((kind) =>
    kinds.has(kind as InsightKeyPointKind)
  ).length;
  const opinionScore = ["viewpoint", "golden-line", "resolution", "turning-point"].filter((kind) =>
    kinds.has(kind as InsightKeyPointKind)
  ).length;
  if (commerceScore >= 2 && (kinds.has("offer") || kinds.has("cta"))) return "commerce";
  if (opinionScore >= 2) return "opinion";
  if (kinds.has("context") && kinds.has("conflict")) return "story";
  if (kinds.has("mechanism") || kinds.has("demo") || kinds.has("proof")) return "knowledge";
  return "unknown";
}

function inferConversionGoal(points: InsightKeyPoint[]): InsightContentBrief["primaryConversionGoal"] {
  const ctaText = points
    .filter((point) => point.kind === "cta")
    .map((point) => point.statement)
    .join(" ");
  if (/下单|购买|拍下|加购|领券|抢购|橱窗|链接/.test(ctaText)) return "purchase";
  if (/私信|联系|咨询|评论.{0,8}(?:留下|告诉)/.test(ctaText)) return "lead";
  if (/关注/.test(ctaText)) return "follow";
  if (/评论|点赞|收藏|转发/.test(ctaText)) return "engagement";
  return "unknown";
}

function bestPoint(points: InsightKeyPoint[], kinds: InsightKeyPointKind[]) {
  return points.filter((point) => kinds.includes(point.kind)).sort((left, right) => right.score - left.score)[0];
}

function toEvidence(unit: TextUnit, score: number, signals: string[]): InsightEvidence {
  return {
    text: unit.text,
    startSeconds: unit.startSeconds,
    endSeconds: unit.endSeconds,
    score,
    signals
  };
}

function confidenceFromScore(score: number): InsightConfidence {
  return score >= 75 ? "high" : score >= 55 ? "medium" : "low";
}

function matchAll(text: string, pattern: RegExp) {
  pattern.lastIndex = 0;
  return uniqueStrings([...text.matchAll(pattern)].map((match) => match[0].trim())).slice(0, 10);
}

function normalizeText(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanTitle(title: string) {
  return title
    .replace(/#[^\s#]+/g, " ")
    .replace(genericTitleWords, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 30);
}

function concise(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}…` : normalized;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function timeRangesOverlap(leftStart?: number, leftEnd?: number, rightStart?: number, rightEnd?: number) {
  if (leftStart === undefined || leftEnd === undefined || rightStart === undefined || rightEnd === undefined)
    return false;
  return leftStart < rightEnd && rightStart < leftEnd;
}

function roundRatio(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
