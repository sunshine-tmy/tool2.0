<template>
  <n-modal
    :show="show"
    class="translation-edit-modal"
    preset="card"
    title="编辑英文翻译"
    content-scrollable
    style="width: min(680px, calc(100vw - 32px)); max-height: min(820px, calc(100dvh - 32px))"
    @update:show="onShowChange"
  >
    <n-form label-placement="top">
      <n-form-item label="English 标题"><n-input v-model:value="title" maxlength="2000" /></n-form-item>
      <n-form-item label="English 正文"
        ><n-input
          v-model:value="description"
          type="textarea"
          :autosize="{ minRows: 5, maxRows: 14 }"
          maxlength="100000"
      /></n-form-item>
      <n-form-item v-for="topic in topicFields" :key="topic.topicId" :label="`话题 #${topic.source}`">
        <n-input v-model:value="topic.edited" maxlength="200" />
      </n-form-item>
    </n-form>
    <template #footer>
      <div class="modal-actions">
        <n-button @click="emit('update:show', false)">取消</n-button
        ><n-button type="primary" @click="save">保存英文</n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { NButton, NForm, NFormItem, NInput, NModal } from "naive-ui";
import type { XhsArchiveItem } from "@toolbox/shared";
import { resolveXhsTranslationField } from "@toolbox/shared";

const props = defineProps<{ show: boolean; item?: XhsArchiveItem }>();
const emit = defineEmits<{
  (event: "update:show", value: boolean): void;
  (
    event: "save",
    value: {
      sourceHash: string;
      title: { edited: string };
      description?: { edited: string };
      topics: Array<{ topicId: string; edited: string }>;
    }
  ): void;
}>();
const title = ref("");
const description = ref("");
const topicFields = ref<Array<{ topicId: string; source: string; edited: string }>>([]);
watch(
  () => [props.show, props.item?.id],
  () => {
    if (!props.show || !props.item?.translation) return;
    title.value = resolveXhsTranslationField(props.item.translation.title);
    description.value = resolveXhsTranslationField(props.item.translation.description);
    topicFields.value = props.item.translation.topics.map((topic) => ({
      topicId: topic.topicId,
      source: topic.source,
      edited: resolveXhsTranslationField(topic)
    }));
  },
  { immediate: true }
);
function onShowChange(value: boolean) {
  emit("update:show", value);
}
function save() {
  if (!props.item?.translation) return;
  emit("save", {
    sourceHash: props.item.translation.sourceHash,
    title: { edited: title.value.trim() },
    description: description.value.trim() ? { edited: description.value.trim() } : undefined,
    topics: topicFields.value.map(({ topicId, edited }) => ({ topicId, edited: edited.trim() }))
  });
}
</script>

<style scoped>
:global(.translation-edit-modal.n-card) {
  overflow: hidden;
}
:global(.translation-edit-modal .n-card__content-scrollbar) {
  min-height: 0;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
