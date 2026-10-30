/** 视频水印仅接收数值和受控素材 ID；坐标是水印在可移动区域内的比例。 */
import { Type, type Static } from "@sinclair/typebox";
const strict = { additionalProperties: false } as const;
const ratio = () => Type.Number({ minimum: 0, maximum: 1 });
const seconds = () => Type.Number({ minimum: 0, maximum: 7200 });
export const ARCHIVE_WATERMARK_BOUNCE_STYLES = [
  { value: "standard", label: "经典斜向反弹" },
  { value: "z", label: "Z 型折返" },
  { value: "zigzag", label: "多段锯齿反弹" },
  { value: "cross", label: "交叉穿梭反弹" },
  { value: "staggered", label: "长短交替反弹" },
  { value: "polygon", label: "多边不规则巡游" },
  { value: "random", label: "随机碰边巡游" }
] as const;
export const ArchiveWatermarkPointSchema = Type.Object({ x: ratio(), y: ratio() }, strict);
export const ArchiveWatermarkSettingsSchema = Type.Object(
  {
    opacity: Type.Number({ minimum: 0, maximum: 100 }),
    widthPercent: Type.Number({ minimum: 1, maximum: 50 }),
    startSeconds: seconds(),
    endSeconds: Type.Union([seconds(), Type.Null()]),
    motion: Type.Object(
      {
        type: Type.Union(["fixed", "linear", "ping-pong", "bounce", "keyframes"].map((value) => Type.Literal(value))),
        from: ArchiveWatermarkPointSchema,
        to: ArchiveWatermarkPointSchema,
        periodSeconds: Type.Number({ minimum: 0.25, maximum: 7200 }),
        directionX: Type.Union([Type.Literal(-1), Type.Literal(1)]),
        directionY: Type.Union([Type.Literal(-1), Type.Literal(1)]),
        // 旧归档省略时保持原有斜向反弹；随机种子只在用户主动换轨迹时变化。
        bounceStyle: Type.Optional(
          Type.Union(ARCHIVE_WATERMARK_BOUNCE_STYLES.map((style) => Type.Literal(style.value)))
        ),
        bounceSeed: Type.Optional(Type.Integer({ minimum: 0, maximum: 2147483647 })),
        keyframes: Type.Array(Type.Object({ timeSeconds: seconds(), x: ratio(), y: ratio() }, strict), { maxItems: 20 })
      },
      strict
    )
  },
  strict
);
export const ArchiveWatermarkInputSchema = Type.Object(
  {
    draftId: Type.Optional(Type.String({ pattern: "^[A-Za-z0-9_-]{12}$" })),
    settings: ArchiveWatermarkSettingsSchema
  },
  strict
);
export const ArchiveWatermarkDraftSchema = Type.Object(
  {
    id: Type.String({ pattern: "^[A-Za-z0-9_-]{12}$" }),
    width: Type.Integer({ minimum: 1 }),
    height: Type.Integer({ minimum: 1 }),
    previewUrl: Type.String(),
    expiresAt: Type.String()
  },
  strict
);
export type ArchiveWatermarkSettings = Static<typeof ArchiveWatermarkSettingsSchema>;
export type ArchiveWatermarkDraft = Static<typeof ArchiveWatermarkDraftSchema>;
export type ArchiveWatermarkInput = Static<typeof ArchiveWatermarkInputSchema>;
/** Long-lived library entries contain image metadata only, never a filesystem path or video settings. */
export const ArchiveWatermarkLibraryItemSchema = Type.Object(
  {
    id: Type.String({ pattern: "^[A-Za-z0-9_-]{12}$" }),
    name: Type.String({ minLength: 1, maxLength: 120 }),
    width: Type.Integer({ minimum: 1, maximum: 8192 }),
    height: Type.Integer({ minimum: 1, maximum: 8192 }),
    size: Type.Integer({ minimum: 1, maximum: 20 * 1024 * 1024 }),
    checksum: Type.String({ pattern: "^[a-f0-9]{64}$" }),
    previewUrl: Type.String(),
    revision: Type.Integer({ minimum: 1 }),
    createdAt: Type.String(),
    updatedAt: Type.String()
  },
  strict
);
export type ArchiveWatermarkLibraryItem = Static<typeof ArchiveWatermarkLibraryItemSchema>;
export const defaultArchiveWatermarkSettings = (): ArchiveWatermarkSettings => ({
  opacity: 70,
  widthPercent: 15,
  startSeconds: 0,
  endSeconds: null,
  motion: {
    type: "fixed",
    from: { x: 0.97, y: 0.03 },
    to: { x: 0.03, y: 0.97 },
    periodSeconds: 10,
    directionX: -1,
    directionY: 1,
    keyframes: []
  }
});
export function watermarkTimingError(settings: ArchiveWatermarkSettings, duration: number): string | undefined {
  if (
    !(duration > 0) ||
    settings.startSeconds >= duration ||
    (settings.endSeconds !== null && (settings.endSeconds <= settings.startSeconds || settings.endSeconds > duration))
  )
    return "水印显示时间必须位于视频时长内，结束时间应晚于开始时间";
  if (settings.motion.type === "keyframes") {
    const frames = settings.motion.keyframes;
    if (
      frames.length < 2 ||
      frames.some(
        (frame, index) =>
          frame.timeSeconds < settings.startSeconds ||
          frame.timeSeconds > (settings.endSeconds ?? duration) ||
          (index > 0 && frame.timeSeconds <= frames[index - 1].timeSeconds)
      )
    )
      return "请按时间先后设置 2～20 个关键帧，且关键帧须位于水印显示时间内";
  }
}
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const reflect = (value: number) => 1 - Math.abs((((value % 2) + 2) % 2) - 1);
const bouncePaths: Record<string, Array<[number, number]>> = {
  z: [
    [1, 0],
    [0, 1],
    [1, 1]
  ],
  zigzag: [
    [1, 0.12],
    [0, 0.32],
    [1, 0.55],
    [0, 0.77],
    [1, 1]
  ],
  cross: [
    [1, 1],
    [0, 0.65],
    [1, 0.1],
    [0, 1],
    [1, 0.35],
    [0, 0]
  ],
  staggered: [
    [1, 0.9],
    [0.7, 0],
    [0, 0.6],
    [0.35, 1],
    [1, 0.25],
    [0.55, 0],
    [0, 0.2]
  ],
  polygon: [
    [1, 0.3],
    [0.65, 1],
    [0, 0.75],
    [0.8, 0],
    [1, 0.8],
    [0.15, 1],
    [0, 0.2]
  ]
};
/** 有限路点供预览和 FFmpeg 共用；固定种子保证拖动进度条、重开和导出不重新随机。 */
export function archiveWatermarkBouncePath(settings: ArchiveWatermarkSettings) {
  const m = settings.motion,
    style = m.bounceStyle ?? "standard";
  if (style === "standard") return undefined;
  let points = bouncePaths[style];
  if (style === "random") {
    let seed = ((m.bounceSeed ?? 1) ^ 0x9e3779b9) >>> 0,
      edge = 0;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    points = Array.from({ length: 8 }, () => {
      edge = (edge + 1 + Math.floor(random() * 3)) % 4;
      const offset = 0.08 + random() * 0.84;
      return edge === 0 ? [offset, 0] : edge === 1 ? [1, offset] : edge === 2 ? [offset, 1] : [0, offset];
    });
  }
  if (!points) return undefined;
  return [
    { ...m.from },
    ...points.map(([x, y]) => ({ x: m.directionX < 0 ? 1 - x : x, y: m.directionY < 0 ? 1 - y : y }))
  ];
}
export function archiveWatermarkPosition(settings: ArchiveWatermarkSettings, time: number) {
  const motion = settings.motion;
  const t = Math.max(0, time - settings.startSeconds);
  let point = motion.from;
  if (motion.type === "linear" || motion.type === "ping-pong") {
    const fraction =
      motion.type === "linear" ? clamp(t / motion.periodSeconds) : reflect((2 * t) / motion.periodSeconds);
    point = {
      x: motion.from.x + (motion.to.x - motion.from.x) * fraction,
      y: motion.from.y + (motion.to.y - motion.from.y) * fraction
    };
  } else if (motion.type === "bounce") {
    const path = archiveWatermarkBouncePath(settings);
    if (path) {
      const progress = reflect((2 * t) / motion.periodSeconds) * (path.length - 1);
      const index = Math.min(Math.floor(progress), path.length - 2),
        fraction = progress - index;
      point = {
        x: path[index].x + (path[index + 1].x - path[index].x) * fraction,
        y: path[index].y + (path[index + 1].y - path[index].y) * fraction
      };
    } else
      point = {
        x: reflect(motion.from.x + (motion.directionX * t) / motion.periodSeconds),
        y: reflect(motion.from.y + (motion.directionY * t) / motion.periodSeconds)
      };
  } else if (motion.type === "keyframes" && motion.keyframes.length) {
    const frames = motion.keyframes;
    point = frames[0];
    for (let i = 1; i < frames.length; i++) {
      const left = frames[i - 1],
        right = frames[i];
      const fraction = clamp((time - left.timeSeconds) / (right.timeSeconds - left.timeSeconds));
      point = { x: left.x + (right.x - left.x) * fraction, y: left.y + (right.y - left.y) * fraction };
      if (time <= right.timeSeconds) break;
    }
  }
  return {
    x: clamp(point.x),
    y: clamp(point.y),
    visible: time >= settings.startSeconds && (settings.endSeconds === null || time <= settings.endSeconds)
  };
}

