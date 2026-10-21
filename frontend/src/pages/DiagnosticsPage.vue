<template>
  <ToolLayout>
    <section class="main-column diagnostics-page">
      <ToolPageHeader
        title="启动与环境诊断"
        description="先看原因与影响，再决定是否处理。轻检不会加载模型、联网生成或修改数据。"
        kicker="SETTINGS · DIAGNOSTICS"
      />
      <section class="workspace-panel">
        <div class="diagnostic-heading">
          <div>
            <h3>
              {{
                offline
                  ? "基础服务暂不可用"
                  : running
                    ? run?.phase
                    : issueCount
                      ? `发现 ${issueCount} 项需要关注的问题`
                      : "基础服务正常"
              }}
            </h3>
            <p class="muted">
              {{
                run
                  ? `已完成 ${run.checks.filter((c) => c.status !== "checking").length} 项 · ${(run.elapsedMs / 1000).toFixed(1)} 秒 · ${run.startedAt.replace("T", " ").slice(0, 19)}`
                  : "尚无本次检查记录"
              }}
            </p>
          </div>
          <n-space :size="12" wrap>
            <n-button :loading="loading" :disabled="running" @click="refresh"
              ><template #icon><RefreshCw :size="16" /></template>重新检查</n-button
            >
            <n-button type="primary" secondary :disabled="offline || running" @click="deepOpen = true"
              >深度检查</n-button
            >
            <n-button :disabled="!run" @click="copySummary">复制摘要</n-button>
            <n-button :disabled="!run || running" @click="reportOpen = true">导出报告</n-button>
            <n-button v-if="running" @click="cancel">取消检查</n-button>
          </n-space>
        </div>
        <n-alert v-if="error" type="error" :bordered="false">{{ error }}</n-alert>
        <n-alert v-if="offline" type="warning" :bordered="false">
          页面只能确认连接未成功，无法据此知道后端退出原因。请在项目目录运行
          <n-text code>pnpm run doctor</n-text> 查看本机环境，或在桌面启动诊断窗口导出摘要。未修改端口、权限或配置。
        </n-alert>
        <n-alert v-if="running" type="info" :bordered="false"
          >{{ run?.phase }}。模型加载取消时需等待当前调用安全结束，期间保持维护锁。</n-alert
        >
      </section>
      <section v-if="issues.length" class="workspace-panel">
        <h3>优先处理</h3>
        <div v-for="check in issues" :key="check.id" class="issue-row">
          <div>
            <strong>{{ check.title }}</strong>
            <p>{{ check.message }}</p>
            <p class="muted">影响：{{ check.impact }} · 建议：{{ check.suggestion }}</p>
          </div>
          <n-button v-if="check.action" size="small" secondary :disabled="running" @click="perform(check)">{{
            check.action === "components" ? "查看能力管理" : "重启子服务"
          }}</n-button>
        </div>
      </section>
      <section v-if="run" class="workspace-panel">
        <h3>分类检查结果</h3>
        <n-collapse
          :default-expanded-names="[
            'service',
            'capability',
            ...run.checks.filter((c) => focus && c.modules.includes(focus)).map((c) => c.category)
          ]"
        >
          <n-collapse-item
            v-for="category in categories"
            :key="category.id"
            :name="category.id"
            :title="category.label"
          >
            <div
              v-for="check in run.checks.filter((c) => c.category === category.id)"
              :id="check.id"
              :key="check.id"
              class="check-row"
              :class="{ focused: focus && check.modules.includes(focus) }"
            >
              <div class="check-title">
                <strong>{{ check.title }}</strong
                ><n-tag :type="statusType(check.status)" size="small" :bordered="false">{{
                  statusLabel[check.status]
                }}</n-tag>
              </div>
              <p>{{ check.message }}</p>
              <p class="muted">影响：{{ check.impact }}</p>
              <p class="muted">建议：{{ check.suggestion }}</p>
              <n-collapse
                ><n-collapse-item title="技术详情" :name="check.id"
                  ><n-code
                    :code="`${check.code}${check.evidence ? '\n' + check.evidence : ''}`"
                    word-wrap /></n-collapse-item
              ></n-collapse>
            </div>
            <n-empty
              v-if="!run.checks.some((c) => c.category === category.id)"
              size="small"
              description="本次未检查此分类"
            />
          </n-collapse-item>
        </n-collapse>
      </section>
      <section class="workspace-panel">
        <h3>诊断记录</h3>
        <p class="muted">仅保留本次页面会话最近 10 次结果，不包含原始日志或个人素材。</p>
        <n-space
          ><n-button v-for="record in history" :key="record.id" size="small" :disabled="running" @click="run = record"
            >{{ record.startedAt.slice(11, 19) }} · {{ record.depth === "deep" ? "深检" : "轻检" }}</n-button
          ></n-space
        >
      </section>
      <n-modal v-model:show="deepOpen" preset="card" title="选择深度检查项目" class="diagnostic-modal">
        <n-alert type="warning" :bordered="false"
          >模型检查可能占用 GPU
          和较多内存；在线自然音色会向服务商发送固定测试短句。所有检查串行执行，忙碌时拒绝启动，不保存为业务任务。</n-alert
        >
        <n-checkbox-group v-model:value="targets"
          ><n-space vertical :size="16" class="target-list"
            ><n-checkbox v-for="target in deepTargets" :key="target.value" :value="target.value">{{
              target.label
            }}</n-checkbox></n-space
          ></n-checkbox-group
        >
        <template #footer
          ><n-space justify="end"
            ><n-button @click="deepOpen = false">取消</n-button
            ><n-button type="primary" :disabled="!targets.length" :loading="loading" @click="startDeep"
              >确认并检查</n-button
            ></n-space
          ></template
        >
      </n-modal>
      <n-modal v-model:show="reportOpen" preset="card" title="导出脱敏报告" class="diagnostic-modal">
        <p>报告仅包含应用及系统版本、检查结果、阶段和原因码，不包含数据库、配置文件、用户文案、媒体或原始日志。</p>
        <n-checkbox v-model:checked="includeEvents">额外加入本次脱敏诊断事件</n-checkbox>
        <template #footer
          ><n-space justify="end"
            ><n-button @click="reportOpen = false">取消</n-button
            ><n-button type="primary" @click="exportReport">保存 JSON 报告</n-button></n-space
          ></template
        >
      </n-modal>
    </section>
  </ToolLayout>
