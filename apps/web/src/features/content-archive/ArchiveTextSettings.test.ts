// @vitest-environment happy-dom
import { shallowMount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NButton, NInput, NInputNumber, NSlider } from "naive-ui";
import type { ArchiveSubtitle } from "@toolbox/shared/archive";
import Settings from "./ArchiveTextSettings.vue";
import { prepareSubtitleExport } from "./subtitle-export";
import FancyPanel from "./ArchiveFancyTextPanel.vue";
let wrapper: VueWrapper;
const cue: ArchiveSubtitle = {
  id: "subtitle_001",
  start: 0,
  end: 3,
  text: "你好\n文本",
  fontSize: 36,
  color: "#ffffff",
  position: "center"
};
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    font: "",
    measureText: (text: string) => ({ width: text.length * 36 })
  } as CanvasRenderingContext2D);
  wrapper = shallowMount(Settings, {
    props: { cue: { ...cue }, width: 1280, height: 720, disabled: false },
    global: { renderStubDefaultSlot: true }
  });
});
afterEach(() => {
  wrapper.unmount();
  vi.restoreAllMocks();
});
const last = () => wrapper.emitted("update")?.at(-1);

it("edits text and style immediately, without emitting invalid empty text", async () => {
  const input = wrapper.getComponent(NInput);
  input.vm.$emit("update:value", "新文本");
  expect(last()).toEqual([cue.id, { text: "新文本" }]);
  const count = wrapper.emitted("update")!.length;
  input.vm.$emit("update:value", "");
  expect(wrapper.emitted("update")).toHaveLength(count);
  await wrapper
    .findAllComponents(NButton)
    .find((button) => button.attributes("aria-label") === "加粗")!
    .vm.$emit("click", new MouseEvent("click"));
  expect(last()).toEqual([cue.id, { bold: true }]);
});

it("uses linked percent scaling, integer canvas coordinates, rotation, opacity, and reset", async () => {
  const slider = (label: string) =>
    wrapper.findAllComponents(NSlider).find((entry) => entry.attributes("aria-label") === label)!;
  slider("文本缩放").vm.$emit("update:value", 150);
  expect(last()).toEqual([cue.id, { scale: 1, scaleX: 1.5, scaleY: 1.5 }]);
  wrapper
    .findAllComponents(NInputNumber)
    .find((entry) => entry.attributes("aria-label") === "文本位置 X")!
    .vm.$emit("update:value", 100.4);
  expect(last()).toEqual([cue.id, { x: 740 / 1280, y: 0.5 }]);
  slider("文本旋转").vm.$emit("update:value", 20.5);
  expect(last()).toEqual([cue.id, { rotation: -20.5 }]);
  slider("文本不透明度").vm.$emit("update:value", 40);
  expect(last()).toEqual([cue.id, { opacity: 0.4 }]);
  await wrapper
    .findAllComponents(NButton)
    .find((button) => button.attributes("aria-label") === "重置位置大小")!
    .vm.$emit("click", new MouseEvent("click"));
  expect(last()).toEqual([cue.id, { scale: 1, scaleX: 1, scaleY: 1, linkedScale: true, x: 0.5, y: 0.5, rotation: 0 }]);
  await wrapper.setProps({ disabled: true });
  const count = wrapper.emitted("update")!.length;
  slider("文本缩放").vm.$emit("update:value", 200);
  expect(wrapper.emitted("update")).toHaveLength(count);
});

it("measures the export layout freshly without changing the editable draft", () => {
  const studio = { sources: [], musicTracks: [], subtitles: [{ ...cue, letterSpacing: 4, lineSpacing: 12 }] };
  const output = prepareSubtitleExport(studio, 405, 720);
  expect(output.subtitles[0].textLayout).toEqual({
    width: 405,
    lines: [
      { text: "你好", width: 76 },
      { text: "文本", width: 76 }
    ]
  });
  expect(studio.subtitles[0]).not.toHaveProperty("textLayout");
});

it("offers all three vertical alignments and exports column widths instead of horizontal line lengths", async () => {
  for (const [label, textAlign] of [
    ["竖排顶部对齐", "vertical-top"],
    ["竖排居中", "vertical-center"],
    ["竖排底部对齐", "vertical-bottom"]
  ] as const) {
    wrapper
      .findAllComponents(NButton)
      .find((button) => button.attributes("aria-label") === label)!
      .vm.$emit("click", new MouseEvent("click"));
    expect(last()).toEqual([cue.id, { textAlign }]);
  }
  const studio = {
    sources: [],
    musicTracks: [],
    subtitles: [{ ...cue, textAlign: "vertical-bottom" as const, text: "甲乙丙\n丁戊\n己" }]
  };
  const result = prepareSubtitleExport(studio, 405, 720).subtitles[0];
  expect(result.textLayout?.lines).toEqual([
    { text: "甲乙丙", width: 36 },
    { text: "丁戊", width: 36 },
    { text: "己", width: 36 }
  ]);
  await wrapper.setProps({ cue: result });
  expect(
    wrapper
      .findAllComponents(NButton)
      .find((button) => button.attributes("aria-label") === "竖排底部对齐")!
      .attributes("aria-pressed")
  ).toBe("true");
});

it("applies a preset immediately without changing content, font or transforms; no-style clears the effects", async () => {
  await wrapper.get('button[aria-label="黑字黄底"]').trigger("click");
  const changes = last()![1] as Partial<ArchiveSubtitle>;
  expect(last()![2]).toBe(true);
  expect(changes).toMatchObject({ backgroundColor: "#ffe600", backgroundOpacity: 1, outlineWidth: 0 });
  for (const field of [
    "text",
    "fontSize",
    "fontFamily",
    "bold",
    "italic",
    "underline",
    "start",
    "end",
    "x",
    "y",
    "scale",
    "rotation"
  ])
    expect(changes).not.toHaveProperty(field);
  await wrapper.setProps({ cue: { ...cue, ...changes } });
  expect(wrapper.get('button[aria-label="黑字黄底"]').attributes("aria-pressed")).toBe("true");
  await wrapper.get('button[aria-label="无样式"]').trigger("click");
  expect(last()![1]).toMatchObject({ color: "#ffffff", backgroundOpacity: 0, shadowOpacity: 0, outlineWidth: 0 });
});

it("opens the fancy-text tab and applies or clears the flame style as one undoable action", async () => {
  wrapper
    .findAllComponents(NButton)
    .find((button) => button.text() === "花字")!
    .vm.$emit("click");
  await wrapper.vm.$nextTick();
  expect(wrapper.get("#archive-text-fancy-tab").attributes("aria-selected")).toBe("true");
  expect((wrapper.get("#archive-text-fancy-panel").element as HTMLElement).style.display).not.toBe("none");
  expect((wrapper.get("#archive-text-basic-panel").element as HTMLElement).style.display).toBe("none");
  wrapper.getComponent(FancyPanel).vm.$emit("apply", "flame-blue");
  const changes = last()![1] as Partial<ArchiveSubtitle>;
  expect(last()![2]).toBe(true);
  expect(changes).toMatchObject({
    decoration: "flame-blue",
    bold: true,
    outlineWidth: 0,
    shadowOpacity: 0,
    backgroundOpacity: 0
  });
  for (const field of ["text", "fontSize", "fontFamily", "start", "end", "x", "y", "scale", "rotation"])
    expect(changes).not.toHaveProperty(field);
  wrapper.getComponent(FancyPanel).vm.$emit("apply", "none");
  expect(last()).toEqual([cue.id, { decoration: "none" }, true]);
});
