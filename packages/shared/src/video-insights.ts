import type { ShortVideoAuthor, ShortVideoMedia, ShortVideoMusic, ShortVideoPlatform } from "./short-video";
import type { VideoTextAnalysis } from "./video-text";

export type InsightSegmentKind =
  | "hook"
  | "context"
  | "conflict"
  | "pain-point"
  | "audience"
  | "demo"
  | "selling-point"
  | "mechanism"
  | "proof"
  | "objection"
  | "viewpoint"
  | "turning-point"
  | "resolution"
  | "offer"
  | "call-to-action";

export type InsightConfidence = "high" | "medium" | "low";

export interface InsightEvidence {
  text: string;
  startSeconds?: number;
  endSeconds?: number;
  score: number;
  signals: string[];
}

export interface InsightSegment {
  kind: InsightSegmentKind;
  label: string;
  startSeconds?: number;
  endSeconds?: number;
  text: string;
  reason: string;
  confidence?: InsightConfidence;
  score?: number;
  signals?: string[];
}

export type InsightKeyPointKind =
  | "context"
  | "conflict"
  | "viewpoint"
  | "turning-point"
  | "resolution"
  | "golden-line"
  | "pain"
  | "audience"
  | "promise"
  | "feature"
  | "mechanism"
  | "benefit"
  | "demo"
  | "proof"
  | "objection"
  | "offer"
  | "cta";

export interface InsightKeyPoint {
  kind: InsightKeyPointKind;
  label: string;
  statement: string;
  confidence: InsightConfidence;
  score: number;
  whyItMatters: string;
  evidence: InsightEvidence[];
}

export type InsightHookType =
  | "pain-question"
  | "result-first"
  | "curiosity-gap"
  | "contrarian"
  | "number-list"
  | "scarcity-offer"
  | "social-proof"
  | "quote-led"
  | "story-led"
  | "emotion-resonance"
  | "direct-topic";

export interface InsightHookAnalysis {
  type: InsightHookType;
  label: string;
  text: string;
  confidence: InsightConfidence;
  score: number;
  mechanisms: string[];
  strengths: string[];
  weaknesses: string[];
  evidence: InsightEvidence;
}

export interface InsightContentBrief {
  oneSentenceSummary: string;
  contentMode: "commerce" | "opinion" | "knowledge" | "story" | "unknown";
  productOrService: string[];
  targetAudience: string[];
  coreMessage?: string;
  corePromise?: string;
  primaryConversionGoal: "purchase" | "lead" | "engagement" | "follow" | "unknown";
  contentAngle: string;
}

export interface InsightScriptStage {
  order: number;
  role: InsightSegmentKind;
  label: string;
  objective: string;
  summary: string;
  confidence: InsightConfidence;
  score: number;
  evidence: InsightEvidence[];
}

export interface InsightScriptBlueprint {
  formula: string;
  stages: InsightScriptStage[];
  pacing: {
    hookEndSeconds?: number;
    conversionStartSeconds?: number;
    totalSeconds?: number;
  };
}

export interface InsightSellingPointChain {
  claim: string;
  featureOrMechanism?: string;
  userBenefit?: string;
  proof?: string;
  confidence: InsightConfidence;
  score: number;
  evidence: InsightEvidence[];
}

export interface InsightAnalysisQuality {
  score: number;
  level: InsightConfidence;
  transcriptAvailable: boolean;
  timedCueRatio: number;
  lowConfidenceCueRatio: number;
  reasons: string[];
}

export type InsightImprovementPriority = "critical" | "high" | "medium" | "low";
export type InsightImprovementCategory =
  "hook" | "audience" | "structure" | "clarity" | "evidence" | "pacing" | "conversion" | "compliance" | "transcription";

export interface InsightImprovementSuggestion {
  id: string;
  priority: InsightImprovementPriority;
  category: InsightImprovementCategory;
  title: string;
  problem: string;
  recommendation: string;
  rewriteExample?: string;
  expectedImpact: string;
  evidence?: InsightEvidence;
}

export interface InsightFinalSection {
  role: InsightSegmentKind;
  label: string;
  text: string;
  origin: "original" | "reordered" | "rewritten" | "placeholder";
  evidence?: InsightEvidence;
}

export interface InsightFinalOutput {
  source: "rules" | "model";
  status: "ready" | "needs-evidence" | "needs-transcript";
  title: string;
  strategy: string;
  fullScript: string;
  sections: InsightFinalSection[];
  verificationNotes: string[];
}

export interface InsightChangeItem {
  area: string;
  before: string;
  after: string;
  reason: string;
}

export type InsightTagCategory = "topic" | "product" | "price" | "promotion" | "action" | "audience";
export type InsightTagSource = "rules" | "model" | "manual";

export interface InsightTag {
  value: string;
  category: InsightTagCategory;
  source: InsightTagSource;
}

export interface InsightKeywordGroups {
  product: string[];
  price: string[];
  promotion: string[];
  action: string[];
}

export interface InsightModelAnalysis {
  topic?: string;
  targetAudience?: string;
  coreSellingPoints: string[];
  scriptOutline: string[];
  rewriteDirections: string[];
  tags: string[];
  optimizedScript?: string;
  improvementSuggestions: string[];
  changeLog: string[];
}

export interface InsightAnalysis {
  version: 3;
  source: "rules" | "rules+model";
  generatedAt: string;
  hook?: InsightSegment;
  hookAnalysis?: InsightHookAnalysis;
  segments: InsightSegment[];
  keyPoints: InsightKeyPoint[];
  sellingPointChains: InsightSellingPointChain[];
  brief: InsightContentBrief;
  scriptBlueprint: InsightScriptBlueprint;
  quality: InsightAnalysisQuality;
  missingElements: string[];
  improvements: InsightImprovementSuggestion[];
  finalOutput: InsightFinalOutput;
  changeLog: InsightChangeItem[];
  keywords: InsightKeywordGroups;
  reusablePhrases: string[];
  risks: string[];
  model?: InsightModelAnalysis;
}

export interface ModelProviderConfig {
  enabled: boolean;
  provider: "openai-compatible" | "local-http" | null;
  model?: string;
}

export interface VideoInsightTranscript {
  status: "completed" | "unavailable" | "failed";
  analysis?: VideoTextAnalysis;
  warning?: string;
}

export interface VideoInsight {
  id: string;
  sourceUrl: string;
  source?: {
    type: "link" | "upload";
    originalFileName?: string;
    mimeType?: string;
    fileSize?: number;
  };
  platform: Exclude<ShortVideoPlatform, "auto">;
  title: string;
  description?: string;
  author?: ShortVideoAuthor;
  coverUrl?: string;
  media: ShortVideoMedia[];
  music?: ShortVideoMusic;
  provider?: string;
  warnings: string[];
  transcript: VideoInsightTranscript;
  analysis: InsightAnalysis;
  tags: InsightTag[];
  notes: string;
  scriptDraft: string;
  favorite: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VideoInsightCreateInput {
  input: string;
  platform?: ShortVideoPlatform;
}

export interface VideoInsightPatchInput {
  title?: string;
  tags?: string[];
  notes?: string;
  scriptDraft?: string;
  favorite?: boolean;
  archived?: boolean;
}