</template>
<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  NAlert,
  NButton,
  NCheckbox,
  NCheckboxGroup,
  NCode,
  NCollapse,
  NCollapseItem,
  NEmpty,
  NModal,
  NSpace,
  NTag,
  NText,
  useDialog,
  useMessage
} from "naive-ui";
import { RefreshCw } from "lucide-vue-next";
import { diagnosticSummary, type DiagnosticCheck, type DiagnosticRun } from "@toolbox/shared";
import ToolLayout from "../layouts/ToolLayout.vue";
import ToolPageHeader from "../components/tool/ToolPageHeader.vue";
import { diagnosticsApi } from "../services/diagnostics";
import { formatApiError } from "../services/http";
const route = useRoute(),
  router = useRouter(),
  dialog = useDialog(),
  message = useMessage();
const run = ref<DiagnosticRun>(),
  history = ref<DiagnosticRun[]>([]),
  loading = ref(false),
  offline = ref(false),
  error = ref("");
const deepOpen = ref(false),
  reportOpen = ref(false),
  targets = ref<string[]>([]),
  includeEvents = ref(false);
const focus = computed(() => (typeof route.query.module === "string" ? route.query.module : ""));
const running = computed(() => run.value?.state === "running");
const issues = computed(() =>
  (run.value?.checks ?? [])
    .filter((c) => ["failed", "warning", "unknown"].includes(c.status))
    .sort(
      (a, b) =>
        (a.category === "service" ? -10 : focus.value && a.modules.includes(focus.value) ? -5 : 0) -
        (b.category === "service" ? -10 : focus.value && b.modules.includes(focus.value) ? -5 : 0)
    )
);
const issueCount = computed(() => issues.value.length);
const categories = [
  { id: "service", label: "基础服务" },
  { id: "storage", label: "存储与数据库" },
  { id: "environment", label: "运行环境" },
  { id: "capability", label: "功能能力" },
  { id: "external", label: "外部服务" }
];
const statusLabel: Record<DiagnosticCheck["status"], string> = {
  checking: "检查中",
  ok: "正常",
  warning: "警告",
  failed: "失败",
  "not-installed": "未安装",
  skipped: "已跳过",
  unknown: "无法判断"
};
function statusType(status: DiagnosticCheck["status"]): "default" | "success" | "warning" | "error" | "info" {
  return status === "ok"
    ? "success"
    : status === "failed"
      ? "error"
      : ["warning", "unknown"].includes(status)
        ? "warning"
        : status === "checking"
          ? "info"
          : "default";
}
const deepTargets = computed(() => [
  { value: "image-ai", label: "AI 图片：实际加载本地模型（占用内存 / GPU）" },
  { value: "chatterbox", label: "参考音色克隆：实际加载本地模型（占用内存 / GPU）" },
  { value: "edge-tts", label: "在线自然音色：固定英文短句真实合成（需要联网）" },
  ...(run.value?.checks ?? [])
    .filter(
      (c) => c.componentId && c.action === "components" && c.status !== "not-installed" && c.status !== "checking"
    )
    .map((c) => ({ value: `integrity-${c.componentId}`, label: `${c.title}：完整性与安装自检（读取全部组件文件）` }))
]);
let timer: ReturnType<typeof setTimeout> | undefined,
  disposed = false;
