<template>
  <section class="archive-groups" data-tour="archive-group-root" aria-label="归档作品分组">
    <div class="archive-group-filter" data-tour="archive-group-filter">
      <span class="archive-group-label"><FolderOpen :size="17" />作品分组</span>
      <n-cascader
        :to="true"
        :menu-props="groupMenuProps"
        :filter-menu-props="groupMenuProps"
        :filter="filterArchiveGroups"
        :value="selectedFilterValues"
        multiple
        :cascade="false"
        :max-tag-count="1"
        @update:value="updateFilter"
        :options="filterOptions"
        filterable
        placeholder="请选择分组"
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
        <div
          class="archive-group-menu"
          data-tour="archive-group-management"
          data-guide-context="archive-group-management"
          role="group"
          aria-label="分组管理操作"
        >
          <n-button size="small" quaternary :disabled="busy || !current" @click="edit(current)">重命名分组</n-button>
          <n-button size="small" quaternary :disabled="busy || !current" @click="remove">删除分组</n-button>
          <n-button size="small" quaternary :disabled="busy" @click="refreshGroups">刷新分组</n-button>
        </div>
      </n-popover>
    </div>
    <n-button
      v-if="selectedIds.length"
      class="archive-group-move"
      size="small"
      type="primary"
      secondary
      :disabled="busy"
      @click="openMove"
    >
      <template #icon><FolderInput :size="15" /></template>移动所选 {{ selectedIds.length }}
    </n-button>
    <n-modal
      v-model:show="moving"
      preset="card"
      title="移动到分组"
      v-bind="guideDialogBinding('archive-group-move', moving)"
      style="width: min(420px, calc(100vw - 32px))"
    >
      <p class="archive-move-description">将选中的 {{ selectedIds.length }} 条作品移入：</p>
      <n-cascader
        :to="true"
        :menu-props="groupMenuProps"
        :filter-menu-props="groupMenuProps"
        :filter="filterArchiveGroups"
        v-model:value="target"
        :options="moveOptions"
        filterable
        placeholder="选择目标分组"
        aria-label="移入目标分组"
        data-tour="archive-group-move-target"
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
    <n-modal
      v-model:show="editing"
      preset="card"
      :title="editingId ? '编辑分组' : '新建分组'"
      v-bind="guideDialogBinding('archive-group-edit', editing)"
      style="width: min(420px, calc(100vw - 32px))"
    >
      <n-input
        v-model:value="name"
        maxlength="80"
        data-tour="archive-group-name"
        show-count
        placeholder="请输入分组名称"
        :input-props="{ 'aria-label': '分组名称' }"
        @keyup.enter="save"
      />
      <div class="archive-parent-field" data-tour="archive-group-parent">
        <label>上级分组（最多三级）</label>
        <n-cascader
          :to="true"
          :menu-props="groupMenuProps"
          :filter-menu-props="groupMenuProps"
          :filter="filterArchiveGroups"
          v-model:value="parent"
          :options="parentOptions"
          filterable
          placeholder="顶级分组"
          clearable
        />
      </div>
      <template #footer
        ><n-button type="primary" :loading="busy" :disabled="busy || !name.trim()" @click="save"
          >保存分组</n-button
        ></template
      >
    </n-modal>
  </section>
</template>
<script setup lang="ts">
import { guideDialogBinding, registerGuideContext, useGuideDialog } from "../../shared/onboarding/contexts";
import { computed, onMounted, ref, watch } from "vue";
import { FolderOpen, FolderInput, Plus, Settings2 } from "lucide-vue-next";
import { NButton, NCascader, NInput, NModal, NPopover, useMessage } from "naive-ui";
import type { ArchiveGroup } from "@toolbox/shared/archive";
import { archiveGroupTree, groupMenuProps, filterArchiveGroups, type ArchiveGroupOption } from "./archive-group-tree";
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
const parent = ref<string | null>(null);
const editingId = ref<string>();
const managementOpen = ref(false),
  moving = ref(false);
const message = useMessage(),
  confirm = useConfirmDialog(),
  scope = useRequestScope();
