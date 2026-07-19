import fsp from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import type { FastifyInstance } from "fastify";
import {
  fail,
  extractFirstUrl,
  ok,
  type InsightAnalysis,
  type InsightModelAnalysis,
  type InsightTag,
  type ModelProviderConfig,
  type VideoInsight,
  type VideoInsightPatchInput,
  type VideoInsightTranscript
} from "@toolbox/shared";
import type { AppConfig } from "../config";
import { parseShortVideo } from "./short-video";
import { analyzeVideoInsightRules } from "./video-insight-rules";
import {
  transcribeRemoteVideoForInsight,
  transcribeUploadedVideoForInsight,
  VideoInsightUploadError
} from "./video-text";
import type { RemoteFetch } from "../security/remote-fetch";

type RegisterVideoInsightRoutesOptions = {
  app: FastifyInstance;
  config: AppConfig;
  remoteFetch: RemoteFetch;
};

type InsightListQuery = {
  page?: string;
  pageSize?: string;
  keyword?: string;
  platform?: string;
  tag?: string;
  favorite?: string;
  archived?: string;
  createdFrom?: string;
  createdTo?: string;
  sort?: string;
};

export async function registerVideoInsightRoutes({ app, config, remoteFetch }: RegisterVideoInsightRoutesOptions) {
  await fsp.mkdir(config.videoInsightsCardsDir, { recursive: true });

  app.post("/api/tools/video-insights", async (request, reply) => {
    const body = request.body as { input?: unknown; platform?: unknown } | undefined;
    if (typeof body?.input !== "string" || !body.input.trim()) {
      return reply.code(400).send(fail("VIDEO_INSIGHT_URL_REQUIRED", "请输入抖音、小红书或 TikTok 公开分享链接"));
    }

    try {
      const sourceCandidate = extractFirstUrl(body.input.trim()) ?? body.input.trim();
      const existing = await listCards(config);
      if (existing.some((item) => item.sourceUrl === sourceCandidate)) {
        return reply.code(409).send(fail("VIDEO_INSIGHT_DUPLICATE", "该链接已创建竞品卡片"));
      }
      const parsed = await parseShortVideo(config, {
        input: body.input,
        platform: typeof body.platform === "string" ? (body.platform as never) : "auto"
      });
      if (existing.some((item) => item.sourceUrl === parsed.sourceUrl)) {
        return reply.code(409).send(fail("VIDEO_INSIGHT_DUPLICATE", "该链接已创建竞品卡片"));
      }

      const media = parsed.media.find((item) => item.type === "video");
      const transcriptResult = media
        ? await transcribeRemoteVideoForInsight({
            config,
            remoteFetch,
            sourceUrl: media.url,
            title: parsed.title
          })
        : { warning: "该内容未提供可转写的视频媒体，已基于标题和文案执行规则拆解。" };
      const fallbackText = [parsed.title, parsed.description].filter(Boolean).join("。 ");
      const transcript: VideoInsightTranscript = transcriptResult.analysis
        ? { status: "completed", analysis: transcriptResult.analysis }
        : { status: "unavailable", warning: transcriptResult.warning };
      const analysis = analyzeVideoInsightRules({
        title: parsed.title,
        text: transcriptResult.analysis?.fullText || fallbackText,
        transcript: transcriptResult.analysis,
        transcriptWarning: transcript.warning,
        durationMs: media?.durationMs
      });
      const now = new Date().toISOString();
      const insight: VideoInsight = {
        id: nanoid(14),
        sourceUrl: parsed.sourceUrl,
        source: { type: "link" },
        platform: parsed.platform,
        title: parsed.title || "未命名竞品",
        description: parsed.description,
        author: parsed.author,
        coverUrl: parsed.coverUrl,
        media: parsed.media,
        music: parsed.music,
        provider: parsed.provider,
        warnings: uniqueStrings([...parsed.warnings, ...(transcript.warning ? [transcript.warning] : [])]),
        transcript,
        analysis,
        tags: buildRuleTags(parsed.platform, analysis),
        notes: "",
        scriptDraft: "",
        favorite: false,
        archived: false,
        createdAt: now,
        updatedAt: now
      };
      await saveCard(config, insight);
      return reply.code(201).send(ok(insight));
    } catch (error) {
      const message = error instanceof Error ? error.message : "短视频解析服务不可用";
      const statusCode =
        /^(SHORT_VIDEO_URL_REQUIRED|INVALID_SHORT_VIDEO_PLATFORM|UNSUPPORTED_SHORT_VIDEO_URL|SHORT_VIDEO_PLATFORM_MISMATCH)/.test(
          message
        )
          ? 400
          : 502;
      return reply.code(statusCode).send(fail("VIDEO_INSIGHT_CREATE_FAILED", message));
    }
  });

  app.post("/api/tools/video-insights/upload", async (request, reply) => {
    try {
      const file = await request.file({
        limits: { files: 1, fileSize: config.remoteMediaMaxBytes },
        throwFileSizeLimit: true
      });
      if (!file) {
        return reply.code(400).send(fail("VIDEO_INSIGHT_FILE_REQUIRED", "请选择要分析的视频文件"));
      }
      if (!file.mimetype.startsWith("video/")) {
        file.file.resume();
        return reply.code(415).send(fail("VIDEO_INSIGHT_VIDEO_REQUIRED", "请上传受支持的视频文件"));
      }

      const transcribed = await transcribeUploadedVideoForInsight({
        config,
        stream: file.file,
        fileName: file.filename || "uploaded-video.mp4",
        mimeType: file.mimetype,
        maxBytes: config.remoteMediaMaxBytes
      });
      const id = nanoid(14);
      const now = new Date().toISOString();
      const title = path.parse(transcribed.fileName).name.slice(0, 200) || "上传视频";
      const analysis = analyzeVideoInsightRules({
        title,
        text: transcribed.analysis.fullText,
        transcript: transcribed.analysis
      });
      const insight: VideoInsight = {
        id,
        sourceUrl: `local-upload://${id}`,
        source: {
          type: "upload",
          originalFileName: transcribed.fileName,
          mimeType: transcribed.mimeType,
          fileSize: transcribed.fileSize
        },
        platform: "unknown",
        title,
        media: [],
        provider: "local-upload",
        warnings: [],
        transcript: { status: "completed", analysis: transcribed.analysis },
        analysis,
        tags: buildRuleTags("unknown", analysis),
        notes: "",
        scriptDraft: "",
        favorite: false,
        archived: false,
        createdAt: now,
        updatedAt: now
      };
      await saveCard(config, insight);
      return reply.code(201).send(ok(insight));
    } catch (error) {
      if (error instanceof VideoInsightUploadError) {
        return reply.code(error.statusCode).send(fail(error.code, error.message));
      }
      if (isMultipartTooLargeError(error)) {
        return reply.code(413).send(fail("VIDEO_INSIGHT_UPLOAD_TOO_LARGE", "上传视频超过允许大小"));
      }
      return reply
        .code(500)
        .send(fail("VIDEO_INSIGHT_UPLOAD_FAILED", error instanceof Error ? error.message : "上传视频分析失败"));
    }
  });

  app.get("/api/tools/video-insights", async (request) => {
    const query = request.query as InsightListQuery;
    const page = boundedPositiveInteger(query.page, 1, 1, 100000);
    const pageSize = boundedPositiveInteger(query.pageSize, 12, 1, 50);
    const cards = (await listCards(config)).filter((card) => matchesCard(card, query));
    const sorted = cards.sort((left, right) => {
      if (query.sort === "oldest") return left.createdAt.localeCompare(right.createdAt);
      if (query.sort === "updated") return right.updatedAt.localeCompare(left.updatedAt);
      return right.createdAt.localeCompare(left.createdAt);
    });
    const total = sorted.length;
    return ok({
      items: sorted.slice((page - 1) * pageSize, page * pageSize),
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
      model: getModelConfig(config)
    });
  });

  app.get("/api/tools/video-insights/:id", async (request, reply) => {
    const card = await loadCard(config, (request.params as { id: string }).id);
    if (!card) return reply.code(404).send(fail("VIDEO_INSIGHT_NOT_FOUND", "竞品卡片不存在"));
    return ok(card);
  });

  app.patch("/api/tools/video-insights/:id", async (request, reply) => {
    const card = await loadCard(config, (request.params as { id: string }).id);
    if (!card) return reply.code(404).send(fail("VIDEO_INSIGHT_NOT_FOUND", "竞品卡片不存在"));
    const patch = request.body as VideoInsightPatchInput | undefined;
    const validationError = validatePatch(patch);
    if (validationError) return reply.code(400).send(fail("INVALID_VIDEO_INSIGHT_PATCH", validationError));

    const updated: VideoInsight = {
      ...card,
      ...(patch?.title !== undefined ? { title: patch.title.trim() } : {}),
      ...(patch?.notes !== undefined ? { notes: patch.notes.trim() } : {}),
      ...(patch?.scriptDraft !== undefined ? { scriptDraft: patch.scriptDraft.trim() } : {}),
      ...(patch?.favorite !== undefined ? { favorite: patch.favorite } : {}),
      ...(patch?.archived !== undefined ? { archived: patch.archived } : {}),
      ...(patch?.tags !== undefined ? { tags: mergeManualTags(card.tags, patch.tags) } : {}),
      updatedAt: new Date().toISOString()
    };
    await saveCard(config, updated);
    return ok(updated);
  });

  app.delete("/api/tools/video-insights/:id", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    if (!isValidId(id) || !(await loadCard(config, id))) {
      return reply.code(404).send(fail("VIDEO_INSIGHT_NOT_FOUND", "竞品卡片不存在"));
    }
    await fsp.rm(cardPath(config, id), { force: true });
    return ok({ removed: true });
  });

  app.post("/api/tools/video-insights/:id/analyze", async (request, reply) => {
    const card = await loadCard(config, (request.params as { id: string }).id);
    if (!card) return reply.code(404).send(fail("VIDEO_INSIGHT_NOT_FOUND", "竞品卡片不存在"));
    const body = request.body as { mode?: unknown } | undefined;
    const mode = body?.mode === "model" ? "model" : "rules";
    const text = card.transcript.analysis?.fullText || [card.title, card.description].filter(Boolean).join("。 ");
    const rules = analyzeVideoInsightRules({
      title: card.title,
      text,
      transcript: card.transcript.analysis,
      transcriptWarning: card.transcript.warning,
      durationMs: card.media.find((item) => item.type === "video")?.durationMs
    });

    if (mode === "rules") {
      const updated = {
        ...card,
        analysis: rules,
        tags: preserveManualTags(card.tags, buildRuleTags(card.platform, rules)),
        updatedAt: new Date().toISOString()
      };
      await saveCard(config, updated);
      return ok(updated);
    }
    if (!getModelConfig(config).enabled) {
      return reply.code(409).send(fail("MODEL_NOT_CONFIGURED", "请先在 .env 配置竞品拆解模型服务"));
    }
    try {
      const model = await requestModelAnalysis(config, card, rules);
      const analysis: InsightAnalysis = { ...rules, source: "rules+model", model };
      const updated = {
        ...card,
        analysis,
        tags: preserveManualTags(card.tags, [...buildRuleTags(card.platform, analysis), ...model.tags.map(toModelTag)]),
        updatedAt: new Date().toISOString()
      };
      await saveCard(config, updated);
      return ok(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : "模型分析失败";
      return reply.code(message.includes("超时") ? 504 : 502).send(fail("MODEL_REQUEST_FAILED", message));
    }
  });
}

