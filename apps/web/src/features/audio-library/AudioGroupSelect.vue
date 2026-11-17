<template>
  <n-cascader
    :value="value ?? ROOT"
    :options="choices"
    :to="true"
    :menu-props="menuProps"
    :filter-menu-props="menuProps"
    filterable
    :filter="filterGroups"
    :placeholder="placeholder"
    :aria-label="placeholder"
    @update:value="(next: string) => emit('update:value', next === ROOT ? null : next)"
  />
</template>

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { NCascader, type CascaderOption } from "naive-ui";

const ROOT = "__audio_library_no_group__";
const menuProps: HTMLAttributes = {
  style: { position: "relative", zIndex: 3000, maxWidth: "calc(100vw - 32px)", overflowX: "auto" }
};
const props = defineProps<{
  value: string | null;
  options: Array<{ label: string; value: string; name?: string; parentId?: string | null }>;
  rootLabel: string;
  placeholder: string;
}>();
const emit = defineEmits<{ "update:value": [value: string | null] }>();
const choices = computed<CascaderOption[]>(() => {
  const nodes = new Map<string, CascaderOption>();
  for (const option of props.options) {
    nodes.set(option.value, { label: option.name ?? option.label, value: option.value });
  }
  const result: CascaderOption[] = [{ label: props.rootLabel, value: ROOT }];
  for (const option of props.options) {
    const node = nodes.get(option.value)!;
    const parent = option.parentId ? nodes.get(option.parentId) : undefined;
    if (parent) {
      (parent.children ||= []).push(node);
    } else {
      result.push(node);
    }
  }
  return result;
});
function filterGroups(pattern: string, _option: CascaderOption, path: CascaderOption[]) {
  const query = pattern.trim().toLocaleLowerCase();
  return path.map((node) => String(node.label ?? "")).join(" / ").toLocaleLowerCase().includes(query);
}
</script>
