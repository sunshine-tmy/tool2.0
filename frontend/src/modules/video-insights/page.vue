<template>
  <ToolLayout>
    <section class="insights-page">
      <div class="page-heading">
        <div>
          <p class="eyebrow">LOCAL-FIRST VIDEO RESEARCH</p>
          <h2>短视频竞品拆解</h2>
          <p>支持公开分享链接或本地视频上传，输出证据拆解、具体改法、优化终稿和改动清单。</p>
        </div>
        <n-tag :type="modelConfig.enabled ? 'success' : 'default'" round>
          {{ modelConfig.enabled ? `模型增强：${modelConfig.model}` : "规则拆解模式" }}
        </n-tag>
      </div>

      <section class="create-panel">
        <div class="source-tabs">
          <button type="button" :class="{ active: createMode === 'link' }" @click="createMode = 'link'">
            分享链接
          </button>
          <button type="button" :class="{ active: createMode === 'upload' }" @click="createMode = 'upload'">
            上传视频
          </button>
        </div>
        <template v-if="createMode === 'link'">
          <n-input
            v-model:value="sourceInput"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 4 }"
            placeholder="粘贴抖音、小红书或 TikTok 公开分享链接"
          />
          <div class="create-actions">
            <select v-model="platform" class="native-select" aria-label="选择平台">
              <option value="auto">自动识别</option>
              <option value="douyin">抖音</option>
              <option value="xiaohongshu">小红书</option>
              <option value="tiktok">TikTok</option>
            </select>
            <n-button type="primary" :loading="creating" @click="createInsight">创建竞品卡片</n-button>
          </div>
        </template>
        <template v-else>
          <input ref="videoFileInput" class="visually-hidden" type="file" accept="video/*" @change="selectUploadFile" />
          <button class="upload-dropzone" type="button" @click="videoFileInput?.click()">
            <strong>{{ uploadFile?.name || "选择本地视频" }}</strong>
            <span v-if="uploadFile">{{ formatBytes(uploadFile.size) }} · 点击可重新选择</span>
            <span v-else>支持常见视频格式；需已配置本地转写，原视频分析后立即删除</span>
          </button>
          <div class="create-actions">
            <span class="muted">仅保存转写、拆解和最终稿，不保存原视频</span>
            <n-button type="primary" :disabled="!uploadFile" :loading="uploading" @click="uploadInsight"
              >上传并分析</n-button
            >
          </div>
        </template>
      </section>

      <section class="filters">
        <n-input
          v-model:value="filters.keyword"
          clearable
          placeholder="搜索标题、文案、备注、标签"
          @keyup.enter="refreshList"
        />
        <select v-model="filters.platform" class="native-select" aria-label="筛选平台" @change="refreshList">
          <option value="all">全部平台</option>
          <option value="douyin">抖音</option>
          <option value="xiaohongshu">小红书</option>
          <option value="tiktok">TikTok</option>
          <option value="unknown">本地上传</option>
        </select>
        <n-input v-model:value="filters.tag" clearable placeholder="标签" @keyup.enter="refreshList" />
        <label class="checkbox-label"><input v-model="filters.favorite" type="checkbox" /> 仅收藏</label>
        <label class="checkbox-label"><input v-model="filters.archived" type="checkbox" /> 已归档</label>
        <n-button secondary @click="refreshList">筛选</n-button>
      </section>

      <div class="workbench">
        <section class="card-list" aria-label="竞品卡片列表">
          <div class="list-caption">
            <span>{{ total }} 条卡片</span><span>{{ loading ? "加载中…" : "" }}</span>
          </div>
          <button
            v-for="item in items"
            :key="item.id"
            class="insight-card"
            :class="{ selected: selected?.id === item.id }"
            type="button"
            @click="selectInsight(item.id)"
          >
            <img v-if="item.coverUrl" :src="item.coverUrl" :alt="item.title" loading="lazy" />
            <div class="card-copy">
              <div class="card-meta">{{ sourceName(item) }} · {{ formatDate(item.createdAt) }}</div>
              <strong>{{ item.title }}</strong>
              <p>{{ item.analysis.hook?.text || item.description || "等待文本拆解" }}</p>
              <div class="tag-row">
                <n-tag v-for="tag in item.tags.slice(0, 4)" :key="`${tag.source}-${tag.value}`" size="small">{{
                  tag.value
                }}</n-tag>
              </div>
            </div>
          </button>
          <n-empty v-if="!loading && !items.length" description="还没有竞品卡片" />
          <div v-if="pageCount > 1" class="pagination">
            <n-button size="small" :disabled="page <= 1" @click="changePage(page - 1)">上一页</n-button>
            <span>{{ page }} / {{ pageCount }}</span>
            <n-button size="small" :disabled="page >= pageCount" @click="changePage(page + 1)">下一页</n-button>
          </div>
        </section>

        <section class="detail-panel">
          <n-empty v-if="!selected" description="从左侧选择一条竞品卡片" />
          <template v-else>
            <div class="detail-header">
              <div>
                <p class="card-meta">
                  {{ sourceName(selected) }} ·
                  {{ selected.author?.name || selected.source?.originalFileName || "未知作者" }}
                </p>
                <h3>{{ selected.title }}</h3>
              </div>
              <div class="detail-actions">
                <n-button size="small" @click="toggleFavorite">{{ selected.favorite ? "取消收藏" : "收藏" }}</n-button>
                <n-button size="small" @click="toggleArchived">{{ selected.archived ? "取消归档" : "归档" }}</n-button>
                <n-button size="small" :loading="analyzing" @click="rerun('rules')">规则重跑</n-button>
                <n-button
                  v-if="modelConfig.enabled"
                  size="small"
                  type="primary"
                  :loading="analyzing"
                  @click="rerun('model')"
                  >模型增强</n-button
                >
              </div>
            </div>

            <p v-if="selected.description" class="description">{{ selected.description }}</p>
            <p v-if="selected.transcript.warning" class="warning">{{ selected.transcript.warning }}</p>

            <div class="quality-banner" :class="`quality-${selected.analysis.quality.level}`">
              <div>
                <strong>证据充分度 {{ selected.analysis.quality.score }}/100</strong>
                <span>{{ confidenceLabel(selected.analysis.quality.level) }}</span>
              </div>
              <p>{{ selected.analysis.quality.reasons.join("；") }}</p>
            </div>

            <article class="brief-card">
              <div class="section-heading">
                <h4>一句话拆解</h4>
                <n-tag size="small" :bordered="false">规则引擎 v{{ selected.analysis.version }}</n-tag>
              </div>
              <p>{{ selected.analysis.brief.oneSentenceSummary }}</p>
              <div class="brief-meta">
                <span><strong>内容类型</strong>{{ contentModeLabel(selected.analysis.brief.contentMode) }}</span>
                <span><strong>内容角度</strong>{{ selected.analysis.brief.contentAngle }}</span>
                <span><strong>核心承诺/观点</strong>{{ selected.analysis.brief.coreMessage || "未发现" }}</span>
                <span
                  ><strong>转化目标</strong
                  >{{ conversionGoalLabel(selected.analysis.brief.primaryConversionGoal) }}</span
                >
              </div>
            </article>

            <article class="detail-section improvement-section">
              <div class="section-heading">
                <div>
                  <h4>具体修改建议</h4>
                  <p class="muted">按优先级处理；每条都给出问题、动作、示例和预期效果</p>
                </div>
                <n-tag :bordered="false" size="small">{{ selected.analysis.improvements.length }} 项</n-tag>
              </div>
              <div class="improvement-list">
                <article v-for="item in selected.analysis.improvements" :key="item.id" class="improvement-card">
                  <div class="section-heading">
                    <div class="improvement-title">
                      <n-tag size="small" :type="priorityType(item.priority)">{{ priorityLabel(item.priority) }}</n-tag>
                      <strong>{{ item.title }}</strong>
                    </div>
                    <span class="muted">{{ improvementCategoryLabel(item.category) }}</span>
                  </div>
                  <dl>
                    <div>
                      <dt>当前问题</dt>
                      <dd>{{ item.problem }}</dd>
                    </div>
                    <div>
                      <dt>具体怎么改</dt>
                      <dd>{{ item.recommendation }}</dd>
                    </div>
                    <div v-if="item.rewriteExample">
                      <dt>改写示例</dt>
                      <dd class="rewrite-example">{{ item.rewriteExample }}</dd>
                    </div>
                    <div>
                      <dt>预期改善</dt>
                      <dd>{{ item.expectedImpact }}</dd>
                    </div>
                  </dl>
                  <p v-if="item.evidence" class="evidence-meta">
                    原文证据 {{ formatRange(item.evidence) }} · “{{ item.evidence.text }}”
                  </p>
                </article>
                <n-empty v-if="!selected.analysis.improvements.length" description="当前没有高优先级修改项" />
              </div>
            </article>

            <article class="detail-section final-output-section">
              <div class="section-heading">
                <div>
                  <h4>最终优化版本</h4>
                  <p class="muted">{{ selected.analysis.finalOutput.strategy }}</p>
                </div>
                <div class="final-actions">
                  <n-tag :type="finalStatusType(selected.analysis.finalOutput.status)" size="small">
                    {{ finalStatusLabel(selected.analysis.finalOutput.status) }}
                  </n-tag>
                  <n-button size="small" @click="copyFinalScript">复制最终稿</n-button>
                </div>
              </div>
              <pre class="final-script">{{ selected.analysis.finalOutput.fullScript }}</pre>
              <div class="final-sections">
                <div v-for="section in selected.analysis.finalOutput.sections" :key="`${section.role}-${section.text}`">
                  <n-tag size="small" :type="section.origin === 'placeholder' ? 'warning' : 'default'">{{
                    section.label
                  }}</n-tag>
                  <span>{{ section.text }}</span>
                  <small>{{ sectionOriginLabel(section.origin) }}</small>
                </div>
              </div>
              <ul v-if="selected.analysis.finalOutput.verificationNotes.length" class="verification-list">
                <li v-for="note in selected.analysis.finalOutput.verificationNotes" :key="note">{{ note }}</li>
              </ul>
            </article>

            <article class="detail-section change-log-section">
              <div class="section-heading">
                <h4>本次改进了哪些点</h4>
                <span class="muted">修改前 → 修改后 → 修改原因</span>
              </div>
              <div class="change-list">
                <article v-for="change in selected.analysis.changeLog" :key="`${change.area}-${change.after}`">
                  <strong>{{ change.area }}</strong>
                  <div>
                    <small>修改前</small>
                    <p>{{ change.before }}</p>
                  </div>
                  <div>
                    <small>修改后</small>
                    <p>{{ change.after }}</p>
                  </div>
                  <div>
                    <small>原因</small>
                    <p>{{ change.reason }}</p>
                  </div>
                </article>
              </div>
            </article>

            <div class="analysis-grid">
              <article class="analysis-box hook-box">
                <div class="section-heading">
                  <h4>前 5 秒钩子 · {{ selected.analysis.hookAnalysis?.label || "未识别" }}</h4>
                  <n-tag
                    v-if="selected.analysis.hookAnalysis"
                    size="small"
                    :type="confidenceType(selected.analysis.hookAnalysis.confidence)"
                  >
                    {{ selected.analysis.hookAnalysis.score }} 分
                  </n-tag>
                </div>
                <blockquote>{{ selected.analysis.hookAnalysis?.text || "未提取到足够文本" }}</blockquote>
                <p v-if="selected.analysis.hookAnalysis" class="evidence-meta">
                  关键证据 {{ formatRange(selected.analysis.hookAnalysis.evidence) }} ·
                  {{ selected.analysis.hookAnalysis.evidence.text }}
                </p>
                <div v-if="selected.analysis.hookAnalysis?.strengths.length" class="signal-list">
                  <span v-for="item in selected.analysis.hookAnalysis.strengths" :key="item">✓ {{ item }}</span>
                </div>
                <div v-if="selected.analysis.hookAnalysis?.weaknesses.length" class="weakness-list">
                  <span v-for="item in selected.analysis.hookAnalysis.weaknesses" :key="item">需优化：{{ item }}</span>
                </div>
              </article>

              <article class="analysis-box">
                <h4>可复用原话</h4>
                <ol class="phrase-list">
                  <li v-for="phrase in selected.analysis.reusablePhrases" :key="phrase">{{ phrase }}</li>
                  <li v-if="!selected.analysis.reusablePhrases.length">未发现证据充分的可复用话术</li>
                </ol>
              </article>
            </div>

            <article class="detail-section">
              <div class="section-heading">
                <h4>脚本关键点</h4>
                <span class="muted">只展示达到规则阈值的结论，不强行补齐</span>
              </div>
              <div class="keypoint-grid">
                <article
                  v-for="point in selected.analysis.keyPoints"
                  :key="`${point.kind}-${point.statement}`"
                  class="keypoint-card"
                >
                  <div class="section-heading">
                    <n-tag size="small" :type="confidenceType(point.confidence)">{{ point.label }}</n-tag>
                    <span class="score">{{ point.score }} / 100</span>
                  </div>
                  <strong>{{ point.statement }}</strong>
                  <p>{{ point.whyItMatters }}</p>
                  <div
                    v-for="evidence in point.evidence"
                    :key="`${evidence.startSeconds}-${evidence.text}`"
                    class="evidence-line"
                  >
                    <time>{{ formatRange(evidence) }}</time>
                    <span>“{{ evidence.text }}”</span>
                    <small>{{ evidence.signals.join("、") }}</small>
                  </div>
                </article>
                <n-empty v-if="!selected.analysis.keyPoints.length" description="文本中没有达到可信阈值的关键点" />
              </div>
            </article>

            <article v-if="selected.analysis.sellingPointChains.length" class="detail-section">
              <div class="section-heading">
                <h4>核心卖点证据链</h4>
                <span class="muted">功能/机制 → 用户收益 → 可信证明</span>
              </div>
              <div class="selling-chains">
                <article v-for="chain in selected.analysis.sellingPointChains" :key="chain.claim" class="selling-chain">
                  <div class="section-heading">
                    <strong>{{ chain.claim }}</strong>
                    <n-tag size="small" :type="confidenceType(chain.confidence)">{{ chain.score }} 分</n-tag>
                  </div>
                  <div class="chain-flow">
                    <span><small>功能/机制</small>{{ chain.featureOrMechanism || "未找到直接机制证据" }}</span>
                    <b>→</b>
                    <span><small>用户收益</small>{{ chain.userBenefit || "未找到明确收益" }}</span>
                    <b>→</b>
                    <span><small>证明</small>{{ chain.proof || "未找到证明，可信度受限" }}</span>
                  </div>
                </article>
              </div>
            </article>

            <article class="detail-section">
              <div class="section-heading">
                <h4>转化脚本骨架</h4>
                <strong class="formula">{{ selected.analysis.scriptBlueprint.formula }}</strong>
              </div>
              <div class="segments">
                <div
                  v-for="stage in selected.analysis.scriptBlueprint.stages"
                  :key="`${stage.role}-${stage.order}`"
                  class="segment-stage"
                >
                  <span class="stage-order">{{ stage.order }}</span>
                  <div>
                    <div class="stage-title">
                      <strong>{{ stage.label }}</strong>
                      <n-tag size="small" :type="confidenceType(stage.confidence)">{{ stage.score }} 分</n-tag>
                      <time>{{ formatRange(stage.evidence[0]) }}</time>
                    </div>
                    <p>{{ stage.summary }}</p>
                    <small>目的：{{ stage.objective }}</small>
                  </div>
                </div>
              </div>
            </article>

            <article class="detail-section">
              <h4>关键词实体</h4>
              <div v-for="group in keywordGroups" :key="group.label" class="keyword-group">
                <strong>{{ group.label }}</strong>
                <div class="keyword-groups">
                  <span v-for="word in group.values" :key="word" class="keyword">{{ word }}</span>
                  <span v-if="!group.values.length" class="muted">未发现</span>
                </div>
              </div>
            </article>

            <div class="analysis-grid">
              <article class="analysis-box missing-box">
                <h4>脚本缺失环节</h4>
                <ul>
                  <li v-for="item in selected.analysis.missingElements" :key="item">{{ item }}</li>
                  <li v-if="!selected.analysis.missingElements.length">关键说服环节较完整</li>
                </ul>
              </article>
              <article class="analysis-box risk-box">
                <h4>核对与合规风险</h4>
                <ul>
                  <li v-for="item in selected.analysis.risks" :key="item">{{ item }}</li>
                </ul>
              </article>
            </div>

            <article v-if="selected.analysis.model" class="detail-section">
              <h4>模型增强结论</h4>
              <p><strong>主题：</strong>{{ selected.analysis.model.topic || "—" }}</p>
              <p><strong>受众：</strong>{{ selected.analysis.model.targetAudience || "—" }}</p>
              <p><strong>卖点：</strong>{{ selected.analysis.model.coreSellingPoints.join("；") || "—" }}</p>
              <p><strong>改写方向：</strong>{{ selected.analysis.model.rewriteDirections.join("；") || "—" }}</p>
              <p>
                <strong>模型补充建议：</strong>{{ selected.analysis.model.improvementSuggestions.join("；") || "—" }}
              </p>
              <template v-if="selected.analysis.model.optimizedScript">
                <p><strong>模型建议稿（需人工核验事实）：</strong></p>
                <pre class="final-script">{{ selected.analysis.model.optimizedScript }}</pre>
              </template>
            </article>

            <article class="detail-section editor-section">
              <h4>人工编辑</h4>
              <n-input v-model:value="draft.title" placeholder="标题" />
              <n-input v-model:value="draft.tags" placeholder="标签，用英文逗号分隔" />
              <n-input
                v-model:value="draft.notes"
                type="textarea"
                :autosize="{ minRows: 2, maxRows: 6 }"
                placeholder="运营备注"
              />
              <n-input
                v-model:value="draft.scriptDraft"
                type="textarea"
                :autosize="{ minRows: 3, maxRows: 8 }"
                placeholder="人工修订的脚本、话术或选题方向"
              />
              <div class="editor-actions">
                <n-button type="primary" :loading="saving" @click="saveDraft">保存修改</n-button>
                <n-button type="error" tertiary :loading="deleting" @click="deleteInsight">删除卡片</n-button>
              </div>
            </article>

            <article class="detail-section transcript-section">
              <div class="section-heading">
                <h4>原始转写证据</h4>
                <span class="muted">关键点引用会高亮；低置信片段需人工回看</span>
              </div>
              <div v-if="selected.transcript.analysis?.timeline.length" class="transcript-timeline">
                <div
                  v-for="cue in selected.transcript.analysis.timeline"
                  :key="cue.index"
                  class="transcript-cue"
                  :class="{ referenced: isReferencedCue(cue.text), uncertain: isLowConfidenceCue(cue.index) }"
                >
                  <time>{{ formatRange(cue) }}</time>
                  <p>{{ cue.text }}</p>
                  <n-tag v-if="isLowConfidenceCue(cue.index)" size="small" type="warning">需核对</n-tag>
                </div>
              </div>
              <p v-else>未生成转写文本</p>
            </article>
          </template>
        </section>
      </div>
    </section>
  </ToolLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { NButton, NEmpty, NInput, NTag, useMessage } from "naive-ui";
