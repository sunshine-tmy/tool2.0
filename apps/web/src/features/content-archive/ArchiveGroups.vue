<template>
  <section class="archive-groups" aria-label="归档作品分组">
    <n-select v-model:value="groupId" :options="filterOptions" aria-label="归档分组筛选" class="archive-group-select" />
    <n-button :disabled="busy" @click="edit()">新建分组</n-button>
    <n-button :disabled="busy || !current" @click="edit(current)">重命名分组</n-button>
    <n-button :disabled="busy || !current" @click="remove">删除分组</n-button>
    <n-select
      v-model:value="target"
      :options="moveOptions"
      placeholder="选择目标分组"
      aria-label="移入目标分组"
      class="archive-group-select"
    />
    <n-button :disabled="busy || !selectedIds.length || !target" @click="move"
      >移动所选 {{ selectedIds.length || "" }}</n-button
    >
    <n-button :disabled="busy" @click="load">刷新分组</n-button>
    <n-modal v-model:show="editing" preset="card" title="编辑分组" style="width: min(420px, calc(100vw - 32px))">
      <n-input
        v-model:value="name"
        maxlength="80"
        show-count
        placeholder="请输入分组名称"
        :input-props="{ 'aria-label': '分组名称' }"
        @keyup.enter="save"
      />
      <template #footer
        ><n-button type="primary" :loading="busy" :disabled="busy || !name.trim()" @click="save"
          >保存分组</n-button
        ></template
      >
    </n-modal>
  </section>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { NButton, NInput, NModal, NSelect, useMessage } from "naive-ui";
import type { ArchiveGroup } from "@toolbox/shared/archive";
import { archiveGroupApi } from "./content-api";
import { useRequestScope } from "../../shared/composables/useRequestScope";
import { useConfirmDialog } from "../../shared/composables/useConfirmDialog";
import { formatApiError, isApiErrorCancelled } from "../../shared/http/http";

const props = defineProps<{ selectedIds: string[] }>();
const emit = defineEmits<{ changed: []; loaded: [groups: ArchiveGroup[]] }>();
const groupId = defineModel<string>("groupId", { default: "all" });
const groups = ref<ArchiveGroup[]>([]),
  target = ref<string>(),
  busy = ref(false),
  editing = ref(false),
  name = ref("");
const editingId = ref<string>();
const message = useMessage(),
  confirm = useConfirmDialog(),
  scope = useRequestScope();
let generation = 0;
const current = computed(() => groups.value.find((group) => group.id === groupId.value));
const moveOptions = computed(() => [
  { label: "未分组", value: "ungrouped" },
  ...groups.value.map((group) => ({ label: group.name, value: group.id }))
]);
const filterOptions = computed(() => [{ label: "全部分组", value: "all" }, ...moveOptions.value]);
function report(error: unknown) {
  if (!scope.aborted && !isApiErrorCancelled(error)) message.error(formatApiError(error, "分组操作失败"));
}
async function load() {
  const revision = ++generation;
  try {
    const result = await archiveGroupApi.list(scope.signal);
    if (scope.aborted || revision !== generation) return;
    groups.value = result;
    if (groupId.value !== "all" && groupId.value !== "ungrouped" && !result.some((group) => group.id === groupId.value))
      groupId.value = "all";
    if (target.value !== "ungrouped" && !result.some((group) => group.id === target.value)) target.value = undefined;
    emit("loaded", result);
  } catch (error) {
    report(error);
  }
}
function edit(group?: ArchiveGroup) {
  editingId.value = group?.id;
  name.value = group?.name ?? "";
  editing.value = true;
}
async function save() {
  if (busy.value || !name.value.trim()) return;
  busy.value = true;
  try {
    const result = await archiveGroupApi.save(name.value.trim(), editingId.value, scope.signal);
    if (scope.aborted) return;
    editing.value = false;
    await load();
    if (!scope.aborted) {
      groupId.value = result.id;
      message.success("分组已保存");
    }
  } catch (error) {
    report(error);
  } finally {
    if (!scope.aborted) busy.value = false;
  }
}
async function move() {
  if (busy.value || !target.value || !props.selectedIds.length) return;
  const ids = [...props.selectedIds],
    destination = target.value;
  busy.value = true;
  try {
    await archiveGroupApi.assign(
      { groupId: destination === "ungrouped" ? null : destination, itemIds: ids },
      scope.signal
    );
    if (!scope.aborted) {
      emit("changed");
      message.success("所选作品已移动");
    }
  } catch (error) {
    report(error);
  } finally {
    if (!scope.aborted) busy.value = false;
  }
}
async function remove() {
  const group = current.value;
  if (
    busy.value ||
    !group ||
    !(await confirm(`删除“${group.name}”后，其中的作品将变为未分组；作品、媒体、翻译和截帧均保留。`, {
      title: "删除分组",
      positiveText: "删除分组"
    }))
  )
    return;
  if (scope.aborted || busy.value) return;
  busy.value = true;
  try {
    await archiveGroupApi.remove(group.id, scope.signal);
    if (scope.aborted) return;
    await load();
    if (!scope.aborted) emit("changed");
  } catch (error) {
    report(error);
  } finally {
    if (!scope.aborted) busy.value = false;
  }
}
onMounted(load);
</script>
<style scoped>
.archive-groups {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}
.archive-group-select {
  width: 190px;
  max-width: 100%;
}
</style>
