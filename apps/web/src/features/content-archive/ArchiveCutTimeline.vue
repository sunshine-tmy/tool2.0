<template>
  <section
    ref="timelineRoot"
    data-tour="editor-timeline"
    class="cut-timeline"
    :style="{ '--timeline-min-height': `${minimumHeight}px` }"
    aria-label="视频自由编排时间线"
  >
    <div ref="toolbar" class="cut-toolbar">
      <strong>编辑时间线</strong>
      <n-button
        v-for="action in actions"
        :key="action.label"
        size="small"
        quaternary
        :disabled="disabled || action.disabled"
        :aria-label="action.label"
        :title="action.title"
        @click="action.run"
      >
        <template #icon><component :is="action.icon" :size="17" /></template>
      </n-button>
      <div class="cut-zoom">
        <n-button
          size="small"
          :quaternary="!snapping"
          :secondary="snapping"
          :type="snapping ? 'primary' : 'default'"
          :disabled="disabled"
          :aria-pressed="snapping"
          :aria-label="snapping ? '关闭自动吸附' : '开启自动吸附'"
          :title="snapping ? '关闭自动吸附' : '开启自动吸附'"
          @click="$emit('update:snapping', !snapping)"
          ><template #icon><FoldHorizontal :size="17" /></template
        ></n-button>
        <n-button quaternary size="small" title="缩小时间线" aria-label="缩小时间线" @click="setZoom(zoom / 1.5)"
          ><template #icon><ZoomOut :size="16" /></template
        ></n-button>
        <input
          type="range"
          min="0"
          max="6"
          step="0.05"
          :value="Math.log2(zoom)"
          aria-label="时间线缩放"
          @input="setZoom(2 ** Number(($event.target as HTMLInputElement).value))"
        />
        <n-button quaternary size="small" title="放大时间线" aria-label="放大时间线" @click="setZoom(zoom * 1.5)"
          ><template #icon><ZoomIn :size="16" /></template
        ></n-button>
      </div>
    </div>
    <div ref="viewport" class="cut-scroll" :style="{ minHeight: `${minimumViewportHeight}px` }" @wheel="onWheel">
      <div class="lane-headers" @pointerdown.stop>
        <div
          v-for="row in rowCount"
          :key="row"
          class="lane-header"
          :style="{ top: `${laneTop(row - 1)}px`, height: `${laneHeight(row - 1)}px` }"
        >
          <div>
            <span
              class="lane-kind"
              role="img"
              :aria-label="`${laneKind(row - 1)}轨道 ${row}`"
              :title="`${laneKind(row - 1)}轨道 ${row}`"
            >
              <component
                :is="
                  laneKind(row - 1) === '视频'
                    ? Film
                    : laneKind(row - 1) === '字幕'
                      ? Type
                      : laneKind(row - 1) === '水印'
                        ? ImageIcon
                        : Music2
                "
                :size="16"
              />
            </span>
            <button
              v-for="control in laneControls(row - 1)"
              :key="control.key"
              :title="control.title"
              :aria-label="control.title"
              :aria-pressed="control.active"
              :disabled="disabled"
              @click="$emit('track', row - 1, control.key)"
            >
              <component :is="control.icon" :size="14" />
            </button>
          </div>
        </div>
      </div>
      <div
        ref="track"
        class="cut-track"
        :style="{
          width: `calc(${zoom * 100}% - ${132 * zoom}px)`,
          height: `${timelineHeight + timelineBottomSpace}px`
        }"
        @pointerdown="beginBackground"
      >
        <div class="cut-ruler" @pointerdown.stop="beginSeek">
          <span v-for="i in 11" :key="i" :style="{ left: `${(i - 1) * 10}%` }">{{ clock((span * (i - 1)) / 10) }}</span>
        </div>
        <div
          v-for="row in rowCount"
          :key="row"
          class="cut-lane"
          :class="{ target: dragPreview && dropLane === row - 1, last: row === rowCount }"
          :style="{ top: `${laneTop(row - 1)}px`, height: `${laneHeight(row - 1)}px` }"
        ></div>
        <div
          v-for="node in nodes"
          :key="node.id"
          tabindex="0"
          class="cut-node"
          :class="[
            node.kind,
            {
              selected: selected.includes(node.id),
              dragging: gesture?.ids.includes(node.id) && moved,
              locked: nodeLocked(node.id)
            }
          ]"
          :data-node-id="node.id"
          :title="`${node.kind === 'video' ? videoName(node) : node.label} · ${clock(node.at)} — ${clock(node.at + node.length)}`"
          :style="{
            left: `${percent(node.at)}%`,
            width: `${percent(node.length)}%`,
            top: `${top(node.lane)}px`,
            height: `${nodeHeight(node)}px`
          }"
          @pointerdown.stop="beginNode($event, node, 'move')"
        >
          <template v-if="node.kind === 'video'">
            <div class="video-caption">
              <template v-if="node.clip?.freezeAt !== undefined">
                <span class="video-speed freeze-label">定格</span>
                <span class="freeze-duration">{{ freezeTimecode(node) }}</span>
              </template>
              <template v-else>
                <span v-if="node.clip?.interpolation" class="video-speed">补帧 {{ outputFps || 30 }} FPS</span>
                <span class="video-speed"
                  >{{ node.clip?.reverse ? "倒放" : "变速" }} {{ (node.clip?.speed ?? 1).toFixed(2) }}×</span
                >
                <span class="video-name">{{ videoName(node) }}</span>
                <span class="video-duration">{{ clock(node.length) }}</span>
              </template>
            </div>
            <ArchiveCutThumbnail
              :class="{ 'with-audio': videoHasAudio(node) || node.clip?.freezeAt !== undefined }"
              :url="freezeSources?.[node.id]?.url ?? videoUrl(node)"
              :time="freezeSources?.[node.id]?.time ?? node.clip?.freezeAt ?? node.clip?.start ?? 0"
              :end="freezeSources?.[node.id]?.time ?? node.clip?.freezeAt ?? node.clip?.end ?? 0"
              :reverse="node.clip?.reverse"
              :fps="fpsOf(node)"
              :revision="videoRevision(node)"
            />
            <ArchiveTimelineAudio
              v-if="videoHasAudio(node) && node.clip"
              class="video-audio"
              :audio="videoAudio(node)"
              :url="videoUrl(node)"
              :waveform-version="videoRevision(node)"
              :load-waveform="videoWaveformLoader(node)"
              :disabled="disabled || nodeLocked(node.id)"
              @available="setVideoAudio(node, $event)"
              @begin="beginAudio(node)"
              @update="$emit('audio', node.id, $event)"
              @commit="finishAudio"
              @cancel="cancelAudio"
            />
          </template>
          <ArchiveTimelineAudio
            v-if="node.kind === 'music' && studio?.musicTracks[node.index]"
            :audio="studio.musicTracks[node.index]"
            :url="musicUrls?.[node.id] ?? ''"
            :disabled="disabled || nodeLocked(node.id)"
            @begin="beginAudio(node)"
            @update="$emit('audio', node.id, $event)"
            @commit="finishAudio"
            @cancel="cancelAudio"
          />
          <img
            v-if="node.kind === 'watermark'"
            :src="watermarkUrls?.[studio?.watermarks?.[node.index]?.asset.id ?? '']"
            class="watermark-thumb"
            alt=""
          />
          <span v-if="node.kind !== 'video'" class="node-text">{{ node.label }}</span>
          <span v-if="node.clip && archiveTransitionDuration(clips, node.index)" class="transition-badge">转场</span>
          <button
            class="cut-handle left"
            :aria-label="`裁剪${node.label}起点`"
            @pointerdown.stop="beginNode($event, node, 'start')"
          ></button>
          <button
            class="cut-handle right"
            :aria-label="`裁剪${node.label}终点`"
            @pointerdown.stop="beginNode($event, node, 'end')"
          ></button>
        </div>
        <template v-if="dragPreview && gesture && moved">
          <div
            v-for="node in dragPreview"
            :key="node.id"
            class="cut-ghost"
            :class="node.kind"
            :style="{
              left: `${percent(node.at)}%`,
              width: `${percent(node.length)}%`,
              top: `${top(gesture.anchor.lane) + gesture.dy + laneTop(node.lane) - laneTop(dropLane)}px`,
              height: `${nodeHeight(node)}px`
            }"
          >
            {{ node.label }}
          </div>
          <div class="drop-guide" :style="{ top: `${laneTop(dropLane)}px`, height: `${laneHeight(dropLane)}px` }">
            <span>放置到轨道 {{ dropLane + 1 }} · {{ clock(dragPreview[0]?.at ?? 0) }}</span>
          </div>
        </template>
        <div v-if="guide !== undefined" class="cut-guide" :style="{ left: `${percent(guide)}%` }">
          <span>吸附对齐</span>
        </div>
        <div
          v-if="box"
          class="cut-box"
          :style="{ left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` }"
        ></div>
        <div class="cut-playhead" :style="{ left: `${percent(time)}%` }" @pointerdown.stop="beginSeek">
          <span></span>
        </div>
      </div>
    </div>
    <div ref="summary" class="cut-summary">
      <span>已选 {{ selected.length }} 个元素 · {{ rowCount }} 条轨道</span
      ><span>上方轨道优先显示 · 空隙保留黑屏 · 声音叠加</span>
    </div>
  </section>