function remember(value: DiagnosticRun) {
  if (value.state !== "running")
    history.value = [value, ...history.value.filter((x) => x.id !== value.id)].slice(0, 10);
}
async function refresh() {
  loading.value = true;
  error.value = "";
  try {
    const value = await diagnosticsApi.snapshot(true);
    if (disposed) return;
    run.value = value;
    offline.value = false;
    remember(value);
  } catch (e) {
    if (!disposed) {
      offline.value = true;
      error.value = formatApiError(e, "无法连接本地服务");
      run.value = {
        id: `browser-${Date.now()}`,
        schemaVersion: 1,
        mode: window.toolboxDesktop ? "desktop" : "development",
        depth: "light",
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        state: "completed",
        phase: "浏览器侧连接检查",
        elapsedMs: 0,
        events: [],
        checks: [
          {
            id: "browser-connection",
            title: "浏览器连接",
            category: "service",
            status: "failed",
            code: "BROWSER_CONNECTION_FAILED",
            message: "未取得有效的诊断响应，无法确定后端是否退出",
            impact: "当前页面无法读取服务端检查结果",
            suggestion: "运行 pnpm run doctor 或查看桌面启动诊断窗口",
            modules: []
          }
        ]
      };
    }
  } finally {
    loading.value = false;
  }
}
async function startDeep() {
  loading.value = true;
  error.value = "";
  try {
    run.value = await diagnosticsApi.start({ depth: "deep", targets: targets.value, confirmed: true });
    try {
      sessionStorage.setItem("toolbox-diagnostic-run", run.value.id);
    } catch {
      /* 会话存储不可用不影响检查。 */
    }
    deepOpen.value = false;
    poll();
  } catch (e) {
    error.value = formatApiError(e, "无法开始检查");
  } finally {
    loading.value = false;
  }
}
function poll() {
  clearTimeout(timer);
  if (disposed || !run.value || run.value.state !== "running") return;
  const id = run.value.id;
  timer = setTimeout(async () => {
    try {
      const next = await diagnosticsApi.get(id);
      if (disposed || run.value?.id !== id) return;
      run.value = next;
      remember(next);
    } catch (e) {
      if (!disposed) error.value = formatApiError(e, "进度暂不可用，将重试");
    }
    poll();
  }, 1000);
}
async function cancel() {
  if (run.value)
    try {
      run.value = await diagnosticsApi.cancel(run.value.id);
    } catch (e) {
      error.value = formatApiError(e);
    }
}
async function copySummary() {
  if (run.value)
    try {
      await navigator.clipboard.writeText(diagnosticSummary(run.value));
      message.success("诊断摘要已复制");
    } catch {
      message.error("复制失败，请导出报告");
    }
}
async function exportReport() {
  if (!run.value) return;
  try {
    const report = run.value.id.startsWith("browser-")
      ? {
          filename: "toolbox-browser-diagnostics.json",
          content: JSON.stringify({ application: "ecommerce-toolbox", ...run.value }, null, 2)
        }
      : await diagnosticsApi.report(run.value.id, includeEvents.value);
    if (window.toolboxDesktop?.saveDiagnosticReport) await window.toolboxDesktop.saveDiagnosticReport(report.content);
    else {
      const url = URL.createObjectURL(new Blob([report.content], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = report.filename;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    reportOpen.value = false;
  } catch (e) {
    error.value = formatApiError(e, "报告未保存");
  }
}
function perform(check: DiagnosticCheck) {
  if (check.action === "components") {
    void router.push({ path: "/settings", query: { component: check.componentId }, hash: "#capability-management" });
    return;
  }
  dialog.warning({
    title: "确认重启子服务",
    content: "仅重启应用管理的子服务，不删除模型和素材。有任务、等待队列、安装或播放时会拒绝执行。",
    positiveText: "确认重启",
    negativeText: "取消",
    onPositiveClick: async () => {
      try {
        run.value = await diagnosticsApi.restart(check.componentId!);
        remember(run.value);
      } catch (e) {
        error.value = formatApiError(e, "未执行重启");
      }
    }
  });
}
onMounted(async () => {
  try {
    const saved = sessionStorage.getItem("toolbox-diagnostic-run");
    if (saved && /^[A-Za-z0-9-]{1,80}$/.test(saved)) {
      const value = await diagnosticsApi.get(saved);
      if (disposed) return;
      run.value = value;
      remember(value);
      if (value.state === "running") {
        poll();
        return;
      }
    }
  } catch {
    /* 主服务重启后旧记录可能不存在，继续轻检。 */
  }
  await refresh();
});
onBeforeUnmount(() => {
  disposed = true;
  clearTimeout(timer);
});
</script>
<style scoped>
.diagnostics-page {
  gap: 20px;
}
.diagnostic-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  flex-wrap: wrap;
}
.diagnostics-page h3 {
  margin: 0 0 12px;
}
.muted {
  color: #64748b;
  font-size: 13px;
}
.issue-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  padding: 16px 0;
  border-top: 1px solid #e2e8f0;
}
.issue-row p,
.check-row p {
  margin: 6px 0;
  overflow-wrap: anywhere;
}
.check-row {
  padding: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  margin-bottom: 12px;
}
.check-row.focused {
  border-color: #93c5fd;
  background: #f8fbff;
}
.check-title {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}
.target-list {
  margin: 24px 0;
}
.diagnostics-page :deep(.n-alert) {
  margin-top: 16px;
}
</style>
<style>
.diagnostic-modal {
  width: min(680px, calc(100vw - 32px));
}
</style>