function buildRuleTags(platform: VideoInsight["platform"], analysis: InsightAnalysis): InsightTag[] {
  return uniqueTags([
    { value: platform, category: "topic", source: "rules" },
    ...analysis.keywords.product.map((value) => ({ value, category: "product" as const, source: "rules" as const })),
    ...analysis.keywords.price.map((value) => ({ value, category: "price" as const, source: "rules" as const })),
    ...analysis.keywords.promotion.map((value) => ({
      value,
      category: "promotion" as const,
      source: "rules" as const
    })),
    ...analysis.keywords.action.map((value) => ({ value, category: "action" as const, source: "rules" as const })),
    ...analysis.brief.targetAudience.map((value) => ({
      value,
      category: "audience" as const,
      source: "rules" as const
    }))
  ]).slice(0, 15);
}

function mergeManualTags(existing: InsightTag[], values: string[]) {
  const automatic = existing.filter((tag) => tag.source !== "manual");
  return uniqueTags([
    ...automatic,
    ...values.map((value) => ({ value: value.trim(), category: "topic" as const, source: "manual" as const }))
  ]);
}

function preserveManualTags(existing: InsightTag[], automatic: InsightTag[]) {
  return uniqueTags([...automatic, ...existing.filter((tag) => tag.source === "manual")]).slice(0, 20);
}

