<template>
  <n-popover v-if="mode === 'button'" trigger="click" placement="bottom-end" @update:show="onShow">
    <template #trigger>
      <n-button quaternary circle aria-label="局域网访问" title="局域网访问" class="lan-trigger">
        <template #icon><Network :size="19" /></template>
      </n-button>
    </template>
    <div class="lan-popover"><AccessContent /></div>
  </n-popover>
  <AccessContent v-else />
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, ref } from "vue";
import { NButton, NInput, NPopover, NSelect, useMessage } from "naive-ui";
import { Copy, Network, RefreshCw } from "lucide-vue-next";
import type { LanApplicationAccess } from "@toolbox/shared";
import { lanAccessApi } from "./lan-access";
import { copyTextToClipboard } from "../../shared/utils/clipboard";

const props = withDefaults(defineProps<{ mode?: "button" | "panel" }>(), { mode: "button" });
const message = useMessage();
const access = ref<LanApplicationAccess>();
const selected = ref("");
const loading = ref(false);
const error = ref("");
const options = computed(() => access.value?.urls.map((url) => ({ label: url, value: url })) ?? []);
async function refresh() {
  if (loading.value) return;
  loading.value = true;
  error.value = "";
  try {
    access.value = await lanAccessApi.get();
    if (!access.value.urls.includes(selected.value)) selected.value = access.value.urls[0] ?? "";
  } catch {
    access.value = undefined;
    selected.value = "";
    error.value = "读取局域网地址失败，请确认主服务运行后重试。";
  } finally {
    loading.value = false;
  }
}
async function copy() {
  if (!selected.value) return;
  try {
    await copyTextToClipboard(selected.value);
    message.success("局域网地址已复制");
  } catch {
    message.warning("复制失败，请选中地址手动复制");
  }
}
function onShow(show: boolean) {
  if (show) void refresh();
}
onMounted(() => {
  if (props.mode === "panel") void refresh();
});

// 两个入口使用同一内容，地址在打开或刷新时读取实际监听端口，不缓存旧网卡地址。
const AccessContent = defineComponent({
  setup: () => () =>
    h("section", { class: "lan-access", "aria-label": "局域网访问" }, [
      h("div", { class: "lan-heading" }, [
        h("h3", "局域网访问"),
        h(
          NButton,
          { size: "small", quaternary: true, loading: loading.value, onClick: refresh, "aria-label": "刷新局域网地址" },
          {
            icon: () => h(RefreshCw, { size: 15 }),
            default: () => "刷新地址"
          }
        )
      ]),
      h("p", { class: "lan-copy", role: "status" }, error.value || access.value?.message || "正在读取局域网地址…"),
      selected.value
        ? h("div", { class: "lan-address-row" }, [
            options.value.length > 1
              ? h(NSelect, {
                  value: selected.value,
                  options: options.value,
                  "aria-label": "局域网使用地址",
                  "onUpdate:value": (value: string) => {
                    selected.value = value;
                  }
                })
              : h(NInput, { value: selected.value, readonly: true, "aria-label": "局域网使用地址" }),
            h(
              NButton,
              { secondary: true, type: "primary", onClick: copy },
              { icon: () => h(Copy, { size: 15 }), default: () => "复制地址" }
            )
          ])
        : null,
      h(
        "p",
        { class: "lan-copy" },
        "仅与可信局域网成员共享：访客可操作主机上的业务数据。模型与任务在主机运行，使用期间请保持桌面应用开启。"
      ),
      h(
        "p",
        { class: "lan-copy" },
        "系统设置、安装与环境修复仅限本机。若其他设备打不开，请检查同一网络、防火墙或网络隔离；应用不会自动修改防火墙。"
      )
    ])
});
</script>

<style scoped>
.lan-trigger {
  width: var(--shell-icon-size, 36px);
  height: var(--shell-icon-size, 36px);
  flex-shrink: 0;
}
.lan-popover {
  width: min(460px, calc(100vw - 56px));
}
.lan-access {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.lan-access :deep(.lan-heading) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.lan-access :deep(.lan-heading h3) {
  margin: 0;
  font-size: 16px;
}
.lan-access :deep(.lan-copy) {
  margin: 0;
  color: var(--text-secondary, #64748b);
  font-size: 13px;
  line-height: 1.7;
  overflow-wrap: anywhere;
}
.lan-access :deep(.lan-address-row) {
  display: flex;
  gap: 12px;
  max-width: 720px;
}
.lan-access :deep(.lan-address-row > :first-child) {
  flex: 1;
  min-width: 0;
}
@media (max-width: 480px) {
  .lan-access :deep(.lan-address-row) {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
