<template>
  <div class="library-save-actions" :class="{ 'library-save-actions--toolbar': toolbar }">
    <n-button :size="size" :secondary="!toolbar" :loading="saving" :disabled="!completed.length" @click="save()">
      <template v-if="toolbar" #icon><FolderPlus :size="15" /></template>
      {{ saved ? "已加入音频库" : label || "加入音频库" }}
    </n-button>
    <n-button :size="size" :quaternary="!toolbar" :disabled="!completed.length" @click="chooseGroup">
      <template v-if="toolbar" #icon><FolderInput :size="15" /></template>
      {{ toolbar ? "添加至分组" : "添加至…" }}
    </n-button>
  </div>
  <n-modal v-model:show="show"
    ><n-card title="加入音频素材库" class="library-save-dialog" closable @close="show = false"
      ><p>将 {{ completed.length }} 段成功音频及对应双语文案永久保存。不会包含未提交的编辑草稿。</p>
      <n-select v-model:value="target" clearable filterable placeholder="未分组" :options="options" /><template #footer
        ><n-button type="primary" :loading="saving" @click="save(target)">确认添加</n-button></template
      ></n-card
    ></n-modal
  >
</template>
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { NButton, NModal, NCard, NSelect, useMessage } from "naive-ui";
import { FolderInput, FolderPlus } from "lucide-vue-next";
import { audioLibraryApi } from "./api";
import { groupOptions } from "./presentation";
import { formatApiError } from "../../shared/http/http";
const props = withDefaults(
  defineProps<{
    batchId: string;
    items: Array<{ id: string; status: string; attempt?: number }>;
    label?: string;
    engine?: "chatterbox" | "edge-tts";
    size?: "small" | "medium" | "large";
    toolbar?: boolean;
  }>(),
  { size: "small" }
);
const completed = computed(() => props.items.filter((x) => x.status === "completed"));
const message = useMessage(),
  saving = ref(false),
  show = ref(false),
  saved = ref(false),
  target = ref<string | null>(null),
  options = ref<Array<{ label: string; value: string }>>([]);
watch(
  () => `${props.batchId}:${props.items.map((x) => `${x.id}:${x.attempt}:${x.status}`).join(",")}`,
  () => {
    saved.value = false;
  }
);
async function chooseGroup() {
  try {
    options.value = groupOptions((await audioLibraryApi.list({ pageSize: 1 })).groups);
    target.value = null;
    show.value = true;
  } catch (error) {
    message.error(formatApiError(error));
  }
}
async function save(groupId: string | null = null) {
  if (saving.value) return;
  saving.value = true;
  try {
    if (groupId) {
      const data = await audioLibraryApi.list({ pageSize: 1 });
      if (!data.groups.some((x) => x.id === groupId)) groupId = null;
    }
    const importAudio = props.engine === "edge-tts" ? audioLibraryApi.importEdgeTts : audioLibraryApi.importChatterbox;
    const result = await importAudio({
      batchId: props.batchId,
      itemIds: completed.value.map((x) => x.id),
      attempts: Object.fromEntries(
        completed.value.filter((x) => x.attempt !== undefined).map((x) => [x.id, x.attempt!])
      ),
      groupId
    });
    const count = (status: string) => result.results.filter((x) => x.status === status).length;
    const failed = result.results.filter((x) => x.status === "failed");
    saved.value = !failed.length;
    if (failed.length)
      message.warning(
        `新增 ${count("added")} 段，已有 ${count("existing")} 段，失败 ${failed.length} 段：${failed[0].message}`,
        { duration: 8000 }
      );
    else {
      message.success(`已保存 ${count("added")} 段，已有 ${count("existing")} 段，跳过 ${count("skipped")} 段`);
      show.value = false;
    }
  } catch (error) {
    message.error(formatApiError(error));
  } finally {
    saving.value = false;
  }
}
</script>
<style scoped>
.library-save-actions {
  display: inline-flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.library-save-dialog {
  width: min(480px, calc(100vw - 32px));
}
.library-save-actions--toolbar {
  gap: 8px;
}
</style>