</template>
<script setup lang="ts">
import { computed, ref, watch, onMounted, onScopeDispose } from "vue";
import { NButton } from "naive-ui";
import {
  Image as ImageIcon,
  FoldHorizontal,
  Film,
  Music2,
  Type,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  Undo2,
  Redo2,
  SplitSquareHorizontal,
  PanelLeftClose,
  PanelRightClose,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  FlipHorizontal2,
  RotateCcw,
  GalleryHorizontal
} from "lucide-vue-next";
import {
  archiveClipDuration,
  archiveSliceClip,
  archiveCutStarts,
  archiveTransitionDuration,
  type ArchiveStudio,
  type ArchiveStudioSource,
  type ArchiveCutClip
} from "@toolbox/shared/archive";
import { videoEditApi } from "./video-edit-api";
import ArchiveTimelineAudio from "./ArchiveTimelineAudio.vue";
import type { TimelineAudioChange } from "./timeline-audio";
import ArchiveCutThumbnail from "./ArchiveCutThumbnail.vue";
const props = defineProps<{
  watermarkUrls?: Record<string, string>;
  itemId: string;
  mediaId: string;
  sourceName?: string;
  sourceHasAudio?: boolean;
  sourceRevision?: string;
  clips: ArchiveCutClip[];
  selected: string[];
  time: number;
  duration: number;
  sourceDuration: number;
  fps: number;
  zoom: number;
  snapping: boolean;
  canTrim: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canVideoTools?: boolean;
  canReverse?: boolean;
  canFreeze?: boolean;
  canPaste?: boolean;
  outputFps?: number;
  freezeSources?: Record<string, { url: string; time: number }>;
  disabled: boolean;
  sourceUrl: string;
  sourceUrls?: Record<string, string>;
  musicUrls?: Record<string, string>;
  sources?: ArchiveStudioSource[];
  studio?: ArchiveStudio;
}>();
const emit = defineEmits<{
  "minimum-height": [number];
  "update:selected": [string[]];
  "update:zoom": [number];
  "update:snapping": [boolean];
  seek: [number];
  play: [];
  split: [];
  trim: ["left" | "right"];
  remove: [];
  undo: [];
  redo: [];
  rotate: [];
  mirror: [];
  reverse: [];
  freeze: [];
  copy: [];
  paste: [];
  begin: [];
  cancel: [];
  commit: [ArchiveCutClip[]];
  studio: [ArchiveStudio];
  layout: [ArchiveCutClip[], ArchiveStudio];
  track: [number, "locked" | "hidden" | "muted"];
  "audio-begin": [];
  "audio-end": [];
  audio: [id: string, changes: TimelineAudioChange];
}>();
const actions = computed(() => [
  { label: "撤回", title: "撤回（Ctrl+Z / ⌘Z）", icon: Undo2, disabled: !props.canUndo, run: () => emit("undo") },
  {
    label: "重做",
    title: "重做（Ctrl+Shift+Z / ⌘Shift+Z）",
    icon: Redo2,
    disabled: !props.canRedo,
    run: () => emit("redo")
  },
  {
    label: "按指针拆分",
    title: "按指针拆分（Ctrl+B / ⌘B）",
    icon: SplitSquareHorizontal,
    disabled: !props.canTrim,
    run: () => emit("split")
  },
  {
    label: "向左裁剪",
    title: "删除选中元素中指针左侧内容（Q）",
    icon: PanelLeftClose,
    disabled: !props.canTrim,
    run: () => emit("trim", "left")
  },
  {
    label: "向右裁剪",
    title: "删除选中元素中指针右侧内容（W）",
    icon: PanelRightClose,
    disabled: !props.canTrim,
    run: () => emit("trim", "right")
  },
  {
    label: "删除元素",
    title: "删除选中元素（Delete / Backspace）",
    icon: Trash2,
    disabled: !props.selected.length,
    run: () => emit("remove")
  },
  {
    label: "旋转",
    title: "选中视频顺时针旋转 90°",
    icon: RotateCw,
    disabled: !props.canVideoTools,
    run: () => emit("rotate")
  },
  {
    label: "镜像",
    title: "选中视频左右镜像",
    icon: FlipHorizontal2,
    disabled: !props.canVideoTools,
    run: () => emit("mirror")
  },
  {
    label: "倒放",
    title: "切换选中视频倒放（含原声）",
    icon: RotateCcw,
    disabled: !props.canReverse,
    run: () => emit("reverse")
  },
  {
    label: "定格",
    title: "在指针位置插入 3 秒静帧，同轨后续片段顺延",
    icon: GalleryHorizontal,
    disabled: !props.canFreeze,
    run: () => emit("freeze")
  }
]);