import type { InsightConfidence, ModelProviderConfig, VideoInsight } from "@toolbox/shared";
import ToolLayout from "../../layouts/ToolLayout.vue";
import { copyTextToClipboard } from "../../utils/clipboard";
import { videoInsightsApi } from "./api";

const message = useMessage();
const createMode = ref<"link" | "upload">("link");
const sourceInput = ref("");
const platform = ref<"auto" | "douyin" | "xiaohongshu" | "tiktok">("auto");
const creating = ref(false);
const uploading = ref(false);
const uploadFile = ref<File>();
const videoFileInput = ref<HTMLInputElement>();
const loading = ref(false);
const saving = ref(false);
const deleting = ref(false);
const analyzing = ref(false);
const items = ref<VideoInsight[]>([]);
const selected = ref<VideoInsight>();
const total = ref(0);
const page = ref(1);
const pageCount = ref(1);
const modelConfig = ref<ModelProviderConfig>({ enabled: false, provider: null });
const filters = reactive({ keyword: "", platform: "all", tag: "", favorite: false, archived: false });
const draft = reactive({ title: "", tags: "", notes: "", scriptDraft: "" });

const keywordGroups = computed(() => {
  const keywords = selected.value?.analysis.keywords;
  return [
    { label: "产品/品类", values: keywords?.product ?? [] },
    { label: "价格", values: keywords?.price ?? [] },
    { label: "促销", values: keywords?.promotion ?? [] },
    { label: "行动词", values: keywords?.action ?? [] }
  ];
});

