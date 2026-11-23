import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ArchiveSubtitle } from "@toolbox/shared";
import { writeStudioSubtitles } from "../domains/content-archive/video-edit/studio-render";

let root: string;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-studio-render-"));
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

const baseCue = (over: Partial<ArchiveSubtitle> = {}): ArchiveSubtitle => ({
  id: "sub_000001",
  start: 1,
  end: 3,
  text: "你好",
  fontSize: 36,
  color: "#ffffff",
  position: "bottom",
  ...over
});

describe("writeStudioSubtitles", () => {
  it("导出火焰矢量、四层描边和字面，并保留整体变换与透明度", async () => {
    const file = path.join(root, "out.ass");
    await writeStudioSubtitles(
      file,
      [
        baseCue({
          decoration: "flame-blue",
          bold: true,
          opacity: 0.5,
          scale: 1.5,
          rotation: 30,
          textLayout: { width: 1280, lines: [{ text: "你好", width: 72 }] }
        })
      ],
      1280,
      720
    );
    const events = (await fs.readFile(file, "utf8")).split("\n").filter((line) => line.startsWith("Dialogue:"));
    expect(events).toHaveLength(11);
    expect(events.slice(0, 6).every((line) => line.includes("\\p4") && line.includes(" b "))).toBe(true);
    expect(events[0]).toContain("\\fscx150\\fscy150\\frz30");
    expect(events[0]).toContain("\\alpha&H80&");
    expect(events.slice(6, 10).every((line) => line.includes("\\1a&HFF&"))).toBe(true);
    expect(events[6]).toContain("\\3c&Ha54aff&\\bord5.4");
    expect(events[8]).toContain("\\3c&Hff4824&");
    expect(events[10]).toContain("\\bord0");
    expect(events[10]).toContain("你好");
  });
  it("导出文字描边、投影颜色与组合透明度", async () => {
    const file = path.join(root, "out.ass");
    await writeStudioSubtitles(
      file,
      [
        baseCue({
          outlineColor: "#f05055",
          outlineWidth: 2,
          shadowColor: "#189cdf",
          shadowOpacity: 0.5,
          shadowX: 2,
          shadowY: 3,
          opacity: 0.5
        })
      ],
      1280,
      720
    );
    const text = await fs.readFile(file, "utf8");
    expect(text).toContain("\\3c&H5550f0&\\bord2");
    expect(text).toContain("\\4c&Hdf9c18&\\4a&HBF&\\xshad2\\yshad3");
  });

  it("文字色块先于字形导出，随整体位置、缩放、旋转和透明度生效", async () => {
    const file = path.join(root, "out.ass");
    await writeStudioSubtitles(
      file,
      [
        baseCue({
          backgroundColor: "#ffe600",
          backgroundOpacity: 1,
          backgroundPadding: 6,
          opacity: 0.5,
          scale: 1.5,
          rotation: 30,
          textLayout: { width: 1280, lines: [{ text: "你好", width: 72 }] }
        })
      ],
      1280,
      720
    );
    const text = await fs.readFile(file, "utf8");
    const events = text.split("\n").filter((line) => line.startsWith("Dialogue:"));
    expect(events).toHaveLength(2);
    expect(events[0]).toContain("\\frz30\\fscx150\\fscy150");
    expect(events[0]).toContain("\\1c&H00e6ff&\\1a&H80&\\p1");
    expect(events[0]).toContain("m 0 0 l 84 0 84 48 0 48 0 0");
    expect(events[1]).toContain("你好");
    expect(events[1]).not.toContain("\\p1");
  });
  it("无空间字段的字幕沿用三档对齐与字号/颜色", async () => {
    const file = path.join(root, "out.ass");
    await writeStudioSubtitles(file, [baseCue({ position: "top" })], 1280, 720);
    const text = await fs.readFile(file, "utf8");
    expect(text).toContain("\\an8\\fs36\\c&Hffffff&");
  });

  it("含 x/y 的字幕输出中心对齐与 pos 定位", async () => {
    const file = path.join(root, "out.ass");
    await writeStudioSubtitles(file, [baseCue({ x: 0.5, y: 0.9 })], 1280, 720);
    const text = await fs.readFile(file, "utf8");
    expect(text).toContain("\\an5\\pos(640,648)\\fs36\\c&Hffffff&");
  });

  it("旋转与缩放输出 frz/fscx/fscy", async () => {
    const file = path.join(root, "out.ass");
    await writeStudioSubtitles(file, [baseCue({ x: 0.5, y: 0.5, rotation: 45, scale: 1.5 })], 1280, 720);
    const text = await fs.readFile(file, "utf8");
    expect(text).toContain("\\frz45");
    expect(text).toContain("\\fscx150\\fscy150");
  });

  it("默认旋转/缩放不输出多余标签", async () => {
    const file = path.join(root, "out.ass");
    await writeStudioSubtitles(file, [baseCue({ rotation: 0, scale: 1 })], 1280, 720);
    const text = await fs.readFile(file, "utf8");
    expect(text).not.toContain("\\frz");
    expect(text).not.toContain("\\fscx");
  });

  it("文字样式与透明度进入导出，换行与间距保持客户端测量结果", async () => {
    const file = path.join(root, "out.ass");
    await writeStudioSubtitles(
      file,
      [
        baseCue({
          text: "长行\n短",
          fontFamily: "Microsoft YaHei",
          bold: true,
          italic: true,
          underline: true,
          letterSpacing: 4,
          lineSpacing: 12,
          textAlign: "left",
          opacity: 0.5,
          x: 0.5,
          y: 0.5,
          textLayout: {
            width: 405,
            lines: [
              { text: "长行", width: 76 },
              { text: "短", width: 36 }
            ]
          }
        })
      ],
      405,
      720
    );
    const text = await fs.readFile(file, "utf8");
    expect(text).toContain("\\fnMicrosoft YaHei\\b1\\i1\\u1\\fsp4\\alpha&H80&");
    expect(text).toContain("\\q2\\an5\\pos(202.5,332.4)");
    expect(text).toContain("\\q2\\an5\\pos(182.5,387.6)");
    expect(text.match(/^Dialogue:/gm)).toHaveLength(2);
  });

  it("逐行位置围绕文本中心按相同比例旋转缩放", async () => {
    const file = path.join(root, "out.ass");
    await writeStudioSubtitles(
      file,
      [
        baseCue({
          text: "甲\n乙",
          x: 0.5,
          y: 0.5,
          rotation: -90,
          scaleY: 2,
          textLayout: {
            width: 1280,
            lines: [
              { text: "甲", width: 36 },
              { text: "乙", width: 36 }
            ]
          }
        })
      ],
      1280,
      720
    );
    const text = await fs.readFile(file, "utf8");
    expect(text).toContain("\\pos(683.2,360)");
    expect(text).toContain("\\pos(596.8,360)");
    expect(text).toContain("\\frz-90\\fscx100\\fscy200");
  });

  it("拒绝与文本内容或画布不匹配的旧排版数据", async () => {
    const file = path.join(root, "out.ass");
    await expect(
      writeStudioSubtitles(
        file,
        [baseCue({ textLayout: { width: 1280, lines: [{ text: "被替换", width: 36 }] } })],
        1280,
        720
      )
    ).rejects.toThrow("文本排版已变化");
    await expect(
      writeStudioSubtitles(
        file,
        [baseCue({ textLayout: { width: 405, lines: [{ text: "你好", width: 72 }] } })],
        1280,
        720
      )
    ).rejects.toThrow("文本排版已变化");
  });

  it.each([
    ["vertical-top", 324, 324],
    ["vertical-center", 342, 360],
    ["vertical-bottom", 360, 396]
  ] as const)("导出 %s 竖排时逐字定位，顺序与预览一致", async (textAlign, middleY, leftY) => {
    const file = path.join(root, "out.ass");
    await writeStudioSubtitles(
      file,
      [
        baseCue({
          position: "center",
          text: "甲乙丙\n丁戊\n己",
          textAlign,
          textLayout: {
            width: 1280,
            lines: [
              { text: "甲乙丙", width: 36 },
              { text: "丁戊", width: 36 },
              { text: "己", width: 36 }
            ]
          }
        })
      ],
      1280,
      720
    );
    const text = await fs.readFile(file, "utf8");
    expect(text).toContain("\\pos(683.2,324)");
    expect(text).toContain(`\\pos(640,${middleY})`);
    expect(text).toContain(`\\pos(596.8,${leftY})`);
    expect(text.match(/^Dialogue:/gm)).toHaveLength(6);
    expect(text).toContain("\\fsp0");
  });
});
