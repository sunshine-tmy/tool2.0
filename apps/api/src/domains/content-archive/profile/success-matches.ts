/** Match committed single-work successes without changing historical import rows. */
import { Type, type Static } from "@sinclair/typebox";
import { isContentArchiveTask, TikTokProfileWorkSchema } from "@toolbox/shared/archive";
import type { ToolboxDatabase } from "../../../database/toolbox-database";
import { ContentArchiveRepository } from "../core/repository";

export const SuccessMatchSchema = Type.Object(
  {
    workId: TikTokProfileWorkSchema.properties.id,
    archiveId: Type.String({ pattern: "^[A-Za-z0-9_-]{6,128}$" }),
    completedAt: Type.String({ format: "date-time" }),
    attemptKey: Type.String({ maxLength: 256 })
  },
  { additionalProperties: false }
);
export type SuccessMatch = Static<typeof SuccessMatchSchema>;

export function profileSuccessContext(database: ToolboxDatabase) {
  const identities = new Map(
    new ContentArchiveRepository(database).listIdentities("tiktok").map((item) => [item.id, item.contentId])
  );
  const successes = new Map<string, { archiveId: string; completedAt: string }>();
  const taskTimes = new Map<string, string>();
  for (const { payload } of database.list("archive-fetch-task")) {
    if (!isContentArchiveTask(payload) || payload.platform !== "tiktok") continue;
    taskTimes.set(payload.id, payload.updatedAt);
    if (payload.status !== "completed" || !payload.archiveId) continue;
    const workId = identities.get(payload.archiveId);
    if (!workId) continue;
    const previous = successes.get(workId);
    if (!previous || Date.parse(previous.completedAt) < Date.parse(payload.updatedAt))
      successes.set(workId, { archiveId: payload.archiveId, completedAt: payload.updatedAt });
  }
  const revision = JSON.stringify([[...identities], [...successes]]);
  return { identities, successes, taskTimes, revision };
}
export type ProfileSuccessContext = ReturnType<typeof profileSuccessContext>;