const referencedEvidence = computed(() => {
  if (!selected.value) return [];
  return [
    selected.value.analysis.hookAnalysis?.evidence.text,
    ...selected.value.analysis.keyPoints.flatMap((point) => point.evidence.map((evidence) => evidence.text))
  ].filter((value): value is string => Boolean(value));
});

onMounted(() => void loadList());

async function loadList(nextPage = page.value) {
  loading.value = true;
  try {
    const result = await videoInsightsApi.list({
      page: nextPage,
      pageSize: 12,
      keyword: filters.keyword || undefined,
      platform: filters.platform as "all" | "douyin" | "xiaohongshu" | "tiktok" | "unknown",
      tag: filters.tag || undefined,
      favorite: filters.favorite || undefined,
      archived: filters.archived || undefined
    });
    items.value = result.items;
    total.value = result.total;
    page.value = result.page;
    pageCount.value = result.pageCount;
    modelConfig.value = result.model;
    if (selected.value) {
      const refreshed = result.items.find((item) => item.id === selected.value?.id);
      if (refreshed) setSelected(refreshed);
    }
  } catch (error) {
    message.error(errorMessage(error));
  } finally {
    loading.value = false;
  }
}

async function createInsight() {
  if (!sourceInput.value.trim()) return message.warning("请先粘贴公开分享链接");
  creating.value = true;
  try {
    const insight = await videoInsightsApi.create(sourceInput.value, platform.value);
    sourceInput.value = "";
    await loadList(1);
    setSelected(insight);
    message.success("竞品卡片已保存到本地");
  } catch (error) {
    message.error(errorMessage(error));
  } finally {
    creating.value = false;
  }
}

