<template>
  <section class="main-column">
    <div class="section-title">
      <div>
        <h2>{{ title }}</h2>
        <p>{{ description }}</p>
      </div>
      <n-button secondary @click="refreshTasks">
        <template #icon>
          <RefreshCw :size="16" />
        </template>
        刷新任务
      </n-button>
    </div>

    <section class="workspace-panel image-tool-panel">
      <div class="form-stack">
        <label class="dropzone">
          <input hidden type="file" accept="image/jpeg,image/png,image/webp" @change="onFileChange" />
          <span>{{ selectedFile ? selectedFile.name : "点击选择图片文件" }}</span>
        </label>

        <n-form label-placement="top">
          <n-form-item label="输出格式">
            <n-select v-model:value="outputFormat" :options="formatOptions" />
          </n-form-item>
          <n-form-item label="质量">
            <n-slider v-model:value="quality" :min="30" :max="95" :step="1" />
          </n-form-item>
          <n-form-item label="宽度限制">
            <n-input-number v-model:value="width" clearable :min="120" :max="6000" placeholder="不填则保持原宽度" />
          </n-form-item>
        </n-form>

        <n-button type="primary" :loading="submitting" block @click="submitTool">
          <template #icon>
            <UploadCloud :size="16" />
          </template>
          {{ submitLabel }}
        </n-button>
      </div>
    </section>
  </section>

  <aside class="side-column">
    <section class="workspace-panel">
      <div class="panel-heading">
        <h3>最近任务</h3>
        <n-tag size="small" round>{{ tasks.length }}</n-tag>
      </div>
      <div v-if="tasks.length" class="task-list">
        <div v-for="task in tasks" :key="task.id" class="task-row">
          <strong>{{ task.toolId }}</strong>
          <n-progress
            type="line"
            :percentage="task.progress"
            :status="task.status === 'failed' ? 'error' : 'success'"
            indicator-placement="inside"
          />
          <n-button
            v-if="task.status === 'completed'"
            text
            type="primary"
            tag="a"
            :href="`/api/files/${task.outputPath?.split(/[\\\\/]/).pop()}`"
            target="_blank"
          >
            下载结果
          </n-button>
        </div>
      </div>
      <n-empty v-else description="暂无任务" />
    </section>
  </aside>
</template>

<script setup lang="ts">
import { ref } from "vue";
import {
  NButton,
  NEmpty,
  NForm,
  NFormItem,
  NInputNumber,
  NProgress,
  NSelect,
  NSlider,
  NTag,
  useMessage
} from "naive-ui";
import { RefreshCw, UploadCloud } from "lucide-vue-next";
import { formatConvertApi } from "../format-convert/api";
import { imageCompressApi } from "../image-compress/api";
import { tasksApi } from "../tasks/api";
import type { ToolTask } from "../../types";

const props = defineProps<{
  toolId: "image-compress" | "format-convert";
  title: string;
  description: string;
  submitLabel: string;
}>();

const message = useMessage();
const selectedFile = ref<File | null>(null);
const quality = ref(78);
const width = ref<number | null>(null);
const outputFormat = ref("webp");
const submitting = ref(false);
const tasks = ref<ToolTask[]>([]);
const toolApis = {
  "image-compress": imageCompressApi,
  "format-convert": formatConvertApi
};

const formatOptions = [
  { label: "WebP", value: "webp" },
  { label: "JPEG", value: "jpeg" },
  { label: "PNG", value: "png" }
];

function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  selectedFile.value = target.files?.[0] ?? null;
}

async function submitTool() {
  if (!selectedFile.value) {
    message.warning("请先选择图片文件");
    return;
  }

  submitting.value = true;
  const form = new FormData();
  form.append("file", selectedFile.value);
  form.append("quality", String(quality.value));
  form.append("outputFormat", outputFormat.value);
  if (width.value) {
    form.append("width", String(width.value));
  }

  try {
    const result = await toolApis[props.toolId].upload(form);
    tasks.value = [result.task, ...tasks.value].filter(Boolean);
    message.success("处理完成，可以下载结果");
  } catch (error) {
    message.error(error instanceof Error ? error.message : "处理失败，请检查文件格式后重试");
  } finally {
    submitting.value = false;
  }
}

async function refreshTasks() {
  try {
    tasks.value = await tasksApi.list();
  } catch (error) {
    message.error(error instanceof Error ? error.message : "获取任务列表失败");
  }
}
</script>