let generation = 0;
const activeGroupId = ref<string>();
const current = computed(() => {
  const selected = groupId.value.split(",");
  const id =
    activeGroupId.value && selected.includes(activeGroupId.value)
      ? activeGroupId.value
      : selected.length === 1
        ? selected[0]
        : undefined;
  return groups.value.find((group) => group.id === id);
});
const allFilterIds = computed(() => ["ungrouped", ...groups.value.map((group) => group.id)]);
const selectedFilterValues = computed(() =>
  groupId.value === "all" ? ["all", ...allFilterIds.value] : groupId.value === "-" ? [] : groupId.value.split(",")
);
function updateFilter(next: string[]) {
  const before = new Set(selectedFilterValues.value);
  const after = new Set(next);
  if (!before.has("all") && after.has("all")) {
    groupId.value = "all";
    return;
  }
  if (before.has("all") && !after.has("all")) {
    groupId.value = "-";
    activeGroupId.value = undefined;
    return;
  }
  after.delete("all");
  const changed = [...new Set([...before, ...after])].filter((id) => id !== "all" && before.has(id) !== after.has(id));
  for (const id of changed) {
    if (id === "ungrouped") {
      activeGroupId.value = undefined;
      continue;
    }
    activeGroupId.value = after.has(id) ? id : undefined;
    const descendants = [id];
    for (let i = 0; i < descendants.length; i++) {
      groups.value.filter((group) => group.parentId === descendants[i]).forEach((group) => descendants.push(group.id));
    }
    for (const descendant of descendants) after.has(id) ? after.add(descendant) : after.delete(descendant);
  }
  const ordered = allFilterIds.value.filter((id) => after.has(id));
  groupId.value = ordered.length === allFilterIds.value.length ? "all" : ordered.join(",") || "-";
}
const moveOptions = computed(() => [{ label: "未分组", value: "ungrouped" }, ...archiveGroupTree(groups.value)]);
const filterOptions = computed(() => [{ label: "全部分组", value: "all" }, ...moveOptions.value]);
const parentOptions = computed(() => {
  const height = (id: string): number =>
    1 + Math.max(0, ...groups.value.filter((group) => group.parentId === id).map((group) => height(group.id)));
  const maxParentDepth = 3 - (editingId.value ? height(editingId.value) : 1);
  const prune = (options: ArchiveGroupOption[], depth: number): ArchiveGroupOption[] => {
    if (depth > maxParentDepth) return [];
    return options
      .filter((option) => option.value !== editingId.value)
      .map((option) => {
        const children = prune(option.children ?? [], depth + 1);
        return { label: option.label, value: option.value, ...(children.length ? { children } : {}) };
      });
  };
  return prune(archiveGroupTree(groups.value), 1);
});
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
  if (groupId.value !== "all") {
    const valid = new Set(["ungrouped", ...result.map((group) => group.id)]);
    const selected = groupId.value.split(",").filter((id) => valid.has(id));
    groupId.value = selected.join(",") || "-";
  }
  if (activeGroupId.value && !result.some((group) => group.id === activeGroupId.value)) activeGroupId.value = undefined;
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
  parent.value = group?.parentId ?? null;
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
    const result = await archiveGroupApi.save(name.value.trim(), editingId.value, scope.signal, parent.value);
    if (scope.aborted) return;
    editing.value = false;
    await load();
    if (!scope.aborted) {
      activeGroupId.value = result.id;
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
    !(await confirm(`删除“${group.name}”及其子分组后，其中的作品将变为未分组；作品、媒体、翻译和截帧均保留。`, {
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
    const removed = new Set([group.id]);
    let previousSize = 0;
    while (previousSize !== removed.size) {
      previousSize = removed.size;
      groups.value.forEach((entry) => {
        if (entry.parentId && removed.has(entry.parentId)) removed.add(entry.id);
      });
    }
    applyGroups(groups.value.filter((entry) => !removed.has(entry.id)));
    await load();
    if (!scope.aborted) emit("changed");
  } catch (error) {
    report(error);
  } finally {
    if (!scope.aborted) busy.value = false;
  }
}
onMounted(load);

registerGuideContext("archive-groups-overview", { enter: () => () => undefined });
useGuideDialog("archive-group-edit", editing, () => (busy.value ? "分组正在更新，请稍后学习。" : ""));
useGuideDialog("archive-group-management", managementOpen, () => (busy.value ? "分组正在更新，请稍后学习。" : ""));
useGuideDialog("archive-group-move", moving, () =>
  busy.value ? "分组正在更新，请稍后学习。" : !props.selectedIds.length ? "请先在列表选中要移动的作品。" : ""
);
</script>
<style scoped>
.archive-groups {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
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
.archive-group-label svg {
  color: var(--color-primary-600);
}
.archive-group-actions {
  padding-left: 12px;
  border-left: 1px solid var(--color-border);
}
.archive-group-actions :deep(.n-button) {
  height: 32px;
  border-radius: 7px;
}
.archive-group-select :deep(.n-base-selection) {
  background: var(--color-surface-subtle);
}
.archive-group-move {
  margin-left: auto;
}
.archive-group-select {
  width: 240px;
  max-width: 100%;
}
@container tool-content (max-width: 600px) {
  .archive-group-filter {
    width: 100%;
  }
  .archive-group-select {
    flex: 1;
    width: auto;
  }
  .archive-group-actions {
    padding-left: 0;
    border-left: 0;
  }
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
.archive-parent-field {
  display: grid;
  gap: 8px;
  margin-top: 16px;
}
@container tool-content (max-width: 640px) {
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
