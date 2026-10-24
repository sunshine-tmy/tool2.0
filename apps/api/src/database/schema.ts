/** Database implementation detail; public callers continue through ToolboxDatabase. */
import { CURRENT_SCHEMA_VERSION } from "./archive-identity";
export const DATABASE_SCHEMA_VERSION = CURRENT_SCHEMA_VERSION;
export const DOMAIN_TABLES = [
  "tasks",
  "lan_files",
  "lan_notes",
  "upload_sessions",
  "xhs_archives",
  "xhs_media",
  "translations",
  "edge_tts_tasks",
  "image_ai_tasks",
  "chatterbox_tasks",
  "chatterbox_batches",
  "chatterbox_items",
  "chatterbox_voices"
] as const;
const KIND_TABLE: Record<string, (typeof DOMAIN_TABLES)[number] | "entities"> = {
  task: "tasks",
  "lan-file": "lan_files",
  "lan-note": "lan_notes",
  "upload-session": "upload_sessions",
  "xhs-archive": "xhs_archives",
  "xhs-media": "xhs_media",
  translation: "translations",
  "edge-tts-task": "edge_tts_tasks",
  "image-ai-task": "image_ai_tasks",
  "chatterbox-task": "chatterbox_tasks",
  "chatterbox-batch": "chatterbox_batches",
  "chatterbox-item": "chatterbox_items",
  "chatterbox-voice": "chatterbox_voices"
};
export function tableForKind(kind: string) {
  return KIND_TABLE[kind] ?? "entities";
}
