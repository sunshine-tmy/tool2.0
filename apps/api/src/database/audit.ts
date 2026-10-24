/** Database implementation detail; public callers continue through ToolboxDatabase. */
import type Database from "better-sqlite3";
type AuditEvent = { action: string; outcome: string; requestId?: string; actor?: string; details?: unknown };
export function appendAudit(connection: Database.Database, event: AuditEvent) {
  connection
    .prepare(
      `INSERT INTO audit_events (occurred_at, action, outcome, request_id, actor, details_json)
         VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      new Date().toISOString(),
      event.action,
      event.outcome,
      event.requestId ?? null,
      event.actor ?? null,
      event.details === undefined ? null : JSON.stringify(event.details)
    );
}
