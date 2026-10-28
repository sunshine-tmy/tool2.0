/** Profile discovery is distinct from single-work inputs and bounded spreadsheet batches. */
import { Type, type Static } from "@sinclair/typebox";
import { ArchiveGroupIdSchema } from "./archive-groups";
import { ArchiveImportRowSchema } from "./archive-import";

export const TIKTOK_PROFILE_MAX_WORKS = 10_000;
export const TikTokProfileInputSchema = Type.Object(
  { url: Type.String({ minLength: 1, maxLength: 2048 }) },
  { additionalProperties: false }
);
export function normalizeTikTokProfileLink(input: string): { username: string; url: string } | undefined {
  try {
    const url = new URL(input.trim());
    const match = /^\/@([A-Za-z0-9_.]{1,24})\/?$/.exec(url.pathname);
    if (
      url.protocol !== "https:" ||
      !["tiktok.com", "www.tiktok.com", "m.tiktok.com"].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.port ||
      !match
    )
      return undefined;
    const username = match[1].toLowerCase();
    return { username, url: `https://www.tiktok.com/@${username}` };
  } catch {
    return undefined;
  }
}
export const TikTokProfileWorkSchema = Type.Object(
  {
    id: Type.String({ pattern: "^\\d{5,24}$" }),
    url: Type.String({ maxLength: 2048 }),
    title: Type.Optional(Type.String({ maxLength: 500 })),
    createdAt: Type.Optional(Type.String({ format: "date-time" }))
  },
  { additionalProperties: false }
);
export const TikTokProfileJobSchema = Type.Object(
  {
    id: ArchiveGroupIdSchema,
    url: Type.String({ maxLength: 2048 }),
    username: Type.String({ minLength: 1, maxLength: 24, pattern: "^[a-z0-9_.]+$" }),
    phase: Type.Union(
      (
        [
          "discovering",
          "waiting-user",
          "ready",
          "archiving",
          "stopping",
          "completed",
          "cancelled",
          "interrupted",
          "failed"
        ] as const
      ).map((value) => Type.Literal(value))
    ),
    complete: Type.Boolean(),
    declaredCount: Type.Optional(Type.Integer({ minimum: 0, maximum: 10_000_000 })),
    discoveredCount: Type.Integer({ minimum: 0, maximum: TIKTOK_PROFILE_MAX_WORKS }),
    message: Type.String({ maxLength: 2000 }),
    errorCode: Type.Optional(Type.String({ maxLength: 100 })),
    createdAt: Type.String({ format: "date-time" }),
    updatedAt: Type.String({ format: "date-time" }),
    archivedCount: Type.Integer({ minimum: 0 }),
    failedCount: Type.Integer({ minimum: 0 }),
    skippedCount: Type.Integer({ minimum: 0 }),
    pendingCount: Type.Integer({ minimum: 0 }),
    batchCount: Type.Integer({ minimum: 0, maximum: 1000 }),
    groupId: Type.Optional(ArchiveGroupIdSchema),
    existing: Type.Optional(Type.Union([Type.Literal("skip"), Type.Literal("refresh")]))
  },
  { additionalProperties: false }
);
export const TikTokProfileListSchema = Type.Array(TikTokProfileJobSchema, { maxItems: 20 });
export const TikTokProfilePageSchema = Type.Object(
  {
    items: Type.Array(
      Type.Composite(
        [
          TikTokProfileWorkSchema,
          Type.Object({
            outcome: Type.Optional(
              Type.Pick(ArchiveImportRowSchema, ["status", "progress", "message", "errorCode", "archiveId"])
            )
          })
        ],
        { additionalProperties: false }
      ),
      { maxItems: 50 }
    ),
    page: Type.Integer({ minimum: 1 }),
    pageCount: Type.Integer({ minimum: 1 }),
    total: Type.Integer({ minimum: 0 })
  },
  { additionalProperties: false }
);
export const TikTokProfileStartSchema = Type.Object(
  {
    selection: Type.Union([Type.Literal("all"), Type.Literal("selected")]),
    itemIds: Type.Optional(
      Type.Array(TikTokProfileWorkSchema.properties.id, {
        minItems: 1,
        maxItems: TIKTOK_PROFILE_MAX_WORKS,
        uniqueItems: true
      })
    ),
    existing: Type.Union([Type.Literal("skip"), Type.Literal("refresh")]),
    groupId: Type.Optional(ArchiveGroupIdSchema),
    allowPartial: Type.Boolean()
  },
  { additionalProperties: false }
);
export type TikTokProfileWork = Static<typeof TikTokProfileWorkSchema>;
export type TikTokProfileJob = Static<typeof TikTokProfileJobSchema>;
export type TikTokProfilePage = Static<typeof TikTokProfilePageSchema>;
export type TikTokProfileStart = Static<typeof TikTokProfileStartSchema>;