function selectUploadFile(event: Event) {
  const input = event.target as HTMLInputElement;
  uploadFile.value = input.files?.[0];
}

async function uploadInsight() {
  if (!uploadFile.value) return message.warning("请先选择视频文件");
  uploading.value = true;
  try {
    const insight = await videoInsightsApi.upload(uploadFile.value);
    uploadFile.value = undefined;
    if (videoFileInput.value) videoFileInput.value.value = "";
    await loadList(1);
    setSelected(insight);
    message.success("视频已完成本地转写与竞品拆解，原视频临时文件已清理");
  } catch (error) {
    message.error(errorMessage(error));
  } finally {
    uploading.value = false;
  }
}

async function selectInsight(id: string) {
  try {
    setSelected(await videoInsightsApi.get(id));
  } catch (error) {
    message.error(errorMessage(error));
  }
}

function setSelected(insight: VideoInsight) {
  selected.value = insight;
  draft.title = insight.title;
  draft.tags = insight.tags
    .filter((tag) => tag.source === "manual")
    .map((tag) => tag.value)
    .join(", ");
  draft.notes = insight.notes;
  draft.scriptDraft = insight.scriptDraft;
}

async function saveDraft() {
  if (!selected.value) return;
  saving.value = true;
  try {
    const result = await videoInsightsApi.update(selected.value.id, {
      title: draft.title,
      tags: draft.tags
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      notes: draft.notes,
      scriptDraft: draft.scriptDraft
    });
    setSelected(result);
    await loadList();
    message.success("已保存");
  } catch (error) {
    message.error(errorMessage(error));
  } finally {
    saving.value = false;
  }
}

