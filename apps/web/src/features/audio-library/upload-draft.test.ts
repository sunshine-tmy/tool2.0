import { describe, expect, it } from "vitest";
import { createUploadDraft, uploadFields } from "./upload-draft";
describe("音频上传可选信息", () => {
  it("只选音频即可生成请求，其他信息允许全部留空", () => {
    const file = new File(["audio"], "demo.wav");
    const draft = createUploadDraft(file);
    expect(draft.file).toBe(file);
    expect(uploadFields(draft)).toEqual({
      title: "",
      purpose: "general",
      language: "",
      foreignText: "",
      chineseText: "",
      note: "",
      groupId: "null",
      keepDuplicate: "false"
    });
  });
  it("发送所有可编辑信息，批量文件的分组与备注相互独立，另存重试不丢信息", () => {
    const one = createUploadDraft(new File(["one"], "one.wav"), {
      language: "ms",
      groupId: "opening",
      purpose: "music"
    });
    const two = createUploadDraft(new File(["two"], "two.wav"));
    Object.assign(one, {
      title: "开场",
      foreignText: "Selamat datang",
      chineseText: "欢迎",
      note: "轻声播放\n夜场使用"
    });
    expect(uploadFields(one, true)).toEqual({
      title: "开场",
      language: "ms",
      purpose: "music",
      foreignText: "Selamat datang",
      chineseText: "欢迎",
      note: "轻声播放\n夜场使用",
      groupId: "opening",
      keepDuplicate: "true"
    });
    expect(two.groupId).toBeNull();
    expect(two.note).toBe("");
    one.language = null;
    one.groupId = null;
    expect(uploadFields(one)).toMatchObject({ language: "", groupId: "null", note: one.note });
  });
});