type Node = {
  id: string;
  kind: "video" | "subtitle" | "music" | "watermark";
  at: number;
  length: number;
  lane: number;
  label: string;
  index: number;
  clip?: ArchiveCutClip;
};
const audioEditing = ref(false);
function beginAudio(node: Node) {
  emit("update:selected", [node.id]);
  audioEditing.value = true;
  emit("audio-begin");
}
function finishAudio() {
  audioEditing.value = false;
  emit("audio-end");
}
function cancelAudio() {
  audioEditing.value = false;
  emit("cancel");
}
const knownAudio = ref(new Map<string, boolean>());
const videoSource = (node: Node) => props.sources?.find((source) => source.id === node.clip?.sourceId);
const videoUrl = (node: Node) =>
  node.clip?.sourceId ? props.sourceUrls?.[node.clip.sourceId] || props.sourceUrl : props.sourceUrl;
const videoRevision = (node: Node) => videoSource(node)?.checksum ?? props.sourceRevision ?? "";
const videoKey = (node: Node) => `${videoUrl(node)}:${videoRevision(node)}`;
function videoHasAudio(node: Node) {
  if (node.clip?.freezeAt !== undefined) return false;
  return (
    knownAudio.value.get(videoKey(node)) ??
    (node.clip?.sourceId ? videoSource(node)?.hasAudio : props.sourceHasAudio) ??
    true
  );
}
function setVideoAudio(node: Node, available: boolean) {
  if (knownAudio.value.get(videoKey(node)) === available) return;
  knownAudio.value = new Map(knownAudio.value).set(videoKey(node), available);
}
function videoName(node: Node) {
  return node.clip?.sourceId
    ? videoSource(node)?.fileName || videoSource(node)?.title || node.label
    : props.sourceName || node.label;
}
function videoAudio(node: Node) {
  return {
    start: node.at,
    end: node.at + node.length,
    sourceStart: node.clip?.start ?? 0,
    reverseEnd: node.clip?.reverse ? node.clip.end : undefined,
    speed: node.clip?.speed ?? 1,
    volume: node.clip?.volume ?? 100,
    fadeIn: node.clip?.fadeIn ?? 0,
    fadeOut: node.clip?.fadeOut ?? 0,
    muted: node.clip?.muted,
    loop: false
  };
}
function videoWaveformLoader(node: Node) {
  return async (signal: AbortSignal) => {
    const result = await videoEditApi.waveform(props.itemId, props.mediaId, videoSource(node), signal);
    return { ...result, peaks: Float32Array.from(result.peaks) };
  };
}
const nodeHeight = (node: Node) => (node.kind === "video" ? 82 : node.kind === "music" ? 48 : 30);
const track = ref<HTMLDivElement>(),
  viewport = ref<HTMLDivElement>();
const starts = computed(() => archiveCutStarts(props.clips));
const nodes = computed<Node[]>(() => [
  ...(props.studio?.watermarks ?? []).map((mark, index) => ({
    id: mark.id,
    kind: "watermark" as const,
    at: mark.start,
    length: mark.end - mark.start,
    lane: mark.lane ?? 0,
    label: mark.title,
    index
  })),
  ...props.clips.map((clip, index) => ({
    id: clip.id,
    kind: "video" as const,
    at: starts.value[index],
    length: archiveClipDuration(clip),
    lane: clip.lane ?? 1,
    label: `视频 ${index + 1}`,
    index,
    clip
  })),
  ...(props.studio?.subtitles ?? []).map((cue, index) => ({
    id: cue.id,
    kind: "subtitle" as const,
    at: cue.start,
    length: cue.end - cue.start,
    lane: cue.lane ?? 0,
    label: cue.text,
    index
  })),
  ...(props.studio?.musicTracks ?? []).map((entry, index) => ({
    id: entry.id,
    kind: "music" as const,
    at: entry.start,
    length: entry.end - entry.start,
    lane: entry.lane ?? 2 + index,
    label: entry.title,
    index
  }))
]);
const members = computed(() => [
  ...props.clips,
  ...(props.studio?.subtitles ?? []),
  ...(props.studio?.musicTracks ?? []),
  ...(props.studio?.watermarks ?? [])
]);
const nodeLocked = (id: string) => Boolean(members.value.find((entry) => entry.id === id)?.locked);
const laneKind = (lane: number) =>
  ({ video: "视频", subtitle: "字幕", music: "配乐", watermark: "水印" })[
    nodes.value.find((node) => node.lane === lane)?.kind ?? "video"
  ];
