<template>
  <section class="cut-timeline" aria-label="视频自由编排时间线">
    <div class="cut-toolbar">
      <strong>视频粗剪</strong>
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
      <n-button size="small" :disabled="disabled" @click="$emit('play')"
        ><template #icon><Play :size="16" /></template>播放 / 暂停</n-button
      >
      <div v-if="focusedNode" class="cut-placement">
        <label
          >轨道<input
            type="number"
            min="1"
            max="2000"
            :value="focusedNode.lane + 1"
            :disabled="disabled"
            aria-label="选中元素所在轨道"
            @change="place('lane', Number(($event.target as HTMLInputElement).value) - 1)"
        /></label>
        <label
          >起点（秒）<input
            type="number"
            min="0"
            max="7200"
            step="0.01"
            :value="Number(focusedNode.at.toFixed(3))"
            :disabled="disabled"
            aria-label="选中元素在时间线的起点"
            @change="place('at', Number(($event.target as HTMLInputElement).value))"
        /></label>
      </div>
      <span class="cut-clock">{{ clock(time) }} / {{ clock(duration) }}</span>
      <label class="cut-snap"
        ><input
          type="checkbox"
          :checked="snapping"
          @change="$emit('update:snapping', ($event.target as HTMLInputElement).checked)"
        />自动吸附</label
      >
      <div class="cut-zoom">
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
    <div ref="viewport" class="cut-scroll" @wheel="onWheel">
      <div
        ref="track"
        class="cut-track"
        :style="{ width: `${zoom * 100}%`, height: `${34 + rowCount * rowHeight}px` }"
        @pointerdown="beginBackground"
      >
        <div class="cut-ruler" @pointerdown.stop="beginSeek">
          <span v-for="i in 11" :key="i" :style="{ left: `${(i - 1) * 10}%` }">{{ clock((span * (i - 1)) / 10) }}</span>
        </div>
        <div
          v-for="row in rowCount"
          :key="row"
          class="cut-lane"
          :class="{ target: dragPreview && dropLane === row - 1 }"
          :style="{ top: `${34 + (row - 1) * rowHeight}px`, height: `${rowHeight}px` }"
        >
          <span class="lane-label">轨道 {{ row }}</span>
        </div>
        <div
          v-for="node in nodes"
          :key="node.id"
          tabindex="0"
          class="cut-node"
          :class="[
            node.kind,
            { selected: selected.includes(node.id), dragging: gesture?.ids.includes(node.id) && moved }
          ]"
          :data-node-id="node.id"
          :title="`${node.label} · ${clock(node.at)} — ${clock(node.at + node.length)}`"
          :style="{ left: `${percent(node.at)}%`, width: `${percent(node.length)}%`, top: `${top(node.lane)}px` }"
          @pointerdown.stop="beginNode($event, node, 'move')"
        >
          <ArchiveCutThumbnail
            v-if="node.kind === 'video'"
            :url="node.clip?.sourceId ? sourceUrls?.[node.clip.sourceId] || sourceUrl : sourceUrl"
            :time="node.clip?.start ?? 0"
          />
          <span class="node-text">{{ node.label }}</span>
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
              top: `${top(gesture.anchor.lane) + gesture.dy + (node.lane - dropLane) * rowHeight}px`
            }"
          >
            {{ node.label }}
          </div>
          <div class="drop-guide" :style="{ top: `${34 + dropLane * rowHeight}px`, height: `${rowHeight}px` }">
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
    <div class="cut-summary">
      <span>已选 {{ selected.length }} 个元素 · {{ rowCount }} 条轨道</span
      ><span>上方轨道优先显示 · 空隙保留黑屏 · 声音叠加</span>
    </div>
  </section>
