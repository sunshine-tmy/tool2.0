<template>
  <div v-if="paths" class="tool-page-decoration" :data-tool-decoration="toolId" aria-hidden="true">
    <svg viewBox="0 0 440 128" fill="none" focusable="false">
      <path v-for="path in paths" :key="path" :d="path" />
      <circle cx="160" cy="28" r="3" />
      <circle cx="350" cy="94" r="2" />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ toolId: string }>();

// Decorative outlines only. IDs and workflow metadata remain owned by the catalog.
const motifs: Record<string, readonly string[]> = {
  "image-compress": [
    "M224 24h72a10 10 0 0 1 10 10v54a10 10 0 0 1-10 10h-72a10 10 0 0 1-10-10V34a10 10 0 0 1 10-10Z M228 80l20-24 16 17 10-11 18 18 M280 42h.1",
    "M176 60h24m-9-9 9 9-9 9 M344 60h-24m9-9-9 9 9 9",
    "M200 16h-12v14 M320 100h12V86"
  ],
  "image-ai": [
    "M208 44V24h24 M282 24h24v20 M208 80v20h24 M282 100h24V80 M222 84l26-28 18 20 13-13 14 21",
    "m290 40 5 13 13 5-13 5-5 13-5-13-13-5 13-5Z M332 30v12m-6-6h12",
    "M180 78h.1 M190 90h.1 M322 90h.1 M334 78h.1"
  ],
  "xhs-archive": [
    "M202 34V24a8 8 0 0 1 8-8h62a8 8 0 0 1 8 8 M218 48V38a8 8 0 0 1 8-8h66a8 8 0 0 1 8 8",
    "M240 46h66a8 8 0 0 1 8 8v44a8 8 0 0 1-8 8h-66a8 8 0 0 1-8-8V54a8 8 0 0 1 8-8Z m26 16 22 14-22 14Z",
    "M218 62h-26v30h26 M192 86l10-12 10 10"
  ],
  "video-subtitle": [
    "M204 22h104a10 10 0 0 1 10 10v58a10 10 0 0 1-10 10H204a10 10 0 0 1-10-10V32a10 10 0 0 1 10-10Z M194 38h124 M212 22v16m22-16v16m22-16v16m22-16v16m22-16v16",
    "m244 48 22 13-22 13Z M218 84h24m8 0h20m8 0h16",
    "M182 112h148 M204 108v8m28-8v8m28-8v8m28-8v8m28-8v8"
  ],
  "edge-tts": [
    "M204 52v20m10-30v40m10-50v60m10-42v24 M270 38a12 12 0 0 1 24 0v28a12 12 0 0 1-24 0Z M262 62v4a20 20 0 0 0 40 0v-4 M282 86v16m-12 0h24",
    "M306 26h22a10 10 0 0 1 10 10v9a10 10 0 0 1-10 10h-8l-9 9v-9 M316 38h.1m8 0h.1",
    "M178 58v8 M320 76v16m10-24v32"
  ],
  "audio-library": [
    "M282 64a32 32 0 1 1-64 0 32 32 0 0 1 64 0Z M263 64a13 13 0 1 1-26 0 13 13 0 0 1 26 0Z M250 64h.1",
    "M296 76V32l28-6v44 M296 46l28-6 M296 76c0 10-18 12-18 3s18-12 18-3 M324 70c0 10-18 12-18 3s18-12 18-3",
    "M200 36h-18m18 14h-26m26 14h-18 M214 108h102"
  ],
  "audio-extract": [
    "M190 30h78a8 8 0 0 1 8 8v52a8 8 0 0 1-8 8h-78a8 8 0 0 1-8-8V38a8 8 0 0 1 8-8Z m25 20 24 14-24 14Z",
    "M284 64h22m-8-8 8 8-8 8 M318 50v28m10-42v56m10-46v36m10-28v20",
    "M194 106h46m7 0h14 M170 44v40"
  ],
  "audio-convert": [
    "M214 40a44 44 0 0 1 76-3m-2-15 2 15-15-2 M294 88a44 44 0 0 1-76 3m2 15-2-15 15 2",
    "M230 54v20m12-34v48m12-56v64m12-48v32m12-22v12",
    "M184 54v20m12-32v44 M316 50v28m12-36v44"
  ],
  "json-format": [
    "M224 24h-8a12 12 0 0 0-12 12v14c0 9-5 14-14 14 9 0 14 5 14 14v14a12 12 0 0 0 12 12h8 M290 24h8a12 12 0 0 1 12 12v14c0 9 5 14 14 14-9 0-14 5-14 14v14a12 12 0 0 1-12 12h-8",
    "M238 42h38m-28 14h38m-38 14h28m-38 14h38",
    "M172 42h6m-6 22h6m-6 22h6 M340 50h6m-6 22h6"
  ],
  base64: [
    "M204 30h108a10 10 0 0 1 10 10v48a10 10 0 0 1-10 10H204a10 10 0 0 1-10-10V40a10 10 0 0 1 10-10Z M216 46v12m10-12h8v12h-8Z M250 46v12m12-12v12m12-12h8v12h-8Z M298 46v12",
    "M216 74h8v12h-8Z M240 74v12m12-12h8v12h-8Z M276 74v12m12-12v12m12-12v12",
    "M178 50v28 M338 42v44"
  ],
  "url-codec": [
    "m248 44 12-12a23 23 0 0 1 32 32l-16 16a23 23 0 0 1-32 0 M266 84l-12 12a23 23 0 0 1-32-32l16-16a23 23 0 0 1 32 0",
    "m242 80 30-30 M186 38h24m-14-8-10 8 10 8 M306 94h24m-10-8 10 8-10 8",
    "M200 106h28 M306 20h20"
  ],
  "uuid-generator": [
    "M192 34h30v24h-30Z M240 34h30v24h-30Z M288 34h30v24h-30Z M192 78h30v24h-30Z M240 78h30v24h-30Z M288 78h30v24h-30Z",
    "M228 46h6m42 0h6 M228 90h6m42 0h6 M204 40v12m8-12v12 M252 84v12m8-12v12",
    "M192 68h126 M332 34v68"
  ],
  "lan-transfer": [
    "M190 34h48a6 6 0 0 1 6 6v38h-60V40a6 6 0 0 1 6-6Z M214 78v14m-18 0h36 M300 44h28a6 6 0 0 1 6 6v46a6 6 0 0 1-6 6h-28a6 6 0 0 1-6-6V50a6 6 0 0 1 6-6Z M310 90h8",
    "M252 54h32m-8-8 8 8-8 8 M284 78h-32m8-8-8 8 8 8",
    "M242 22a36 36 0 0 1 38 0 M250 30a22 22 0 0 1 22 0"
  ]
};

const paths = computed(() => motifs[props.toolId]);
</script>

<style scoped>
.tool-page-decoration {
  position: absolute;
  inset: -18px 0 -12px;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse at 70% 40%, color-mix(in srgb, var(--color-primary-600) 6%, transparent), transparent 70%),
    radial-gradient(ellipse at 52% 60%, color-mix(in srgb, var(--color-cyan) 3%, transparent), transparent 65%);
  mask-image: radial-gradient(ellipse 46% 62% at 60% 38%, #000 15%, #0009 45%, transparent 85%);
}
svg {
  position: absolute;
  right: 8%;
  top: 50%;
  width: min(440px, 58%);
  height: 128px;
  transform: translateY(-50%);
  stroke: var(--color-primary-600);
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0.14;
}
path:nth-child(2) {
  stroke: var(--color-cyan);
}
@container tool-content (max-width: 600px) {
  .tool-page-decoration {
    opacity: 0.65;
  }
  svg {
    display: none;
  }
}
</style>