function laneControls(lane: number) {
  const entries = members.value.filter((entry) => (entry.lane ?? 0) === lane);
  if (!entries.length) return [];
  const active = (key: "locked" | "hidden" | "muted") => entries.every((entry) => entry[key]);
  return [
    {
      key: "locked" as const,
      active: active("locked"),
      title: active("locked") ? "解锁轨道" : "锁定轨道",
      icon: active("locked") ? Lock : Unlock
    },
    ...(laneKind(lane) !== "配乐"
      ? [
          {
            key: "hidden" as const,
            active: active("hidden"),
            title: active("hidden") ? "显示轨道" : "隐藏轨道",
            icon: active("hidden") ? EyeOff : Eye
          }
        ]
      : []),
    ...(laneKind(lane) !== "字幕"
      ? [
          {
            key: "muted" as const,
            active: active("muted"),
            title: active("muted") ? "开启声音" : "关闭声音",
            icon: active("muted") ? VolumeX : Volume2
          }
        ]
      : [])
  ];
}
const timelineBottomSpace = 64;
const timelineRoot = ref<HTMLElement>(),
  toolbar = ref<HTMLElement>(),
  summary = ref<HTMLElement>();
const chromeHeight = ref(96),
  scrollPadding = ref(10);
const minimumViewportHeight = computed(() => {
  const heights = new Map<number, number>();
  for (const node of nodes.value) heights.set(node.lane, Math.max(heights.get(node.lane) ?? 0, nodeHeight(node) + 2));
  // The two tallest occupied rows guarantee room for any two adjacent materials.
  // A single row reserves a second slot of the same height; drag-created empty rows do not affect the limit.
  const rows = [...heights.values()].sort((a, b) => b - a);
  return 34 + (rows[0] ?? 58) + (rows[1] ?? rows[0] ?? 58) + scrollPadding.value;
});
const minimumHeight = computed(() => Math.ceil(Math.max(200, minimumViewportHeight.value + chromeHeight.value)));
watch(minimumHeight, (height) => emit("minimum-height", height), { immediate: true });
function measureChrome() {
  if (!timelineRoot.value || !toolbar.value || !summary.value || !viewport.value) return;
  const toolbarHeight = toolbar.value.offsetHeight,
    summaryHeight = summary.value.offsetHeight;
  if (!toolbarHeight || !summaryHeight) return;
  const number = (value: string) => Number.parseFloat(value) || 0;
  const outer = getComputedStyle(timelineRoot.value),
    tools = getComputedStyle(toolbar.value),
    status = getComputedStyle(summary.value),
    scroll = getComputedStyle(viewport.value);
  chromeHeight.value =
    toolbarHeight +
    summaryHeight +
    number(tools.marginTop) +
    number(tools.marginBottom) +
    number(status.marginTop) +
    number(status.marginBottom) +
    number(outer.paddingTop) +
    number(outer.paddingBottom) +
    number(outer.borderTopWidth) +
    number(outer.borderBottomWidth);
  scrollPadding.value = number(scroll.paddingTop) + number(scroll.paddingBottom);
}
let chromeObserver: ResizeObserver | undefined;
const rowCount = computed(() =>
  Math.min(
    2000,
    Math.max(1, ...nodes.value.map((node) => node.lane + 1)) + (gesture.value?.mode === "move" && moved.value ? 1 : 0)
  )
);
const baseSpan = computed(() => Math.min(7200, Math.max(30, props.duration + 15, props.duration * 1.2)));
const span = computed(() => gesture.value?.span ?? baseSpan.value);
const percent = (value: number) => (value / span.value) * 100;
const laneMetrics = computed(() => {
  const heights = new Map<number, number>();
  for (const node of nodes.value) heights.set(node.lane, Math.max(heights.get(node.lane) ?? 0, nodeHeight(node)));
  let offset = 34;
  return Array.from({ length: rowCount.value }, (_, lane) => {
    const height = (heights.get(lane) ?? (gesture.value ? nodeHeight(gesture.value.anchor) : 56)) + 2;
    const result = { top: offset, height };
    offset += height;
    return result;
  });
});
const timelineHeight = computed(() => {
  const last = laneMetrics.value.at(-1)!;
  return last.top + last.height;
});
const laneTop = (lane: number) => laneMetrics.value[lane]?.top ?? timelineHeight.value;
const laneHeight = (lane: number) => laneMetrics.value[lane]?.height ?? 50;
const top = (lane: number) => laneTop(lane) + 1;
function laneAt(y: number) {
  let lo = 0,
    hi = laneMetrics.value.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (y >= laneTop(mid) + laneHeight(mid)) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
const fpsOf = (node?: Node) => props.sources?.find((source) => source.id === node?.clip?.sourceId)?.fps ?? props.fps;
function freezeTimecode(node: Node) {
  const rate = Math.max(1, Math.round(fpsOf(node)));
  const frames = Math.round(node.length * rate),
    seconds = Math.floor(frames / rate);
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60, frames % rate]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}
const clock = (value: number) =>
  `${Math.floor(Math.max(0, value) / 60)}:${(Math.max(0, value) % 60).toFixed(2).padStart(5, "0")}`;
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
type Gesture = {
  mode: "move" | "start" | "end" | "seek" | "box";
  anchor: Node;
  ids: string[];
  originals: Node[];
  x: number;
  y: number;
  px: number;
  span: number;
  dy: number;
  pointerId: number;
  element: HTMLElement;
  additive: boolean;
  selected: string[];
  clips: ArchiveCutClip[];
  studio: ArchiveStudio;
};
const gesture = ref<Gesture>(),
  moved = ref(false),
  dragPreview = ref<Node[]>(),
  dropLane = ref(0),
  guide = ref<number>();
const box = ref<{ left: number; top: number; width: number; height: number }>();
function setZoom(value: number) {
  emit("update:zoom", Math.min(64, Math.max(1, value)));
}
function onWheel(event: WheelEvent) {
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault();
    setZoom(props.zoom * (event.deltaY < 0 ? 1.15 : 1 / 1.15));
  }
}
function point(event: PointerEvent) {
  const rect = track.value!.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}