async function toggleFavorite() {
  if (!selected.value) return;
  await updateFlag("favorite", !selected.value.favorite);
}

async function toggleArchived() {
  if (!selected.value) return;
  await updateFlag("archived", !selected.value.archived);
}

async function updateFlag(flag: "favorite" | "archived", value: boolean) {
  if (!selected.value) return;
  try {
    setSelected(await videoInsightsApi.update(selected.value.id, { [flag]: value }));
    await loadList();
  } catch (error) {
    message.error(errorMessage(error));
  }
}

async function rerun(mode: "rules" | "model") {
  if (!selected.value) return;
  analyzing.value = true;
  try {
    setSelected(await videoInsightsApi.analyze(selected.value.id, mode));
    await loadList();
    message.success(mode === "model" ? "模型增强已完成" : "规则拆解已更新");
  } catch (error) {
    message.error(errorMessage(error));
  } finally {
    analyzing.value = false;
  }
}

async function copyFinalScript() {
  const script = selected.value?.analysis.finalOutput.fullScript;
  if (!script) return;
  try {
    await copyTextToClipboard(script);
    message.success("最终稿已复制");
  } catch (error) {
    message.error(errorMessage(error));
  }
}

async function deleteInsight() {
  if (!selected.value || !window.confirm("确定删除这条本地竞品卡片吗？")) return;
  deleting.value = true;
  try {
    await videoInsightsApi.remove(selected.value.id);
    selected.value = undefined;
    await loadList();
    message.success("已删除");
  } catch (error) {
    message.error(errorMessage(error));
  } finally {
    deleting.value = false;
  }
}