</template>
<script setup lang="ts">
import { computed, ref, onMounted, onScopeDispose } from "vue";
import { NButton } from "naive-ui";
import {
  Undo2,
  Redo2,
  SplitSquareHorizontal,
  PanelLeftClose,
  PanelRightClose,
  Trash2,
  Play,
  ZoomIn,
  ZoomOut,
  Copy,
  ClipboardPaste
} from "lucide-vue-next";
import {
  archiveClipDuration,
  archiveCutStarts,
  archiveTransitionDuration,
  type ArchiveStudio,
  type ArchiveStudioSource,
  type ArchiveCutClip
} from "@toolbox/shared/archive";
import ArchiveCutThumbnail from "./ArchiveCutThumbnail.vue";
const props = defineProps<{
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
  canPaste: boolean;
  disabled: boolean;
  sourceUrl: string;
  sourceUrls?: Record<string, string>;
  sources?: ArchiveStudioSource[];
  studio?: ArchiveStudio;
}>();
const emit = defineEmits<{
  "update:selected": [string[]];
  "update:zoom": [number];
  "update:snapping": [boolean];
  seek: [number];
  play: [];
  split: [];
  trim: ["left" | "right"];
  remove: [];
  duplicate: [];
  copy: [];
  paste: [];
  undo: [];
  redo: [];
  begin: [];
  cancel: [];
  commit: [ArchiveCutClip[]];
  studio: [ArchiveStudio];
  layout: [ArchiveCutClip[], ArchiveStudio];
}>();
const actions = computed(() => [
  {
    label: "复制到剪贴板",
    title: "复制选中元素（Ctrl+C / ⌘C）",
    icon: Copy,
    disabled: !props.selected.length,
    run: () => emit("copy")
  },
  {
    label: "粘贴元素",
    title: "在指针处粘贴元素（Ctrl+V / ⌘V）",
    icon: ClipboardPaste,
    disabled: !props.canPaste,
    run: () => emit("paste")
  },
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
  }
]);

type Node = {
  id: string;
  kind: "video" | "subtitle" | "music";
  at: number;
  length: number;
  lane: number;
  label: string;
  index: number;
  clip?: ArchiveCutClip;
};
const rowHeight = 72;
const track = ref<HTMLDivElement>(),
  viewport = ref<HTMLDivElement>();