function initialize(event: PointerEvent, mode: Gesture["mode"], anchor?: Node) {
  if (event.button !== 0 || props.disabled || !track.value) return false;
  event.preventDefault();
  const p = point(event),
    additive = event.ctrlKey || event.metaKey || event.shiftKey;
  const ids = anchor
    ? mode === "move" && props.selected.includes(anchor.id) && !additive
      ? [...props.selected]
      : [anchor.id]
    : [];
  const element = event.currentTarget as HTMLElement;
  element.setPointerCapture(event.pointerId);
  gesture.value = {
    mode,
    anchor: anchor ? clone(anchor) : { id: "", kind: "video", at: 0, length: 0, lane: 0, label: "", index: -1 },
    ids,
    originals: clone(nodes.value.filter((node) => ids.includes(node.id) && !nodeLocked(node.id))),
    x: p.x,
    y: p.y,
    px: track.value.clientWidth / baseSpan.value,
    span: baseSpan.value,
    dy: 0,
    pointerId: event.pointerId,
    element,
    additive,
    selected: [...props.selected],
    clips: clone(props.clips),
    studio: clone(props.studio ?? { sources: [], subtitles: [], musicTracks: [] })
  };
  moved.value = false;
  dragPreview.value = undefined;
  guide.value = undefined;
  element.addEventListener("pointermove", move);
  element.addEventListener("pointerup", finish);
  element.addEventListener("pointercancel", cancel);
  element.addEventListener("lostpointercapture", cancel);
  emit("begin");
  return true;
}
function beginNode(event: PointerEvent, node: Node, mode: "move" | "start" | "end") {
  if (nodeLocked(node.id)) {
    emit("update:selected", [node.id]);
    return;
  }
  if (!initialize(event, mode, node)) return;
  const g = gesture.value!;
  if (g.additive && mode === "move") {
    const selected = props.selected.includes(node.id)
      ? props.selected.filter((id) => id !== node.id)
      : [...props.selected, node.id];
    emit("update:selected", selected);
    g.ids = selected.includes(node.id) ? selected : [node.id];
    g.originals = clone(nodes.value.filter((entry) => g.ids.includes(entry.id) && !nodeLocked(entry.id)));
  } else emit("update:selected", g.ids);
}
function beginBackground(event: PointerEvent) {
  initialize(event, "box");
}
function beginSeek(event: PointerEvent) {
  if (initialize(event, "seek")) seekEvent(event);
}
function seekEvent(event: PointerEvent) {
  const g = gesture.value;
  if (!g) return;
  let position = Math.max(0, Math.min(props.duration, point(event).x / g.px));
  if (props.snapping && !event.altKey) {
    const targets = [0, props.duration, ...nodes.value.flatMap((node) => [node.at, node.at + node.length])];
    position = snap(position, [0], targets, 8 / g.px);
  } else guide.value = undefined;
  emit("seek", Math.max(0, Math.min(props.duration, position)));
}
function snap(delta: number, edges: number[], targets: number[], tolerance: number) {
  const sorted = [...new Set(targets)].sort((a, b) => a - b);
  let best = tolerance,
    result = delta;
  guide.value = undefined;
  for (const edge of edges) {
    const value = edge + delta;
    let lo = 0,
      hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid] < value) lo = mid + 1;
      else hi = mid;
    }
    for (const i of [lo - 1, lo])
      if (sorted[i] !== undefined && Math.abs(sorted[i] - value) < best) {
        best = Math.abs(sorted[i] - value);
        result = delta + sorted[i] - value;
        guide.value = sorted[i];
      }
  }
  return result;
}
function move(event: PointerEvent) {
  const g = gesture.value;
  if (!g || !track.value) return;
  if (viewport.value) {
    const rect = viewport.value.getBoundingClientRect();
    if (event.clientX > rect.right - 24) viewport.value.scrollLeft += 14;
    else if (event.clientX < rect.left + 24) viewport.value.scrollLeft -= 14;
    // 只按真实轨道高度滚动，不能使用拖拽浮层撑出的 scrollHeight。
    const maximum = Math.max(0, track.value.offsetHeight + 10 - viewport.value.clientHeight);
    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    const delta = inside && event.clientY > rect.bottom - 24 ? 12 : inside && event.clientY < rect.top + 24 ? -12 : 0;
    viewport.value.scrollTop = Math.max(0, Math.min(maximum, viewport.value.scrollTop + delta));
  }
  const p = point(event),
    dx = p.x - g.x;
  g.dy = p.y - g.y;
  if (Math.abs(dx) + Math.abs(g.dy) > 3) moved.value = true;
  if (g.mode === "seek") {
    seekEvent(event);
    return;
  }
  if (!moved.value) return;
  if (g.mode === "box") {
    const rect = { left: Math.min(p.x, g.x), top: Math.min(p.y, g.y), width: Math.abs(dx), height: Math.abs(g.dy) };
    box.value = rect;
    const ids = nodes.value
      .filter(
        (node) =>
          node.at * g.px < rect.left + rect.width &&
          (node.at + node.length) * g.px > rect.left &&
          top(node.lane) < rect.top + rect.height &&
          top(node.lane) + nodeHeight(node) > rect.top
      )
      .map((node) => node.id);
    emit("update:selected", g.additive ? [...new Set([...g.selected, ...ids])] : ids);
    return;
  }
  const targets = [
    0,
    props.time,
    ...nodes.value.filter((node) => !g.ids.includes(node.id)).flatMap((node) => [node.at, node.at + node.length])
  ];
  let delta = dx / g.px;
  if (props.snapping && !event.altKey)
    delta = snap(
      delta,
      g.mode === "move"
        ? g.originals.flatMap((node) => [node.at, node.at + node.length])
        : [g.mode === "start" ? g.anchor.at : g.anchor.at + g.anchor.length],
      targets,
      8 / g.px
    );
  else guide.value = undefined;
  if (g.mode === "move") {
    delta = Math.max(
      -Math.min(...g.originals.map((node) => node.at)),
      Math.min(7200 - Math.max(...g.originals.map((node) => node.at + node.length)), delta)
    );
    const requested = laneAt(p.y);
    let laneDelta = requested - g.anchor.lane;
    laneDelta = Math.max(
      -Math.min(...g.originals.map((node) => node.lane)),
      Math.min(1999 - Math.max(...g.originals.map((node) => node.lane)), laneDelta)
    );
    dropLane.value = g.anchor.lane + laneDelta;
    dragPreview.value = g.originals.map((node) => ({ ...node, at: node.at + delta, lane: node.lane + laneDelta }));
  } else {
    const node = clone(g.anchor);
    dropLane.value = node.lane;
    g.dy = 0;
    if (node.clip) {
      const speed = node.clip.speed ?? 1,
        fps = fpsOf(node);
      const sourceDuration =
        node.clip.freezeAt !== undefined
          ? 7200
          : (props.sources?.find((source) => source.id === node.clip!.sourceId)?.duration ?? props.sourceDuration);
      const reversed = node.clip.reverse && node.clip.freezeAt === undefined;
      if (g.mode === "start") {
        const change = Math.max(
          -node.at,
          reversed ? -(sourceDuration - node.clip.end) / speed : -node.clip.start / speed,
          Math.min(node.length - 1 / fps / speed, Math.round(delta * speed * fps) / fps / speed)
        );
        node.clip = archiveSliceClip(node.clip, change);
        node.at += change;
      } else {
        const length = Math.min(
          reversed ? node.clip.end / speed : (sourceDuration - node.clip.start) / speed,
          7200 - node.at,
          Math.max(1 / fps / speed, Math.round((node.length + delta) * speed * fps) / fps / speed)
        );
        node.clip = archiveSliceClip(node.clip, 0, length);
      }
      node.length = archiveClipDuration(node.clip);
    } else if (g.mode === "start") {
      const change = Math.max(-node.at, Math.min(node.length - 0.01, delta));
      node.at += change;
      node.length -= change;
    } else node.length = Math.max(0.01, Math.min(7200 - node.at, node.length + delta));
    dragPreview.value = [node];
  }
  if (dragPreview.value) {
    dragPreview.value = resolveDrop(dragPreview.value);
    dropLane.value = dragPreview.value.find((node) => node.id === g.anchor.id)?.lane ?? dropLane.value;
  }
}
function resolveDrop(preview: Node[]) {
  const ids = new Set(preview.map((node) => node.id));
  const placed = nodes.value.filter((node) => !ids.has(node.id));
  return preview.map((original) => {
    const node = { ...original };
    const conflicts = (lane: number) =>
      placed.some(
        (other) =>
          other.lane === lane &&
          (other.kind !== node.kind ||
            (node.at < other.at + other.length - 1e-7 && node.at + node.length > other.at + 1e-7))
      );
    const origin = nodes.value.find((entry) => entry.id === node.id);
    // 跨轨冲突交给插入轨道处理；不要一律把向上拖动重定向到底部。
    if (conflicts(node.lane) && origin?.lane === node.lane)
      node.lane = Math.max(-1, ...placed.map((other) => other.lane)) + 1;
    placed.push(node);
    return node;
  });
}
function apply(g: Pick<Gesture, "clips" | "studio" | "mode">, preview: Node[]) {
  const clips = g.clips.map((clip, i) => ({ ...clip, at: clip.at ?? starts.value[i], lane: clip.lane ?? 1 })),
    composition = clone(g.studio);
  const resolved = resolveDrop(preview);
  const moving = new Set(resolved.map((node) => node.id));
  const insertions =
    g.mode === "move"
      ? [
          ...new Set(
            resolved
              .filter((node) => {
                const origin = nodes.value.find((entry) => entry.id === node.id);
                return (
                  origin?.lane !== node.lane &&
                  nodes.value.some(
                    (other) =>
                      !moving.has(other.id) &&
                      other.lane === node.lane &&
                      (other.kind !== node.kind ||
                        (node.at < other.at + other.length - 1e-7 && node.at + node.length > other.at + 1e-7))
                  )
                );
              })
              .map((node) => node.lane)
          )
        ].sort((a, b) => a - b)
      : [];
  for (const entry of [
    ...clips,
    ...composition.subtitles,
    ...composition.musicTracks,
    ...(composition.watermarks ?? [])
  ]) {
    if (moving.has(entry.id)) continue;
    const origin = nodes.value.find((node) => node.id === entry.id);
    if (origin) entry.lane = origin.lane + insertions.filter((lane) => lane <= origin.lane).length;
  }
  for (const original of resolved) {
    const node = { ...original, lane: original.lane + insertions.filter((lane) => lane < original.lane).length };
    if (node.kind === "video") {
      const clip = clips.find((clip) => clip.id === node.id)!;
      Object.assign(clip, node.clip, { at: node.at, lane: node.lane });
    } else {
      const list =
        node.kind === "subtitle"
          ? composition.subtitles
          : node.kind === "watermark"
            ? (composition.watermarks ?? [])
            : composition.musicTracks;
      const entry = list.find((entry) => entry.id === node.id)!;
      if ((node.kind === "music" || node.kind === "watermark") && g.mode === "start" && "sourceStart" in entry)
        entry.sourceStart = Math.max(
          0,
          entry.sourceStart + (node.at - entry.start) * ("speed" in entry ? (entry.speed ?? 1) : 1)
        );
      Object.assign(entry, { start: node.at, end: node.at + node.length, lane: node.lane });
      if (node.kind === "watermark") Object.assign(entry, { followEnd: false });
    }
  }
  composition.lanes = Math.max(composition.lanes ?? 0, ...preview.map((node) => node.lane + 1));
  emit("layout", clips, composition);
}
function finish(event: PointerEvent) {
  const g = gesture.value;
  if (!g) return;
  if (moved.value && dragPreview.value) apply(g, dragPreview.value);
  else {
    emit("commit", props.clips);
    if (g.mode === "box" && !moved.value) {
      emit("update:selected", []);
      seekEvent(event);
    }
  }
  cleanup();
}
function cleanup() {
  const g = gesture.value;
  if (g) {
    g.element.removeEventListener("pointermove", move);
    g.element.removeEventListener("pointerup", finish);
    g.element.removeEventListener("pointercancel", cancel);
    g.element.removeEventListener("lostpointercapture", cancel);
  }
  gesture.value = undefined;
  dragPreview.value = undefined;
  guide.value = undefined;
  box.value = undefined;
}
function cancel() {
  emit("cancel");
  cleanup();
}
function keydown(event: KeyboardEvent) {
  if (
    props.disabled ||
    audioEditing.value ||
    event.defaultPrevented ||
    event.isComposing ||
    event.altKey ||
    (event.target as HTMLElement)?.closest(
      'input,textarea,select,[contenteditable]:not([contenteditable="false"]),.n-base-selection,.n-slider'
    )
  )
    return;
  const dialog = (event.target as HTMLElement)?.closest(".n-modal");
  if (dialog && !dialog.classList.contains("audio-editor") && !dialog.querySelector(".audio-editor")) return;
  const key = event.key.toLowerCase(),
    modifier = event.ctrlKey || event.metaKey;
  if (
    (event.target as Element)?.closest("[data-timeline-audio-control]") &&
    !(modifier && (key === "z" || key === "y"))
  )
    return;
  if (key === "escape") {
    cancel();
    return;
  }
  if (gesture.value) return;
  if (
    modifier &&
    !event.shiftKey &&
    key === "c" &&
    nodes.value.some((node) => props.selected.includes(node.id) && !nodeLocked(node.id))
  ) {
    event.preventDefault();
    event.stopImmediatePropagation();
    emit("copy");
  } else if (modifier && !event.shiftKey && key === "v" && props.canPaste) {
    event.preventDefault();
    event.stopImmediatePropagation();
    emit("paste");
  } else if (modifier && (key === "z" || key === "y")) {
    event.preventDefault();
    if (key === "y" || event.shiftKey) emit("redo");
    else emit("undo");
  } else if (modifier && key === "b") {
    event.preventDefault();
    emit("split");
  } else if (!modifier && (key === "q" || key === "w")) {
    event.preventDefault();
    emit("trim", key === "q" ? "left" : "right");
  } else if (!modifier && (key === "delete" || key === "backspace")) {
    event.preventDefault();
    emit("remove");
  } else if (!modifier && key === " ") {
    event.preventDefault();
    emit("play");
  } else if (!modifier && (key === "arrowleft" || key === "arrowright")) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const node = nodes.value
      .filter((node) => node.kind === "video" && props.time >= node.at && props.time < node.at + node.length)
      .sort((a, b) => a.lane - b.lane || b.index - a.index)[0];
    emit(
      "seek",
      Math.max(
        0,
        Math.min(
          props.duration,
          props.time +
            (key === "arrowleft" ? -1 : 1) /
              (node?.clip?.interpolation ? props.outputFps || 30 : fpsOf(node) * (node?.clip?.speed ?? 1))
        )
      )
    );
  }
}
onMounted(() => {
  window.addEventListener("keydown", keydown, true);
  measureChrome();
  if (typeof ResizeObserver !== "undefined") {
    chromeObserver = new ResizeObserver(measureChrome);
    for (const element of [timelineRoot.value, toolbar.value, summary.value])
      if (element) chromeObserver.observe(element);
  }
});
onScopeDispose(() => {
  chromeObserver?.disconnect();
  cleanup();
  window.removeEventListener("keydown", keydown, true);
});
</script>
<style scoped>
.watermark-thumb {
  height: 24px;
  max-width: 42px;
  object-fit: contain;
  pointer-events: none;
  margin-right: 6px;
}
.lane-headers {
  position: sticky;
  left: 0;
  width: 132px;
  height: 0;
  z-index: 21;
}
.lane-header {
  position: absolute;
  left: 0;
  width: 132px;
  background: var(--color-surface, #fff);
  border-bottom: 1px solid var(--color-border);
  border-right: 1px solid var(--color-border);
  padding: 0 8px;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  font-size: 11px;
}
.lane-kind {
  display: grid;
  place-items: center;
  width: 17px;
  flex-shrink: 0;
  color: var(--color-text-secondary);
}
.lane-header div {
  display: flex;
  gap: 5px;
  align-items: center;
  margin-top: 0;
}
.lane-header button {
  display: grid;
  place-items: center;
  width: 27px;
  height: 27px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
}
.lane-header button:hover,
.lane-header button[aria-pressed="true"] {
  background: var(--color-primary-100, #eeeaff);
  color: var(--color-primary-600);
}
.cut-timeline {
  display: flex;
  flex-direction: column;
  height: auto;
  min-height: var(--timeline-min-height, 200px);
  max-height: max(var(--workspace-timeline, 300px), var(--timeline-min-height, 200px));
  box-sizing: border-box;
}
.cut-scroll {
  box-sizing: border-box;
  flex: 0 1 auto;
  min-height: 0;
}

.cut-timeline {
  min-width: 0;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 14px;
  background: var(--color-surface, #fff);
}
.cut-toolbar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
}
.cut-toolbar strong {
  margin-right: 8px;
}
.cut-summary {
  flex-shrink: 0;
  color: var(--color-text-secondary);
  font-size: 12px;
}
.cut-zoom {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}
.cut-zoom input {
  width: 100px;
  accent-color: var(--color-primary-600);
}
.cut-placement {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.cut-placement label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--color-text-secondary);
}
.cut-placement input {
  width: 70px;
  height: 28px;
  box-sizing: border-box;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0 6px;
  color: var(--color-text-primary);
  background: var(--color-surface);
}
.cut-placement input:focus-visible {
  outline: 2px solid var(--color-primary-600);
}
.cut-scroll {
  overflow: auto;
  /* 滚动仍可用，但新增轨道时不让滚动条占用画布宽高。 */
  scrollbar-width: none;
  -ms-overflow-style: none;
  max-height: 480px;
  padding-bottom: 10px;
}
.cut-scroll::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}
.cut-track {
  /* 留白属于可操作画布，沿用点击定位、拖动框选与指针拖动。 */
  margin-left: 132px;
  position: relative;
  min-width: calc(100% - 132px);
  touch-action: none;
  overflow: hidden;
  user-select: none;
  background: var(--color-surface-subtle, #f8f7ff);
}
.cut-ruler {
  height: 30px;
  position: relative;
  cursor: crosshair;
}
.cut-ruler span {
  position: absolute;
  border-left: 1px solid var(--color-border);
  padding-left: 3px;
  font-size: 10px;
  color: var(--color-text-secondary);
  white-space: nowrap;
}
.cut-ruler span:last-child {
  transform: translateX(-100%);
}
.cut-lane {
  position: absolute;
  width: 100%;
  border-top: 1px solid var(--color-border);
  box-sizing: border-box;
  pointer-events: none;
}
.cut-lane.last {
  border-bottom: 1px solid var(--color-border);
}
.cut-lane.target {
  background: rgb(102 80 255 / 8%);
}
.lane-label {
  position: sticky;
  left: 4px;
  font-size: 10px;
  color: var(--color-text-secondary);
  padding: 2px 4px;
}
.cut-node,
.cut-ghost {
  position: absolute;
  box-sizing: border-box;
  border: 2px solid transparent;
  border-radius: 6px;
  background: var(--color-primary-100, #e6e1ff);
  overflow: hidden;
  cursor: grab;
  min-width: 2px;
}
.cut-node.locked {
  cursor: not-allowed;
  filter: saturate(0.5);
}
.cut-node.locked .cut-handle {
  visibility: hidden;
}
.cut-node.selected {
  border-color: var(--color-primary-600);
  box-shadow: inset 0 0 0 1px white;
}
.cut-node.dragging {
  opacity: 0.3;
}
.cut-node.subtitle,
.cut-ghost.subtitle {
  background: #fff0cb;
  color: #69501c;
}
.cut-node.music,
.cut-ghost.music {
  --timeline-audio-wave: #0e91bc;
  --timeline-audio-text: #e4f3ff;
  --timeline-audio-background: #12345a;
  background: #12345a;
  color: #e4f3ff;
}
.node-text {
  position: absolute;
  left: 8px;
  bottom: 4px;
  font-size: 11px;
  white-space: nowrap;
  max-width: calc(100% - 16px);
  overflow: hidden;
  text-overflow: ellipsis;
}
.music .node-text {
  top: 0;
  bottom: auto;
  line-height: 12px;
  z-index: 3;
  pointer-events: none;
}
.cut-node :deep(.timeline-audio) {
  z-index: 2;
}
.video .node-text {
  color: white;
  text-shadow: 0 1px 3px black;
}
.cut-node:focus-visible {
  outline: 2px solid var(--color-primary-600);
}
.cut-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 8px;
  border: 0;
  background: rgb(92 70 255 / 30%);
  cursor: ew-resize;
  padding: 0;
}
.cut-handle.left {
  left: 0;
}
.cut-handle.right {
  right: 0;
}
.cut-ghost {
  border-color: var(--color-primary-600);
  opacity: 0.85;
  z-index: 9;
  pointer-events: none;
  padding: 8px;
}
.drop-guide {
  position: absolute;
  left: 0;
  right: 0;
  border: 1px solid var(--color-primary-600);
  box-sizing: border-box;
  pointer-events: none;
  z-index: 5;
}
.drop-guide span {
  position: sticky;
  left: 6px;
  top: 0;
  background: var(--color-primary-600);
  color: white;
  font-size: 10px;
  padding: 1px 5px;
}
.cut-playhead {
  position: absolute;
  top: 10px;
  bottom: 8px;
  width: 0;
  border-left: 1px solid #d93462;
  z-index: 8;
  cursor: ew-resize;
}
.cut-playhead::after {
  content: "";
  position: absolute;
  left: -7px;
  top: 0;
  width: 14px;
  height: 100%;
}
.cut-playhead span {
  position: absolute;
  top: -1px;
  left: -5.5px;
  width: 10px;
  height: 8px;
  background: #d93462;
  clip-path: polygon(0 0, 100% 0, 50% 100%);
}
.cut-guide {
  position: absolute;
  top: 28px;
  bottom: 0;
  border-left: 1px solid #189a88;
  pointer-events: none;
  z-index: 10;
}
.cut-guide span {
  background: #189a88;
  color: white;
  font-size: 10px;
  white-space: nowrap;
}
.cut-box {
  position: absolute;
  background: rgb(102 80 255 / 15%);
  border: 1px solid var(--color-primary-600);
  z-index: 11;
  pointer-events: none;
}
.cut-summary {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  margin-top: 8px;
  gap: 8px;
}
.transition-badge {
  position: absolute;
  right: 3px;
  top: 2px;
  color: white;
  background: rgb(0 0 0 / 50%);
  font-size: 10px;
  padding: 1px 3px;
  border-radius: 3px;
}
.cut-node.video,
.cut-node.music {
  --audio-controls-opacity: 0;
  --audio-controls-visibility: hidden;
  --audio-controls-events: none;
}
.cut-node.video:hover,
.cut-node.music:hover {
  --audio-controls-opacity: 1;
  --audio-controls-visibility: visible;
  --audio-controls-events: auto;
}

.cut-node.video,
.cut-ghost.video {
  --timeline-audio-wave: #159b9d;
  --timeline-audio-text: #e6f8f8;
  --timeline-audio-background: #074c52;
  background: #074c52;
  color: #e6f8f8;
}
.video-caption {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 15px;
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 0 4px;
  background: #074c52;
  color: #e6f8f8;
  font-size: 10px;
  line-height: 15px;
  overflow: hidden;
  pointer-events: none;
  white-space: nowrap;
}
.video-speed,
.video-duration {
  flex-shrink: 0;
}
.freeze-label,
.freeze-duration {
  flex-shrink: 0;
  padding: 0 2px;
  border-radius: 2px;
  background: rgb(255 255 255 / 12%);
  line-height: 12px;
  font-variant-numeric: tabular-nums;
}
.video-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.video-duration {
  margin-left: auto;
}
.cut-node :deep(.cut-thumb.with-audio) {
  bottom: 26px;
}
.cut-node :deep(.timeline-audio.video-audio) {
  top: auto;
  bottom: 0;
  height: 26px;
  background: #074c52;
}

.cut-node.video.selected,
.cut-node.music.selected {
  border-color: #f3fbff;
  box-shadow:
    0 0 0 1px #16839b,
    inset 0 0 0 1px rgb(255 255 255 / 30%);
}
.cut-node.video .cut-handle,
.cut-node.music .cut-handle {
  background: rgb(255 255 255 / 20%);
}
.cut-node.video.selected .cut-handle,
.cut-node.music.selected .cut-handle {
  background: rgb(255 255 255 / 65%);
}
</style>