function changePage(nextPage: number) {
  void loadList(nextPage);
}
function refreshList() {
  void loadList();
}
function platformName(value: string) {
  return value === "douyin" ? "抖音" : value === "xiaohongshu" ? "小红书" : value === "tiktok" ? "TikTok" : "未知平台";
}
function sourceName(item: VideoInsight) {
  return item.source?.type === "upload" ? "本地上传" : platformName(item.platform);
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(new Date(value));
}
function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
function formatRange(value?: { startSeconds?: number; endSeconds?: number }) {
  if (!value || value.startSeconds === undefined) return "无时间定位";
  const start = formatSeconds(value.startSeconds);
  return value.endSeconds === undefined ? start : `${start}–${formatSeconds(value.endSeconds)}`;
}
function formatSeconds(value: number) {
  const seconds = Math.max(0, Math.floor(value));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
function confidenceLabel(value: InsightConfidence) {
  return value === "high" ? "证据较充分" : value === "medium" ? "中等证据" : "需人工核对";
}
function confidenceType(value: InsightConfidence) {
  return value === "high" ? "success" : value === "medium" ? "warning" : "default";
}
function priorityLabel(value: VideoInsight["analysis"]["improvements"][number]["priority"]) {
  return { critical: "必须处理", high: "高优先级", medium: "建议处理", low: "可选优化" }[value];
}
function priorityType(value: VideoInsight["analysis"]["improvements"][number]["priority"]) {
  return value === "critical" ? "error" : value === "high" ? "warning" : value === "medium" ? "info" : "default";
}
function improvementCategoryLabel(value: VideoInsight["analysis"]["improvements"][number]["category"]) {
  return {
    hook: "开场钩子",
    audience: "目标受众",
    structure: "脚本结构",
    clarity: "表达清晰度",
    evidence: "可信证据",
    pacing: "内容节奏",
    conversion: "转化路径",
    compliance: "内容合规",
    transcription: "转写质量"
  }[value];
}
function finalStatusLabel(value: VideoInsight["analysis"]["finalOutput"]["status"]) {
  return { ready: "可进入人工终审", "needs-evidence": "需补充证据", "needs-transcript": "仅结构示例" }[value];
}
function finalStatusType(value: VideoInsight["analysis"]["finalOutput"]["status"]) {
  return value === "ready" ? "success" : value === "needs-evidence" ? "warning" : "error";
}
function sectionOriginLabel(value: VideoInsight["analysis"]["finalOutput"]["sections"][number]["origin"]) {
  return { original: "保留原文", reordered: "顺序优化", rewritten: "表达优化", placeholder: "待补真实信息" }[value];
}
function conversionGoalLabel(value: VideoInsight["analysis"]["brief"]["primaryConversionGoal"]) {
  return { purchase: "购买成交", lead: "私信/留资", engagement: "互动", follow: "关注", unknown: "未识别" }[value];
}
function contentModeLabel(value: VideoInsight["analysis"]["brief"]["contentMode"]) {
  return {
    commerce: "带货转化",
    opinion: "观点共鸣",
    knowledge: "知识讲解",
    story: "故事叙事",
    unknown: "待判断"
  }[value];
}
function isReferencedCue(text: string) {
  const normalized = text.replace(/\s+/g, "");
  return referencedEvidence.value.some((evidence) => {
    const normalizedEvidence = evidence.replace(/\s+/g, "");
    return normalized.includes(normalizedEvidence) || normalizedEvidence.includes(normalized);
  });
}
function isLowConfidenceCue(index: number) {
  return Boolean(
    selected.value?.transcript.analysis?.recognitionQuality?.lowConfidenceSegments?.some(
      (segment) => segment.index === index
    )
  );
}
function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "操作失败";
}
</script>

