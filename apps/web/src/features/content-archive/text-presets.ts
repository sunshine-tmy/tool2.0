import { archiveTextAppearance, type ArchiveSubtitle, type ArchiveTextAppearance } from "@toolbox/shared/archive";
const plain = archiveTextAppearance({ outlineWidth: 0 });
const preset = (id: string, label: string, style: Partial<ArchiveTextAppearance>) => ({
  id,
  label,
  style: { ...plain, ...style }
});
export const archiveTextPresets = [
  preset("none", "无样式", {}),
  preset("white-black", "白字黑边", { outlineWidth: 2 }),
  preset("white-fine", "白字细边", { outlineWidth: 1 }),
  preset("black-white", "黑字白边", { color: "#171717", outlineColor: "#ffffff", outlineWidth: 2 }),
  preset("yellow-black", "黄字黑边", { color: "#ffe600", outlineWidth: 2 }),
  preset("white-red", "白字红边", { outlineColor: "#f05055", outlineWidth: 2 }),
  preset("pink-white", "粉字白边", { color: "#fb71b3", outlineColor: "#ffffff", outlineWidth: 2 }),
  preset("blue-white", "蓝字白边", { color: "#48b7ee", outlineColor: "#ffffff", outlineWidth: 2 }),
  preset("green-black", "绿字黑边", { color: "#a9d346", outlineWidth: 2 }),
  preset("red-white", "红字白边", { color: "#ff2549", outlineColor: "#ffffff", outlineWidth: 2 }),
  preset("ivory-black", "米白黑边", { color: "#fff0bc", outlineWidth: 2 }),
  preset("white-dark", "白字黑底", { backgroundColor: "#111111", backgroundOpacity: 1 }),
  preset("black-light", "黑字白底", { color: "#111111", backgroundColor: "#ffffff", backgroundOpacity: 1 }),
  preset("black-yellow", "黑字黄底", { color: "#111111", backgroundColor: "#ffe600", backgroundOpacity: 1 }),
  preset("white-rose", "白字玫瑰底", { backgroundColor: "#ad5162", backgroundOpacity: 1 }),
  preset("mint-dark", "薄荷黑底", { color: "#5ee2b1", backgroundColor: "#111111", backgroundOpacity: 1 }),
  preset("white-blue-shadow", "白字蓝影", { shadowColor: "#189cdf", shadowOpacity: 1, shadowX: 2, shadowY: 2 }),
  preset("white-pink-shadow", "白字粉影", { shadowColor: "#f450aa", shadowOpacity: 1, shadowX: 2, shadowY: 2 }),
  preset("ivory-red-shadow", "米白红影", {
    color: "#fff0bc",
    shadowColor: "#da4a52",
    shadowOpacity: 1,
    shadowX: 2,
    shadowY: 2
  }),
  preset("yellow-red-shadow", "黄字红影", {
    color: "#ffe600",
    shadowColor: "#ff522c",
    shadowOpacity: 1,
    shadowX: 2,
    shadowY: 2
  }),
  preset("black-green-shadow", "黑字绿影", {
    color: "#171717",
    shadowColor: "#18d463",
    shadowOpacity: 1,
    shadowX: 2,
    shadowY: 2
  }),
  preset("white-dark-shadow", "白字深色投影", { shadowColor: "#161622", shadowOpacity: 1, shadowX: 3, shadowY: 3 }),
  preset("pink-dark-shadow", "粉字深色投影", {
    color: "#fb71b3",
    shadowColor: "#38182d",
    shadowOpacity: 1,
    shadowX: 2,
    shadowY: 2
  }),
  preset("blue-dark-shadow", "蓝字深色投影", {
    color: "#8fcae4",
    shadowColor: "#172c3b",
    shadowOpacity: 1,
    shadowX: 2,
    shadowY: 2
  })
];
export function activeArchiveTextPreset(cue: ArchiveSubtitle) {
  if (cue.decoration && cue.decoration !== "none") return undefined;
  const appearance = archiveTextAppearance(cue);
  return archiveTextPresets.find(({ style }) =>
    (Object.keys(style) as (keyof ArchiveTextAppearance)[]).every((key) =>
      typeof style[key] === "string"
        ? String(style[key]).toLowerCase() === String(appearance[key]).toLowerCase()
        : style[key] === appearance[key]
    )
  )?.id;
}
const alphaColor = (color: string, opacity: number) =>
  `${color}${Math.round(opacity * 255)
    .toString(16)
    .padStart(2, "0")}`;
export function archiveTextPresetPreview(style: ArchiveTextAppearance) {
  return {
    color: style.color,
    WebkitTextStroke: `${(style.outlineWidth * 24) / 36}px ${style.outlineColor}`,
    textShadow: style.shadowOpacity
      ? `${(style.shadowX * 24) / 36}px ${(style.shadowY * 24) / 36}px 0 ${alphaColor(style.shadowColor, style.shadowOpacity)}`
      : "none",
    background: style.backgroundOpacity ? alphaColor(style.backgroundColor, style.backgroundOpacity) : "transparent"
  };
}
