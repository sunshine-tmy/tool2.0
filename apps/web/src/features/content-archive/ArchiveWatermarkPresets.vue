<template>
  <section class="watermark-presets" aria-label="关键帧轨迹预设">
    <strong>轨迹预设</strong>
    <n-alert v-if="error" type="error">{{ error }}</n-alert>
    <label
      >选择已保存方案<n-select
        v-model:value="selectedId"
        clearable
        filterable
        :options="options"
        :disabled="busy"
        placeholder="选择轨迹预设"
        aria-label="选择轨迹预设"
    /></label>
    <div class="preset-actions">
      <n-button :disabled="busy || !selected" @click="apply">应用预设</n-button>
      <n-button :disabled="busy || !selected" @click="remove">删除预设</n-button>
      <n-button :disabled="writing || disabled" :loading="loading" @click="load">刷新</n-button>
    </div>
    <n-input
      v-model:value="name"
      :maxlength="60"
      :disabled="busy"
      placeholder="给当前关键帧方案命名"
      aria-label="水印轨迹预设名称"
    />
    <n-button :disabled="busy || !name.trim() || Boolean(validation)" :loading="writing" @click="save"
      >保存当前轨迹为预设</n-button
    >
    <small>只保存轨迹，按水印显示区间的时间比例适配其他视频；不包含水印图片、大小、透明度或配乐。</small>
    <p v-if="message" role="status">{{ message }}</p>
  </section>
</template>
<script setup lang="ts">
import { computed, ref } from "vue";
import { NAlert, NButton, NInput, NSelect } from "naive-ui";
import {
  archiveWatermarkPresetPoints,
  applyArchiveWatermarkPreset,
  watermarkTimingError,
  type ArchiveWatermarkPreset,
  type ArchiveWatermarkSettings
} from "@toolbox/shared/archive";
import { videoEditApi } from "./video-edit-api";
import { useRequestScope } from "../../shared/composables/useRequestScope";
import { useConfirmDialog } from "../../shared/composables/useConfirmDialog";
import { formatApiError, isApiErrorCancelled } from "../../shared/http/http";
const props = defineProps<{ settings: ArchiveWatermarkSettings; duration: number; disabled: boolean }>();
const emit = defineEmits<{ apply: [ArchiveWatermarkSettings] }>();
const scope = useRequestScope(),
  confirm = useConfirmDialog();
const presets = ref<ArchiveWatermarkPreset[]>([]),
  selectedId = ref<string | null>(null),
  name = ref(""),
  error = ref(""),
  message = ref(""),
  loading = ref(false),
  writing = ref(false);
const busy = computed(() => props.disabled || loading.value || writing.value);
const selected = computed(() => presets.value.find((preset) => preset.id === selectedId.value));
const options = computed(() =>
  presets.value.map((preset) => ({ label: `${preset.name} · ${preset.points.length} 个关键帧`, value: preset.id }))
);
const validation = computed(() => watermarkTimingError(props.settings, props.duration));
let generation = 0;
async function load() {
  const version = ++generation;
  loading.value = true;
  error.value = "";
  try {
    const result = await videoEditApi.watermarkPresets(scope.signal);
    if (scope.aborted || version !== generation) return;
    presets.value = result;
    if (!result.some((preset) => preset.id === selectedId.value)) selectedId.value = null;
  } catch (e) {
    if (!scope.aborted && version === generation && !isApiErrorCancelled(e)) error.value = formatApiError(e);
  } finally {
    if (version === generation) loading.value = false;
  }
}
function apply() {
  if (busy.value || !selected.value) return;
  error.value = "";
  try {
    emit("apply", applyArchiveWatermarkPreset(props.settings, selected.value.points, props.duration));
    message.value = `已应用「${selected.value.name}」，保存视频后生效`;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "无法应用轨迹预设";
  }
}
async function save() {
  if (busy.value || !name.value.trim() || validation.value) return;
  writing.value = true;
  error.value = "";
  message.value = "";
  try {
    const saved = await videoEditApi.saveWatermarkPreset(
      { name: name.value.trim(), points: archiveWatermarkPresetPoints(props.settings, props.duration) },
      scope.signal
    );
    if (scope.aborted) return;
    presets.value = [saved, ...presets.value];
    selectedId.value = saved.id;
    name.value = "";
    message.value = `已保存「${saved.name}」，可在其他视频中选择使用`;
  } catch (e) {
    if (!scope.aborted && !isApiErrorCancelled(e))
      error.value = e instanceof Error && !("code" in e) ? e.message : formatApiError(e);
  } finally {
    if (!scope.aborted) writing.value = false;
  }
}
async function remove() {
  if (busy.value || !selected.value) return;
  const target = selected.value;
  writing.value = true;
  error.value = "";
  message.value = "";
  try {
    if (
      !(await confirm(`删除轨迹预设「${target.name}」？已应用到视频的轨迹不受影响。`, {
        title: "删除轨迹预设",
        positiveText: "删除预设"
      })) ||
      scope.aborted
    )
      return;
    await videoEditApi.removeWatermarkPreset(target.id, target.revision, scope.signal);
    if (scope.aborted) return;
    presets.value = presets.value.filter((preset) => preset.id !== target.id);
    selectedId.value = null;
    message.value = "轨迹预设已删除，当前视频的轨迹保持不变";
  } catch (e) {
    if (!scope.aborted && !isApiErrorCancelled(e)) error.value = formatApiError(e);
  } finally {
    if (!scope.aborted) writing.value = false;
  }
}
void load();
</script>
<style scoped>
.watermark-presets {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid #dbe5f2;
  border-radius: 8px;
  background: #f8fafc;
}
.watermark-presets label {
  display: grid;
  gap: 6px;
}
.preset-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
small {
  color: var(--text-secondary, #64748b);
  line-height: 1.6;
}
[role="status"] {
  color: #0f766e;
  margin: 0;
  font-size: 12px;
}
</style>
