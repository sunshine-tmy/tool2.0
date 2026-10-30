/**
 * 中文模块说明：测试 apps/web/src/features/speech/shared/chatterbox-segment-parser.test.ts 中的稳定行为、边界条件和回归场景
 */
import { describe, expect, it } from "vitest";
import { normalizeSpeechSegmentText, parseChatterboxSegments } from "./chatterbox-segment-parser";

describe("parseChatterboxSegments", () => {
  it("cleans copied Markdown before detecting formatted numbers, keeping bilingual paragraphs", () => {
    expect(
      parseChatterboxSegments(
        "```markdown\r\n> ### **1.** **Hello**, _Tang Tea_!\\\r\n> **你好，Tang Tea！**\r\n\r\n> **2. Thank you.**\r\n> __谢谢。__\r\n```"
      )
    ).toEqual([
      { text: "Hello, Tang Tea!", referenceTranslation: "你好，Tang Tea！" },
      { text: "Thank you.", referenceTranslation: "谢谢。" }
    ]);
  });

  it("normalizes word-processor spaces, invisible separators, Unicode line breaks and full-width numbering", () => {
    expect(
      parseChatterboxSegments("\ufeff１．\u200bHello\u00a0there.\u2028你好。\u2029（２） Thank\u202fyou.\r谢谢。\u2060")
    ).toEqual([
      { text: "Hello there.", referenceTranslation: "你好。" },
      { text: "Thank you.", referenceTranslation: "谢谢。" }
    ]);
  });

  it("cleans literal inline HTML and entities without retaining styles or treating them as source speech", () => {
    expect(
      parseChatterboxSegments(
        '<p class="copy"><strong>1. Hello &amp; thank you.</strong><br><span style="color:red">你好，谢谢。</span></p><p><b>2. Goodbye.</b><br/>再见。</p>'
      )
    ).toEqual([
      { text: "Hello & thank you.", referenceTranslation: "你好，谢谢。" },
      { text: "Goodbye.", referenceTranslation: "再见。" }
    ]);
  });

  it("preserves meaningful punctuation, URLs, intraword underscores, joined emoji and paste-boundary whitespace", () => {
    const source = "  **Tang_Tea** #TangTea https://example.com/a_b 2*3*4 RM10.50 👩‍👩‍👧‍👦\n\n";
    const clean = "  Tang_Tea #TangTea https://example.com/a_b 2*3*4 RM10.50 👩‍👩‍👧‍👦\n\n";
    expect(normalizeSpeechSegmentText(source)).toBe(clean);
    expect(normalizeSpeechSegmentText(clean)).toBe(clean);
    expect(parseChatterboxSegments("  \r\n\u200b")).toEqual([]);
  });

  it("parses the full numbered Markdown source and Chinese translation example", () => {
    // 真实复制文本包含 Markdown 加粗、HTML 空格实体和反斜杠换行，覆盖最常见的粘贴格式。
    const input = `1. **Nak minum teh herba, kena sediakan semua ni ke?**\\
   &#x20;想喝草本茶，就要准备这么多东西吗？&#x20;
2. **Macam-macam bahan nak cari satu-satu.**\\
   &#x20;各种材料都要一样一样去找。&#x20;
3. **Kalau nak sediakan sendiri, memang agak renyah.**\\
   &#x20;如果要自己准备，确实有点麻烦。&#x20;
4. **Tapi sebenarnya, ada cara lagi mudah.**\\
   &#x20;但其实，还有更简单的方法。&#x20;
5. **10 ramuan herba pilihan dah ada dalam satu uncang piramid.**\\
   &#x20;10种精选草本已经装进一个三角茶包里。&#x20;
6. **Masukkan satu uncang, tambah air panas, tunggu sekejap, terus boleh minum.**\\
   &#x20;放一个茶包，加上热水，稍微泡一会儿，就可以喝了。&#x20;
7. **Ini Tang Tea Ginseng Ten Treasures Tea.**\\
   &#x20;这是 Tang Tea 人参十宝茶。&#x20;
8. **Satu pek ada 30 uncang.**\\
   &#x20;一袋有30个茶包。&#x20;
9. **Senang untuk office atau rumah.**\\
   &#x20;在办公室或者家里都很方便。&#x20;
10. **Nak cuba?**\\
    &#x20;想试试吗？&#x20;
11. **Tengok dekat troli kuning.**\\
    &#x20;去小黄车看看。&#x20;`;

    const segments = parseChatterboxSegments(input);

    expect(segments).toHaveLength(11);
    expect(segments[0]).toEqual({
      text: "Nak minum teh herba, kena sediakan semua ni ke?",
      referenceTranslation: "想喝草本茶，就要准备这么多东西吗？"
    });
    expect(segments[5]).toEqual({
      text: "Masukkan satu uncang, tambah air panas, tunggu sekejap, terus boleh minum.",
      referenceTranslation: "放一个茶包，加上热水，稍微泡一会儿，就可以喝了。"
    });
    expect(segments[10]).toEqual({
      text: "Tengok dekat troli kuning.",
      referenceTranslation: "去小黄车看看。"
    });
  });

  it("supports parenthesized numbering and source-only segments", () => {
    expect(parseChatterboxSegments("(1) First line.\n(2) Second line.")).toEqual([
      { text: "First line.", referenceTranslation: "" },
      { text: "Second line.", referenceTranslation: "" }
    ]);
  });

  it("falls back to blank-line separated bilingual blocks", () => {
    expect(parseChatterboxSegments("Hello there.\n你好。\n\nThank you.\n谢谢。")).toEqual([
      { text: "Hello there.", referenceTranslation: "你好。" },
      { text: "Thank you.", referenceTranslation: "谢谢。" }
    ]);
  });

  it("restores segments from alternating bilingual lines when copied list markers are missing", () => {
    // 当来源丢失编号时按中马交替行恢复段落，保证用户仍可批量导入双语文案。
    const input = `Nak minum teh herba, kena sediakan semua ni ke?
想喝草本茶，就要准备这么多东西吗？
Macam-macam bahan nak cari satu-satu.
各种材料都要一样一样去找。
Kalau nak sediakan sendiri, memang agak renyah.
如果要自己准备，确实有点麻烦。
Tapi sebenarnya, ada cara lagi mudah.
但其实，还有更简单的方法。
10 ramuan herba pilihan dah ada dalam satu uncang piramid.
10种精选草本已经装进一个三角茶包里。
Masukkan satu uncang, tambah air panas, tunggu sekejap, terus boleh minum.
放一个茶包，加上热水，稍微泡一会儿，就可以喝了。
Ini Tang Tea Ginseng Ten Treasures Tea.
这是 Tang Tea 人参十宝茶。
Satu pek ada 30 uncang.
一袋有30个茶包。
Senang untuk office atau rumah.
在办公室或者家里都很方便。
Nak cuba?
想试试吗？
Tengok dekat troli kuning.
去小黄车看看。`;

    const segments = parseChatterboxSegments(input);

    expect(segments).toHaveLength(11);
    expect(segments[0]).toEqual({
      text: "Nak minum teh herba, kena sediakan semua ni ke?",
      referenceTranslation: "想喝草本茶，就要准备这么多东西吗？"
    });
    expect(segments[10]).toEqual({
      text: "Tengok dekat troli kuning.",
      referenceTranslation: "去小黄车看看。"
    });
  });
});
