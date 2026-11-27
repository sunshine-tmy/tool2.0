<template>
  <button
    type="button"
    class="guide-mascot"
    :class="{ 'guide-icon-trigger': failed }"
    data-guide-trigger
    aria-label="新手引导，点击查看教程；可拖动调整位置"
    @click="emit('activate')"
    @pointerenter="wave"
  >
    <CircleHelp v-if="failed" :size="24" aria-hidden="true" />
    <span v-else class="guide-mascot-art" aria-hidden="true">
      <img :src="imageSource" alt="" draggable="false" @load="baseLoaded = true" @error="imageFailed" />
      <img
        v-if="rigReady && assets"
        ref="pawImage"
        class="guide-mascot-paw"
        :src="assets.paw"
        alt=""
        draggable="false"
        @error="imageFailed"
      />
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed, onScopeDispose, ref, shallowRef, watch } from "vue";
import { useMediaQuery } from "@vueuse/core";
import { CircleHelp } from "lucide-vue-next";
import idle from "./assets/unicorn-idle.webp";
import type { motionAssets } from "./mascotMotionAssets";

const props = defineProps<{ active: boolean; dragging: boolean; motionAllowed: boolean }>();
const emit = defineEmits<{ activate: []; fallback: [] }>();
const finePointer = useMediaQuery("(hover: hover) and (pointer: fine)");
const failed = ref(false),
  baseLoaded = ref(false),
  pawImage = ref<HTMLImageElement>();
const assets = shallowRef<typeof motionAssets>();
const phase = ref<"body" | "half" | "closed">("body");
const rigReady = computed(() => baseLoaded.value && !!assets.value);
const imageSource = computed(() => (rigReady.value && assets.value ? assets.value[phase.value] : idle));
const canAnimate = computed(
  () => props.active && !props.dragging && props.motionAllowed && !failed.value && rigReady.value
);
let timer: ReturnType<typeof setTimeout> | undefined;
let animation: Animation | undefined;
let loading: Promise<void> | undefined;
let disposed = false,
  motionFailed = false,
  lastWaveEnd = -Infinity;

function stop() {
  clearTimeout(timer);
  timer = undefined;
  if (animation) {
    animation.onfinish = null;
    animation.cancel();
    animation = undefined;
  }
  phase.value = "body";
}
function imageFailed() {
  if (failed.value) return;
  failed.value = true;
  stop();
  emit("fallback");
}
async function loadMotion() {
  if (loading || motionFailed || assets.value) return loading;
  loading = (async () => {
    try {
      const { motionAssets: urls } = await import("./mascotMotionAssets");
      if (disposed) return;
      await Promise.all(
        Object.values(urls).map(async (src) => {
          const image = new Image();
          image.src = src;
          await image.decode();
        })
      );
      if (!disposed) assets.value = urls;
    } catch {
      // The idle image and tutorial entry remain usable without motion assets.
      motionFailed = true;
    }
  })();
  return loading;
}
function scheduleBlink() {
  if (!canAnimate.value || disposed) return;
  timer = setTimeout(
    () => {
      const frames = ["half", "closed", "half", "body"] as const;
      let index = 0;
      function advance() {
        if (!canAnimate.value || disposed) return;
        phase.value = frames[index++];
        if (index < frames.length) timer = setTimeout(advance, index === 2 ? 80 : 60);
        else scheduleBlink();
      }
      advance();
    },
    6000 + Math.random() * 3000
  );
}
function wave() {
  if (!canAnimate.value || !finePointer.value || !pawImage.value || animation || performance.now() - lastWaveEnd < 3000)
    return;
  stop();
  // Twelve articulated paw poses. The browser interpolates only this limb;
  // there is no whole-character transform, frame loop, or global mouse listener.
  const poses = [0, -12, -37, -75, -105, -96, -115, -92, -108, -62, -22, 0];
  const own = pawImage.value.animate(
    poses.map((angle) => ({ transform: `rotate(${angle}deg)` })),
    {
      duration: 800,
      easing: "ease-in-out",
      iterations: 1
    }
  );
  animation = own;
  own.onfinish = () => {
    if (disposed || animation !== own) return;
    animation = undefined;
    lastWaveEnd = performance.now();
    scheduleBlink();
  };
}
watch(
  () => [props.active, props.motionAllowed, failed.value] as const,
  ([active, motion, error]) => {
    if (active && motion && !error) void loadMotion();
  },
  { immediate: true }
);
watch(
  canAnimate,
  () => {
    stop();
    if (canAnimate.value) scheduleBlink();
  },
  { immediate: true, flush: "sync" }
);
onScopeDispose(() => {
  disposed = true;
  stop();
});
</script>

<style scoped>
.guide-mascot {
  display: block;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  border-radius: 12px;
  background: transparent;
  cursor: grab;
  touch-action: none;
  user-select: none;
}
.guide-mascot-art {
  display: block;
  position: relative;
  width: 100%;
  height: 100%;
  pointer-events: none;
  filter: drop-shadow(0 2px 3px rgb(48 43 105 / 12%));
}
.guide-mascot.guide-icon-trigger {
  display: grid;
  place-items: center;
  color: white;
  background: var(--color-primary-600);
  border-radius: 50%;
}
.guide-mascot-art img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  -webkit-user-drag: none;
}
.guide-mascot-art .guide-mascot-paw {
  position: absolute;
  inset: 0;
  transform-origin: 64.296875% 60.234375%;
}
</style>