<style scoped>
.insights-page {
  display: grid;
  gap: 18px;
}
.page-heading,
.create-actions,
.filters,
.detail-header,
.detail-actions,
.editor-actions,
.list-caption,
.pagination {
  display: flex;
  align-items: center;
  gap: 12px;
}
.page-heading {
  justify-content: space-between;
}
.page-heading h2 {
  margin: 4px 0;
  font-size: 28px;
}
.page-heading p {
  margin: 0;
  color: var(--text-secondary, #64748b);
}
.eyebrow {
  color: #0f766e !important;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
}
.create-panel,
.filters,
.card-list,
.detail-panel {
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 16px;
  background: var(--card-color, #fff);
  padding: 16px;
}
.create-panel {
  display: grid;
  gap: 12px;
}
.source-tabs {
  display: inline-flex;
  gap: 4px;
  width: fit-content;
  padding: 3px;
  border-radius: 9px;
  background: #f1f5f9;
}
.source-tabs button {
  padding: 6px 14px;
  border: 0;
  border-radius: 7px;
  color: #64748b;
  background: transparent;
  cursor: pointer;
}
.source-tabs button.active {
  color: #0f766e;
  background: #fff;
  box-shadow: 0 1px 3px rgb(15 23 42 / 10%);
  font-weight: 600;
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}
.upload-dropzone {
  display: grid;
  gap: 6px;
  place-items: center;
  min-height: 112px;
  padding: 18px;
  border: 1px dashed #5eead4;
  border-radius: 12px;
  color: #0f766e;
  background: #f0fdfa;
  cursor: pointer;
}
.upload-dropzone:hover {
  border-color: #0d9488;
  background: #ccfbf1;
}
.upload-dropzone span {
  color: #64748b;
  font-size: 12px;
}
.create-actions {
  justify-content: flex-end;
}
.filters {
  flex-wrap: wrap;
}
.filters :deep(.n-input) {
  width: min(260px, 100%);
}
.native-select {
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid #d9dfe8;
  border-radius: 6px;
  background: #fff;
  color: #334155;
}
.checkbox-label {
  color: #475569;
  font-size: 14px;
  white-space: nowrap;
}
.workbench {
  display: grid;
  grid-template-columns: minmax(300px, 0.9fr) minmax(0, 1.6fr);
  gap: 18px;
  align-items: start;
}
.card-list {
  display: grid;
  gap: 10px;
  max-height: 78vh;
  overflow: auto;
}
.list-caption {
  justify-content: space-between;
  color: #64748b;
  font-size: 13px;
}
.insight-card {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: 10px;
  width: 100%;
  padding: 10px;
  border: 1px solid #edf0f4;
  border-radius: 12px;
  color: inherit;
  text-align: left;
  background: #fff;
  cursor: pointer;
}
.insight-card:hover,
.insight-card.selected {
  border-color: #14b8a6;
  background: #f0fdfa;
}
.insight-card img {
  width: 88px;
  height: 88px;
  border-radius: 8px;
  object-fit: cover;
  background: #f1f5f9;
}
.card-copy {
  min-width: 0;
}
.card-copy strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-copy p,
.description {
  margin: 6px 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.45;
}
.card-meta,
.muted {
  color: #94a3b8;
  font-size: 12px;
}
.tag-row,
.keyword-groups {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.pagination {
  justify-content: center;
  padding-top: 4px;
}
.detail-panel {
  min-height: 540px;
}
.detail-header {
  justify-content: space-between;
  align-items: flex-start;
}
.detail-header h3 {
  margin: 3px 0;
  font-size: 22px;
}
.detail-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}
.warning {
  padding: 9px 12px;
  border-radius: 8px;
  color: #92400e;
  background: #fffbeb;
  font-size: 13px;
}
.quality-banner {
  display: grid;
  gap: 5px;
  margin: 14px 0;
  padding: 12px 14px;
  border: 1px solid #bae6fd;
  border-radius: 10px;
  background: #f0f9ff;
}
.quality-banner > div,
.section-heading,
.stage-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.quality-banner span {
  margin-left: 8px;
  color: #0369a1;
  font-size: 12px;
}
.quality-banner p {
  margin: 0;
  color: #475569;
  font-size: 12px;
  line-height: 1.5;
}
.quality-low {
  border-color: #fed7aa;
  background: #fff7ed;
}
.quality-medium {
  border-color: #fde68a;
  background: #fffbeb;
}
.brief-card {
  padding: 16px;
  border: 1px solid #ccfbf1;
  border-radius: 12px;
  background: linear-gradient(135deg, #f0fdfa, #f8fafc);
}
.brief-card h4,
.section-heading h4 {
  margin: 0;
}
.brief-card > p {
  margin: 10px 0;
  color: #134e4a;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.7;
}
.brief-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.brief-meta span {
  display: grid;
  gap: 3px;
  color: #475569;
  font-size: 12px;
}
.brief-meta strong {
  color: #0f766e;
}
.improvement-list,
.change-list {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}
.improvement-card {
  display: grid;
  gap: 9px;
  padding: 13px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
}
.improvement-title,
.final-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.improvement-card dl {
  display: grid;
  gap: 7px;
  margin: 0;
}
.improvement-card dl > div {
  display: grid;
  grid-template-columns: 78px minmax(0, 1fr);
  gap: 9px;
}
.improvement-card dt {
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}
.improvement-card dd {
  margin: 0;
  color: #334155;
  font-size: 13px;
  line-height: 1.6;
}
.rewrite-example {
  padding: 7px 9px;
  border-left: 3px solid #38bdf8;
  color: #0c4a6e !important;
  background: #f0f9ff;
}
.final-output-section {
  margin-top: 6px;
  padding: 16px;
  border: 1px solid #a7f3d0;
  border-radius: 12px;
  background: #f7fffc;
}
.final-script {
  max-height: 440px;
  margin: 12px 0;
  padding: 16px;
  overflow: auto;
  border-radius: 10px;
  color: #172554;
  background: #fff;
  box-shadow: inset 0 0 0 1px #dbeafe;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.9;
  white-space: pre-wrap;
}
.final-sections {
  display: grid;
  gap: 6px;
}
.final-sections > div {
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: start;
  padding: 7px;
  border-bottom: 1px dashed #dbeafe;
  color: #475569;
  font-size: 12px;
}
.final-sections small {
  color: #94a3b8;
  white-space: nowrap;
}
.verification-list {
  margin: 12px 0 0;
  padding: 10px 10px 10px 28px;
  border-radius: 8px;
  color: #92400e;
  background: #fffbeb;
  font-size: 12px;
  line-height: 1.6;
}
.change-list > article {
  display: grid;
  grid-template-columns: 100px repeat(3, minmax(0, 1fr));
  gap: 10px;
  padding: 11px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
}
.change-list > article > strong {
  color: #0f766e;
}
.change-list small {
  color: #94a3b8;
  font-weight: 700;
}
.change-list p {
  margin-top: 4px;
  font-size: 12px;
}
.analysis-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 14px 0;
}
.analysis-box,
.detail-section {
  border-top: 1px solid #edf0f4;
  padding: 14px 0;
}
.analysis-box {
  border: 1px solid #edf0f4;
  border-radius: 10px;
  padding: 12px;
}
.analysis-box h4,
.detail-section h4 {
  margin: 0 0 8px;
}
.analysis-box p,
.analysis-box ul,
.detail-section p {
  margin: 0;
  color: #475569;
  line-height: 1.65;
}
.analysis-box ul {
  padding-left: 18px;
}
.hook-box blockquote {
  margin: 8px 0;
  padding: 8px 10px;
  border-left: 3px solid #14b8a6;
  color: #0f172a;
  background: #f8fafc;
  font-weight: 600;
  line-height: 1.65;
}
.evidence-meta {
  color: #64748b !important;
  font-size: 12px;
}
.signal-list,
.weakness-list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 8px;
}
.signal-list span,
.weakness-list span {
  padding: 3px 7px;
  border-radius: 6px;
  color: #047857;
  background: #ecfdf5;
  font-size: 11px;
}
.weakness-list span {
  color: #9a3412;
  background: #fff7ed;
}
.phrase-list {
  display: grid;
  gap: 6px;
  margin: 0;
}
.keypoint-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 10px;
}
.keypoint-card {
  display: grid;
  gap: 7px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
}
.keypoint-card > strong {
  line-height: 1.6;
}
.keypoint-card > p {
  color: #64748b;
  font-size: 12px;
}
.score {
  color: #64748b;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.evidence-line {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 3px 8px;
  padding-top: 7px;
  border-top: 1px dashed #e2e8f0;
  color: #475569;
  font-size: 12px;
}
.evidence-line time,
.stage-title time,
.transcript-cue time {
  color: #0f766e;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 11px;
  white-space: nowrap;
}
.evidence-line small {
  grid-column: 2;
  color: #94a3b8;
}
.selling-chains {
  display: grid;
  gap: 10px;
  margin-top: 10px;
}
.selling-chain {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid #dbeafe;
  border-radius: 10px;
  background: #f8fbff;
}
.chain-flow {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr);
  gap: 8px;
  align-items: center;
}
.chain-flow span {
  display: grid;
  gap: 4px;
  min-height: 72px;
  padding: 9px;
  border-radius: 8px;
  color: #334155;
  background: #fff;
  font-size: 12px;
  line-height: 1.5;
}
.chain-flow small {
  color: #2563eb;
  font-weight: 700;
}
.chain-flow b {
  color: #94a3b8;
}
.segments {
  display: grid;
  gap: 8px;
  margin-top: 10px;
}
.formula {
  max-width: 70%;
  color: #0f766e;
  text-align: right;
  font-size: 12px;
}
.segment-stage {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 10px;
  padding: 10px;
  border-left: 2px solid #99f6e4;
  background: #f8fafc;
}
.stage-order {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  color: #fff;
  background: #0f766e;
  font-weight: 700;
}
.stage-title {
  justify-content: flex-start;
}
.stage-title p,
.segment-stage p {
  margin: 4px 0 !important;
}
.segment-stage small {
  color: #64748b;
}
.keyword-group {
  display: grid;
  grid-template-columns: 80px minmax(0, 1fr);
  gap: 10px;
  margin-top: 8px;
}
.keyword-group > strong {
  color: #475569;
  font-size: 12px;
}
.missing-box {
  border-color: #fed7aa;
  background: #fffaf5;
}
.risk-box {
  border-color: #fecaca;
  background: #fff7f7;
}
.keyword {
  padding: 3px 8px;
  border-radius: 999px;
  color: #0f766e;
  background: #f0fdfa;
  font-size: 13px;
}
.editor-section {
  display: grid;
  gap: 10px;
}
.editor-actions {
  justify-content: space-between;
}
.transcript-timeline {
  display: grid;
  gap: 5px;
  max-height: 340px;
  margin-top: 10px;
  overflow: auto;
}
.transcript-cue {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: start;
  padding: 7px 9px;
  border-left: 3px solid transparent;
  border-radius: 6px;
}
.transcript-cue p {
  margin: 0;
  white-space: pre-wrap;
}
.transcript-cue.referenced {
  border-left-color: #14b8a6;
  background: #f0fdfa;
}
.transcript-cue.uncertain {
  border-left-color: #f59e0b;
  background: #fffbeb;
}
@media (max-width: 900px) {
  .workbench {
    grid-template-columns: 1fr;
  }
  .card-list {
    max-height: none;
  }
  .page-heading {
    align-items: flex-start;
    flex-direction: column;
  }
  .analysis-grid {
    grid-template-columns: 1fr;
  }
  .keypoint-grid,
  .brief-meta {
    grid-template-columns: 1fr;
  }
  .section-heading {
    align-items: flex-start;
    flex-direction: column;
  }
  .formula {
    max-width: 100%;
    text-align: left;
  }
  .chain-flow {
    grid-template-columns: 1fr;
  }
  .chain-flow b {
    transform: rotate(90deg);
    text-align: center;
  }
  .improvement-card dl > div,
  .final-sections > div,
  .change-list > article {
    grid-template-columns: 1fr;
  }
}
</style>