function toModelTag(value: string): InsightTag {
  return { value, category: "topic", source: "model" };
}

function uniqueTags(tags: InsightTag[]) {
  const seen = new Set<string>();
  return tags.filter((tag) => {
    const value = tag.value.trim().slice(0, 40);
    const key = `${tag.source}:${value.toLowerCase()}`;
    if (!value || seen.has(key)) return false;
    seen.add(key);
    tag.value = value;
    return true;
  });
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function getModelConfig(config: AppConfig): ModelProviderConfig {
  const enabled = Boolean(config.videoInsightsModelBaseUrl && config.videoInsightsModelName);
  return {
    enabled,
    provider: enabled ? (config.videoInsightsModelApiKey ? "openai-compatible" : "local-http") : null,
    model: config.videoInsightsModelName
  };
}

async function requestModelAnalysis(
  config: AppConfig,
  card: VideoInsight,
  rules: InsightAnalysis
): Promise<InsightModelAnalysis> {
  const baseUrl = config.videoInsightsModelBaseUrl!;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.videoInsightsModelTimeoutMs);
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        ...(config.videoInsightsModelApiKey ? { authorization: `Bearer ${config.videoInsightsModelApiKey}` } : {})
      },
      body: JSON.stringify({
        model: config.videoInsightsModelName,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "你是短视频竞品分析助手。只返回 JSON，不要编造数据。" },
          {
            role: "user",
            content: JSON.stringify({
              title: card.title,
              description: card.description,
              transcript: card.transcript.analysis?.fullText || "",
              ruleAnalysis: rules,
              expected: {
                topic: "string",
                targetAudience: "string",
                coreSellingPoints: ["string"],
                scriptOutline: ["string"],
                rewriteDirections: ["string"],
                tags: ["string"],
                optimizedScript: "string（只能使用原文事实；缺失事实必须写【待补充】）",
                improvementSuggestions: ["string"],
                changeLog: ["string"]
              }
            })
          }
        ]
      })
    });
    if (!response.ok) throw new Error(`模型服务响应异常（HTTP ${response.status}）`);
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("模型服务未返回有效内容");
    return sanitizeModelAnalysis(parseModelJson(content));
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("模型请求超时");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function parseModelJson(content: string) {
  const normalized = content
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/```$/, "")
    .trim();
  return JSON.parse(normalized) as Record<string, unknown>;
}

function sanitizeModelAnalysis(value: Record<string, unknown>): InsightModelAnalysis {
  return {
    topic: shortString(value.topic),
    targetAudience: shortString(value.targetAudience),
    coreSellingPoints: shortStringList(value.coreSellingPoints, 6),
    scriptOutline: shortStringList(value.scriptOutline, 8),
    rewriteDirections: shortStringList(value.rewriteDirections, 3),
    tags: shortStringList(value.tags, 10),
    optimizedScript: longString(value.optimizedScript, 15000),
    improvementSuggestions: shortStringList(value.improvementSuggestions, 10),
    changeLog: shortStringList(value.changeLog, 10)
  };
}

function shortString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 300) : undefined;
}

function longString(value: unknown, maxLength: number) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : undefined;
}

function shortStringList(value: unknown, limit: number) {
  return Array.isArray(value)
    ? uniqueStrings(
        value.filter((item): item is string => typeof item === "string").map((item) => item.slice(0, 300))
      ).slice(0, limit)
    : [];
}

async function listCards(config: AppConfig) {
  let entries: string[] = [];
  try {
    entries = await fsp.readdir(config.videoInsightsCardsDir);
  } catch {
    return [];
  }
  const cards = await Promise.all(
    entries.filter((file) => file.endsWith(".json")).map((file) => loadCard(config, path.basename(file, ".json")))
  );
  return cards.filter((card): card is VideoInsight => Boolean(card));
}

async function loadCard(config: AppConfig, id: string) {
  if (!isValidId(id)) return null;
  try {
    const card = JSON.parse(await fsp.readFile(cardPath(config, id), "utf8")) as VideoInsight;
    if (!isVideoInsight(card)) return null;
    if ((card.analysis as { version?: number }).version !== 3) {
      card.analysis = analyzeVideoInsightRules({
        title: card.title,
        text: card.transcript.analysis?.fullText || [card.title, card.description].filter(Boolean).join("。 "),
        transcript: card.transcript.analysis,
        transcriptWarning: card.transcript.warning,
        durationMs: card.media.find((item) => item.type === "video")?.durationMs
      });
    }
    return card;
  } catch {
    return null;
  }
}

async function saveCard(config: AppConfig, card: VideoInsight) {
  await fsp.mkdir(config.videoInsightsCardsDir, { recursive: true });
  const destination = cardPath(config, card.id);
  const temporary = `${destination}.${nanoid(6)}.tmp`;
  await fsp.writeFile(temporary, JSON.stringify(card, null, 2), "utf8");
  await fsp.rename(temporary, destination);
}

function cardPath(config: AppConfig, id: string) {
  return path.join(config.videoInsightsCardsDir, `${id}.json`);
}

function isValidId(value: string) {
  return /^[A-Za-z0-9_-]{8,40}$/.test(value);
}

function isVideoInsight(value: unknown): value is VideoInsight {
  return Boolean(
    value &&
    typeof value === "object" &&
    isValidId((value as VideoInsight).id) &&
    typeof (value as VideoInsight).sourceUrl === "string" &&
    typeof (value as VideoInsight).title === "string"
  );
}

function matchesCard(card: VideoInsight, query: InsightListQuery) {
  const keyword = query.keyword?.trim().toLowerCase();
  const haystack = [
    card.title,
    card.description,
    card.notes,
    card.scriptDraft,
    card.transcript.analysis?.fullText,
    ...card.tags.map((tag) => tag.value)
  ]
    .join(" ")
    .toLowerCase();
  if (keyword && !haystack.includes(keyword)) return false;
  if (query.platform && query.platform !== "all" && card.platform !== query.platform) return false;
  if (query.tag && !card.tags.some((tag) => tag.value.toLowerCase().includes(query.tag!.trim().toLowerCase())))
    return false;
  if (query.favorite && parseBoolean(query.favorite) !== card.favorite) return false;
  if (query.archived && parseBoolean(query.archived) !== card.archived) return false;
  if (query.createdFrom && card.createdAt < `${query.createdFrom}T00:00:00.000Z`) return false;
  if (query.createdTo && card.createdAt > `${query.createdTo}T23:59:59.999Z`) return false;
  return true;
}

function parseBoolean(value: string) {
  return value === "true";
}

function boundedPositiveInteger(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function isMultipartTooLargeError(error: unknown) {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "FST_REQ_FILE_TOO_LARGE"
  );
}

function validatePatch(patch: VideoInsightPatchInput | undefined) {
  if (!patch || typeof patch !== "object") return "请求体无效";
  if (
    patch.title !== undefined &&
    (typeof patch.title !== "string" || !patch.title.trim() || patch.title.trim().length > 200)
  )
    return "标题需为 1–200 个字符";
  if (patch.notes !== undefined && (typeof patch.notes !== "string" || patch.notes.length > 10000))
    return "备注不能超过 10000 个字符";
  if (patch.scriptDraft !== undefined && (typeof patch.scriptDraft !== "string" || patch.scriptDraft.length > 10000))
    return "人工修订不能超过 10000 个字符";
  if (
    patch.tags !== undefined &&
    (!Array.isArray(patch.tags) ||
      patch.tags.length > 20 ||
      patch.tags.some((tag) => typeof tag !== "string" || !tag.trim() || tag.trim().length > 40))
  )
    return "标签最多 20 个，每个不超过 40 个字符";
  if (patch.favorite !== undefined && typeof patch.favorite !== "boolean") return "favorite 必须为布尔值";
  if (patch.archived !== undefined && typeof patch.archived !== "boolean") return "archived 必须为布尔值";
  return "";
}