const starts = computed(() => archiveCutStarts(props.clips));
const nodes = computed<Node[]>(() => [
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
const rowCount = computed(() =>
  Math.min(2000, Math.max(1, ...nodes.value.map((node) => node.lane + 1)) + (gesture.value?.mode === "move" ? 1 : 0))
);
const baseSpan = computed(() => Math.min(7200, Math.max(30, props.duration + 15, props.duration * 1.2)));
const span = computed(() => gesture.value?.span ?? baseSpan.value);
const percent = (value: number) => (value / span.value) * 100;
const top = (lane: number) => 34 + lane * rowHeight + 19;
const fpsOf = (node?: Node) => props.sources?.find((source) => source.id === node?.clip?.sourceId)?.fps ?? props.fps;
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
    originals: clone(nodes.value.filter((node) => ids.includes(node.id))),
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
  if (!initialize(event, mode, node)) return;
  const g = gesture.value!;
  if (g.additive && mode === "move") {
    const selected = props.selected.includes(node.id)
      ? props.selected.filter((id) => id !== node.id)
      : [...props.selected, node.id];
    emit("update:selected", selected);
    g.ids = selected.includes(node.id) ? selected : [node.id];
    g.originals = clone(nodes.value.filter((entry) => g.ids.includes(entry.id)));
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
          top(node.lane) + 44 > rect.top
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
    const requested = Math.max(0, Math.min(rowCount.value - 1, Math.floor((p.y - 34) / rowHeight)));
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
      if (g.mode === "start") {
        const source = Math.max(
          0,
          Math.min(node.clip.end - 1 / fps, Math.round((node.clip.start + delta * speed) * fps) / fps)
        );
        const change = Math.max(-node.at, (source - node.clip.start) / speed);
        node.clip.start += change * speed;
        node.at += change;
      } else
        node.clip.end = Math.min(
          props.sources?.find((source) => source.id === node.clip!.sourceId)?.duration ?? props.sourceDuration,
          node.clip.start + (7200 - node.at) * speed,
          Math.max(node.clip.start + 1 / fps, Math.round((node.clip.end + delta * speed) * fps) / fps)
        );
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
  for (const entry of [...clips, ...composition.subtitles, ...composition.musicTracks]) {
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
      const list = node.kind === "subtitle" ? composition.subtitles : composition.musicTracks;
      const entry = list.find((entry) => entry.id === node.id)!;
      if (node.kind === "music" && g.mode === "start" && "sourceStart" in entry)
        entry.sourceStart = Math.max(0, entry.sourceStart + node.at - entry.start);
      Object.assign(entry, { start: node.at, end: node.at + node.length, lane: node.lane });
    }
  }
  composition.lanes = Math.max(composition.lanes ?? 0, ...preview.map((node) => node.lane + 1));
  emit("layout", clips, composition);
}
const focusedNode = computed(() => nodes.value.find((node) => props.selected.includes(node.id)));
function place(field: "lane" | "at", value: number) {
  if (props.disabled || !focusedNode.value || !Number.isFinite(value) || !props.studio) return;
  const selection = nodes.value.filter((node) => props.selected.includes(node.id));
  let delta = value - focusedNode.value[field];
  if (field === "lane")
    delta = Math.max(
      -Math.min(...selection.map((node) => node.lane)),
      Math.min(1999 - Math.max(...selection.map((node) => node.lane)), Math.round(delta))
    );
  else
    delta = Math.max(
      -Math.min(...selection.map((node) => node.at)),
      Math.min(7200 - Math.max(...selection.map((node) => node.at + node.length)), delta)
    );
  emit("begin");
  apply(
    { clips: clone(props.clips), studio: clone(props.studio), mode: "move" },
    selection.map((node) => ({ ...node, [field]: node[field] + delta }))
  );
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
    event.defaultPrevented ||
    event.isComposing ||
    event.altKey ||
    (event.target as HTMLElement)?.closest('input,textarea,select,[contenteditable="true"],.n-base-selection')
  )
    return;
  const dialog = (event.target as HTMLElement)?.closest(".n-modal");
  if (dialog && !dialog.classList.contains("audio-editor") && !dialog.querySelector(".audio-editor")) return;
  const key = event.key.toLowerCase(),
    modifier = event.ctrlKey || event.metaKey;
  if (key === "escape") {
    cancel();
    return;
  }
  if (gesture.value) return;
  if (modifier && !event.shiftKey && (key === "c" || key === "v")) {
    if (gesture.value || (key === "c" ? !props.selected.length : !props.canPaste)) return;
    event.preventDefault();
    if (key === "c") emit("copy");
    else emit("paste");
  } else if (modifier && (key === "z" || key === "y")) {
    event.preventDefault();
    key === "y" || event.shiftKey ? emit("redo") : emit("undo");
  } else if (modifier && key === "d") {
    event.preventDefault();
    emit("duplicate");
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
        Math.min(props.duration, props.time + (key === "arrowleft" ? -1 : 1) / (fpsOf(node) * (node?.clip?.speed ?? 1)))
      )
    );
  }
}
onMounted(() => window.addEventListener("keydown", keydown, true));
onScopeDispose(() => {
  cleanup();
  window.removeEventListener("keydown", keydown, true);
});
</script>
<style scoped>
.cut-timeline {
  min-width: 0;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 14px;
  background: var(--color-surface, #fff);
}
.cut-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
}
.cut-toolbar strong {
  margin-right: 8px;
}
.cut-clock,
.cut-summary,
.cut-snap {
  color: var(--color-text-secondary);
  font-size: 12px;
}
.cut-clock {
  font-variant-numeric: tabular-nums;
  margin: 0 8px;
}
.cut-snap {
  display: inline-flex;
  align-items: center;
  gap: 4px;
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
  max-height: 480px;
  padding-bottom: 10px;
}
.cut-track {
  position: relative;
  min-width: 100%;
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
  height: 44px;
  box-sizing: border-box;
  border: 2px solid transparent;
  border-radius: 6px;
  background: var(--color-primary-100, #e6e1ff);
  overflow: hidden;
  cursor: grab;
  min-width: 2px;
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
  background: #cdece5;
  color: #244f45;
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
</style>
