<template>
  <n-modal
    :show="show"
    preset="card"
    :title="exporting ? '导出设置' : '保存设置'"
    :mask-closable="false"
    :close-on-esc="!busy"
    :closable="!busy"
    style="width: min(680px, calc(100vw - 32px)); max-height: 88vh"
    @update:show="!$event && emit('cancel')"
  >
    <div class="output-options">
      <p class="description">先完成剪辑、字幕、配乐及水印合成，再按以下设置输出整个视频。</p>
      <n-alert v-if="legacy" type="info" :bordered="false"
        >旧片段补帧设置已停用，请在此确认整个成片的输出设置。原有剪辑与定格画面保留。</n-alert
      >
      <div class="option-row">
        <label>输出帧率</label
        ><n-select
          v-model:value="fps"
          :to="true"
          :menu-props="menuProps"
          aria-label="输出帧率"
          :options="rates"
          :disabled="busy"
        />
      </div>
      <div class="option-row">
        <label>开启智能补帧</label><n-switch v-model:value="enabled" aria-label="开启智能补帧" :disabled="busy" />
      </div>
      <template v-if="enabled">
        <div class="option-row">
          <label>处理方式</label
          ><n-select
            v-model:value="engine"
            :to="true"
            :menu-props="menuProps"
            aria-label="补帧处理方式"
            :disabled="busy"
            :options="engines"
          />
        </div>
        <div class="option-row">
          <label>处理质量</label
          ><n-select
            v-model:value="quality"
            :to="true"
            :menu-props="menuProps"
            aria-label="补帧处理质量"
            :disabled="busy"
            :options="qualities"
          />
        </div>
        <div class="option-row">
          <label>切镜保护</label><n-switch v-model:value="sceneProtection" aria-label="切镜保护" :disabled="busy" />
        </div>
        <div class="option-row">
          <label>AI 失败后使用兼容补帧</label
          ><n-switch v-model:value="allowFallback" aria-label="AI 失败后使用兼容补帧" :disabled="busy" />
        </div>
      </template>
      <p class="description">
        {{
          enabled
            ? "补帧保持成片时长与声音同步；切镜保护同时保护字幕切换边界。"
            : "补帧已关闭。提高输出帧率时仅进行普通帧率转换。"
        }}
      </p>
      <div v-if="enabled" class="capability">
        <span>{{ runtime?.message || "正在检测补帧能力…" }}</span
        ><n-button size="small" quaternary :loading="checking" :disabled="busy" @click="emit('refresh')"
          >重新检测能力</n-button
        >
      </div>
      <n-alert v-if="validation" type="warning" :bordered="false" role="status">{{ validation }}</n-alert>
    </div>
    <template #footer
      ><div class="actions">
        <n-button :disabled="busy" @click="emit('cancel')">取消</n-button
        ><n-button type="primary" :disabled="busy || Boolean(validation)" @click="start">{{
          exporting ? "开始处理并导出" : "开始处理并保存"
        }}</n-button>
      </div></template
    >
  </n-modal>
</template>
<script setup lang="ts">
import { computed, ref, watch, type HTMLAttributes } from "vue";
import { NModal, NSelect, NSwitch, NButton, NAlert } from "naive-ui";
import {
  defaultArchiveInterpolation,
  type ArchiveVideoOutput,
  type ArchiveInterpolation,
  type ArchiveInterpolationRuntime,
  type ArchiveFrame
} from "@toolbox/shared/archive";
const props = defineProps<{
  show: boolean;
  exporting?: boolean;
  initial?: ArchiveVideoOutput;
  runtime?: ArchiveInterpolationRuntime;
  checking?: boolean;
  legacy?: boolean;
  busy?: boolean;
}>();
const emit = defineEmits<{ start: [ArchiveVideoOutput]; cancel: []; refresh: [] }>();
// 弹窗及内容区有 overflow 裁切；菜单挂到外层并沿用分组选择器的弹层层级。
const menuProps: HTMLAttributes = { style: { position: "relative", zIndex: 3000 } };
const enabled = ref(false),
  fps = ref(0),
  engine = ref<ArchiveInterpolation["engine"]>("flow"),
  quality = ref<ArchiveInterpolation["quality"]>("balanced"),
  sceneProtection = ref(true),
  allowFallback = ref(false);
watch(
  () => props.show,
  (show) => {
    if (!show) return;
    const settings = props.initial?.interpolation ?? defaultArchiveInterpolation();
    enabled.value = false;
    fps.value = props.initial?.fps ?? 0;
    engine.value = settings.engine;
    quality.value = settings.quality;
    sceneProtection.value = settings.sceneProtection;
    allowFallback.value = settings.allowFallback;
  },
  { immediate: true }
);
watch(enabled, (value) => {
  if (value && props.show) emit("refresh");
});
const rates = [
  { label: "保持当前项目帧率", value: 0 },
  ...[24, 25, 30, 50, 60, 120].map((value) => ({ label: `${value} FPS`, value }))
];
const engines = computed(() => [
  { label: "AI 补帧（RIFE）", value: "rife", disabled: !props.runtime?.rifeReady },
  { label: "兼容补帧（运动估计）", value: "flow", disabled: !props.runtime?.flowReady }
]);
const qualities = [
  { label: "快速", value: "fast" },
  { label: "均衡", value: "balanced" },
  { label: "高质量", value: "high" }
];
const validation = computed(() =>
  !enabled.value
    ? ""
    : !fps.value
      ? "开启补帧时，请先选择目标输出帧率。"
      : engine.value === "rife" && !props.runtime?.rifeReady && !allowFallback.value
        ? "AI 补帧能力不可用，请先安装能力包，或选择兼容补帧。"
        : engine.value === "flow" && !props.runtime?.flowReady
          ? "兼容补帧不可用，请检查 FFmpeg 能力。"
          : ""
);
function start() {
  if (props.busy || validation.value) return;
  emit("start", {
    ...(fps.value ? { fps: fps.value as ArchiveFrame["fps"] } : {}),
    ...(enabled.value
      ? {
          interpolation: {
            engine: engine.value,
            quality: quality.value,
            sceneProtection: sceneProtection.value,
            allowFallback: allowFallback.value
          }
        }
      : {})
  });
}
</script>
<style scoped>
.output-options {
  max-height: 62vh;
  overflow-y: auto;
  padding-right: 6px;
}
.option-row {
  display: grid;
  grid-template-columns: minmax(160px, 1fr) minmax(180px, 1.1fr);
  align-items: center;
  gap: 16px;
  margin: 20px 0;
}
.option-row .n-switch {
  justify-self: end;
}
.description,
.capability {
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.7;
}
.capability {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
@media (max-width: 520px) {
  .option-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }
  .option-row .n-switch {
    justify-self: start;
  }
}
</style>