const presetPoint = Type.Object({ progress: ratio(), x: ratio(), y: ratio() }, strict);
export const ArchiveWatermarkPresetInputSchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 60 }),
    points: Type.Array(presetPoint, { minItems: 2, maxItems: 20 })
  },
  strict
);
export const ArchiveWatermarkPresetSchema = Type.Object(
  {
    id: Type.String({ pattern: "^[A-Za-z0-9_-]{12}$" }),
    ...ArchiveWatermarkPresetInputSchema.properties,
    revision: Type.Integer({ minimum: 1 }),
    createdAt: Type.String(),
    updatedAt: Type.String()
  },
  strict
);
export type ArchiveWatermarkPresetInput = Static<typeof ArchiveWatermarkPresetInputSchema>;
export type ArchiveWatermarkPreset = Static<typeof ArchiveWatermarkPresetSchema>;
/** 只保存时间比例和坐标，不绑定原视频、水印图片、配乐及透明度。 */
export function archiveWatermarkPresetPoints(settings: ArchiveWatermarkSettings, duration: number) {
  const error = watermarkTimingError(settings, duration);
  if (error || settings.motion.type !== "keyframes") throw new Error(error ?? "请先设置自定义关键帧");
  const end = settings.endSeconds ?? duration,
    interval = end - settings.startSeconds;
  return settings.motion.keyframes.map((frame) => ({
    progress: clamp((frame.timeSeconds - settings.startSeconds) / interval),
    x: frame.x,
    y: frame.y
  }));
}
export function applyArchiveWatermarkPreset(
  settings: ArchiveWatermarkSettings,
  points: ArchiveWatermarkPresetInput["points"],
  duration: number
): ArchiveWatermarkSettings {
  const end = settings.endSeconds ?? duration,
    interval = end - settings.startSeconds;
  if (!(interval > 0) || settings.startSeconds >= duration || end > duration)
    throw new Error("请先设置有效的水印显示时间");
  return {
    ...settings,
    motion: {
      ...settings.motion,
      from: { ...settings.motion.from },
      to: { ...settings.motion.to },
      type: "keyframes",
      keyframes: points.map((point) => ({
        timeSeconds: settings.startSeconds + point.progress * interval,
        x: point.x,
        y: point.y
      }))
    }
  };
}
export function archiveWatermarkSize(
  settings: ArchiveWatermarkSettings,
  image: { width: number; height: number },
  video: { width: number; height: number }
) {
  const scale = Math.min((video.width * settings.widthPercent) / 100 / image.width, video.height / image.height);
  return { width: Math.max(1, Math.round(image.width * scale)), height: Math.max(1, Math.round(image.height * scale)) };
}
