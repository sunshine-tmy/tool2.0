/** User publication marks are separate from source metadata, manifests and media. */
import { Value } from "@sinclair/typebox/value";
import { ContentArchivePublicationSchema, type ContentArchivePublication } from "@toolbox/shared/archive";
import type { ToolboxDatabase } from "../../../database/toolbox-database";
import { ArchiveTaskError } from "./provider";

const kind = "archive-publication";
export class ArchivePublicationStore {
  constructor(private readonly database: ToolboxDatabase) {}

  marked() {
    return new Set(
      this.database.list(kind).map((record) => {
        if (
          !Value.Check(ContentArchivePublicationSchema, record.payload) ||
          record.payload.archiveId !== record.id ||
          !record.payload.publishedElsewhere ||
          !record.payload.markedAt
        )
          throw new Error("ARCHIVE_PUBLICATION_RECORD_INVALID");
        return record.id;
      })
    );
  }
  set(archiveId: string, publishedElsewhere: boolean): ContentArchivePublication {
    return this.database.transaction(() => {
      if (!this.database.get("xhs-archive", archiveId))
        throw new ArchiveTaskError("ARCHIVE_NOT_FOUND", "存档不存在，请刷新列表", 404);
      if (!publishedElsewhere) {
        this.database.remove(kind, archiveId);
        return { archiveId, publishedElsewhere: false };
      }
      const existing = this.database.get(kind, archiveId);
      if (existing) {
        if (
          !Value.Check(ContentArchivePublicationSchema, existing.payload) ||
          existing.payload.archiveId !== archiveId ||
          !existing.payload.publishedElsewhere ||
          !existing.payload.markedAt
        )
          throw new Error("ARCHIVE_PUBLICATION_RECORD_INVALID");
        return structuredClone(existing.payload);
      }
      const now = new Date().toISOString();
      const state = { archiveId, publishedElsewhere: true, markedAt: now };
      this.database.upsert({
        id: archiveId,
        kind,
        status: "published",
        payload: state,
        createdAt: now,
        updatedAt: now
      });
      return state;
    });
  }
}
