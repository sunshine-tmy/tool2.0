<template>
  <section class="archive-groups" aria-label="归档作品分组">
    <div class="archive-group-filter">
      <span class="archive-group-label"><FolderOpen :size="17" />作品分组</span>
      <n-select
        v-model:value="groupId"
        :options="filterOptions"
        filterable
        size="small"
        aria-label="归档分组筛选"
        class="archive-group-select"
      />
    </div>
    <div class="archive-group-actions">
      <n-button size="small" type="primary" secondary :disabled="busy" @click="edit()">
        <template #icon><Plus :size="15" /></template>新建分组
      </n-button>
      <n-popover v-model:show="managementOpen" trigger="click" placement="bottom-end" :disabled="busy">
        <template #trigger>
          <n-button size="small" quaternary :disabled="busy" :aria-expanded="managementOpen">
            <template #icon><Settings2 :size="15" /></template>管理分组
          </n-button>
        </template>
        <div class="archive-group-menu" role="group" aria-label="分组管理操作">
          <n-button size="small" quaternary :disabled="busy || !current" @click="edit(current)">重命名分组</n-button>
          <n-button size="small" quaternary :disabled="busy || !current" @click="remove">删除分组</n-button>
          <n-button size="small" quaternary :disabled="busy" @click="refreshGroups">刷新分组</n-button>
        </div>
      </n-popover>
    </div>
    <n-button v-if="selectedIds.length" class="archive-group-move" size="small" type="primary" secondary :disabled="busy" @click="openMove">
      <template #icon><FolderInput :size="15" /></template>移动所选 {{ selectedIds.length }}
    </n-button>
    <n-modal v-model:show="moving" preset="card" title="移动到分组" style="width: min(420px, calc(100vw - 32px))">
      <p class="archive-move-description">将选中的 {{ selectedIds.length }} 条作品移入：</p>
      <n-select
        v-model:value="target"
        :options="moveOptions"
        filterable
        placeholder="选择目标分组"
        aria-label="移入目标分组"
      />
      <template #footer>
        <div class="archive-group-dialog-actions">
          <n-button :disabled="busy" @click="moving = false">取消</n-button>
          <n-button type="primary" :loading="busy" :disabled="busy || !selectedIds.length || !target" @click="move">
            确认移动
          </n-button>
        </div>
      </template>
    </n-modal>
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
import { computed, onMounted, ref, watch } from "vue";
import { FolderOpen, FolderInput, Plus, Settings2 } from "lucide-vue-next";
import { NButton, NInput, NModal, NPopover, NSelect, useMessage } from "naive-ui";
import type { ArchiveGroup } from "@toolbox/shared/archive";
import { archiveGroupApi } from "./content-api";
import { useRequestScope } from "../../shared/composables/useRequestScope";
import { useConfirmDialog } from "../../shared/composables/useConfirmDialog";
import { formatApiError, isApiErrorCancelled } from "../../shared/http/http";

const props = defineProps<{ selectedIds: string[] }>();
const emit = defineEmits<{ changed: []; loaded: [groups: ArchiveGroup[]] }>();
const groupId = defineModel<string>("groupId", { default: "all" });
const groups = ref<ArchiveGroup[]>([]),
  target = ref<string | null>(null),
  busy = ref(false),
  editing = ref(false),
  name = ref("");
const editingId = ref<string>();
const managementOpen = ref(false),
  moving = ref(false);
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
watch(
  () => props.selectedIds.length,
  (count) => {
    if (!count) moving.value = false;
  }
);
function report(error: unknown) {
  if (!scope.aborted && !isApiErrorCancelled(error)) message.error(formatApiError(error, "分组操作失败"));
}
function applyGroups(result: ArchiveGroup[]) {
  groups.value = result;
  if (groupId.value !== "all" && groupId.value !== "ungrouped" && !result.some((group) => group.id === groupId.value))
    groupId.value = "all";
  // undefined switches NSelect to uncontrolled state and can resurrect the deleted option's ID.
  if (target.value && target.value !== "ungrouped" && !result.some((group) => group.id === target.value))
    target.value = null;
  emit("loaded", result);
}
async function load() {
  const revision = ++generation;
  try {
    const result = await archiveGroupApi.list(scope.signal);
    if (scope.aborted || revision !== generation) return;
    applyGroups(result);
  } catch (error) {
    report(error);
  }
}
function refreshGroups() {
  managementOpen.value = false;
  return load();
}
function edit(group?: ArchiveGroup) {
  managementOpen.value = false;
  editingId.value = group?.id;
  name.value = group?.name ?? "";
  editing.value = true;
}
function openMove() {
  if (busy.value || !props.selectedIds.length) return;
  managementOpen.value = false;
  moving.value = true;
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
      moving.value = false;
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
  managementOpen.value = false;
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
    // Apply the successful deletion immediately, even if refreshing the remaining groups fails.
    applyGroups(groups.value.filter((entry) => entry.id !== group.id));
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
  gap: 12px;
  padding: 14px 18px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
}
.archive-group-filter,
.archive-group-actions,
.archive-group-dialog-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.archive-group-filter {
  min-width: 0;
}
.archive-group-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  color: var(--color-text);
  font-size: 13px;
  font-weight: 600;
}
.archive-group-label svg { color: var(--color-primary-600); }
.archive-group-actions { padding-left: 12px; border-left: 1px solid var(--color-border); }
.archive-group-actions :deep(.n-button) { height: 32px; border-radius: 7px; }
.archive-group-select :deep(.n-base-selection) { background: var(--color-surface-subtle); }
.archive-group-move { margin-left: auto; }
.archive-group-select {
  width: 240px;
  max-width: 100%;
}
@media (max-width: 600px) {
  .archive-groups { padding: 12px; }
  .archive-group-filter { width: 100%; }
  .archive-group-select { flex: 1; width: auto; }
  .archive-group-actions { padding-left: 0; border-left: 0; }
}
.archive-group-menu {
  display: grid;
  gap: 4px;
  min-width: 128px;
}
.archive-group-dialog-actions {
  justify-content: flex-end;
}
.archive-move-description {
  margin: 0 0 12px;
}
@media (max-width: 640px) {
  .archive-group-filter {
    flex: 1 1 100%;
  }
  .archive-group-select {
    flex: 1;
    width: auto;
    min-width: 0;
  }
}
</style>
