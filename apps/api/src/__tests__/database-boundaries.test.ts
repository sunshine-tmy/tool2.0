/** Transaction and persistence compatibility on owned in-memory databases only. */
import { afterEach, expect, it } from "vitest";
import { ToolboxDatabase } from "../database/toolbox-database";

const databases: ToolboxDatabase[] = [];
const createdAt = "2026-01-01T00:00:00.000Z";
function database() {
  const value = new ToolboxDatabase(":memory:");
  databases.push(value);
  return value;
}
afterEach(() => {
  for (const value of databases.splice(0)) value.close();
});
function entity(id: string) {
  return { id, kind: "boundary-fixture", payload: { nested: [id, null] }, createdAt, updatedAt: createdAt };
}

it("rolls back entity, file metadata and audit in the same facade transaction", () => {
  const db = database(),
    failure = new Error("injected transaction failure");
  expect(() =>
    db.transaction(() => {
      db.upsert(entity("first"));
      db.upsertFile({
        id: "file-first",
        entityKind: "boundary-fixture",
        entityId: "first",
        relativePath: "artifacts/first.png",
        byteSize: 7,
        createdAt
      });
      db.appendAudit({ action: "fixture", outcome: "attempted", details: { id: "first" } });
      throw failure;
    })
  ).toThrow(failure);
  expect(db.list("boundary-fixture")).toEqual([]);
  expect(db.listFiles()).toEqual([]);
  expect(db.connection.prepare("SELECT * FROM audit_events").all()).toEqual([]);
});

it("keeps nested savepoint rollback separate from the outer transaction", () => {
  const db = database();
  db.transaction(() => {
    db.upsert(entity("outer"));
    expect(() =>
      db.transaction(() => {
        db.upsert(entity("inner"));
        db.appendAudit({ action: "nested", outcome: "attempted" });
        throw new Error("inner failure");
      })
    ).toThrow("inner failure");
    db.upsert(entity("sibling"));
  });
  expect(db.get("boundary-fixture", "outer")?.payload).toEqual({ nested: ["outer", null] });
  expect(db.get("boundary-fixture", "inner")).toBeUndefined();
  expect(
    db
      .list("boundary-fixture")
      .map((value) => value.id)
      .sort()
  ).toEqual(["outer", "sibling"]);
  expect(db.connection.prepare("SELECT * FROM audit_events").all()).toEqual([]);
});

it("keeps file path conflicts, original creation time and nullable row mapping", () => {
  const db = database();
  db.upsertFile({
    id: "old",
    entityKind: "fixture",
    entityId: "source",
    relativePath: "./assets/商品.png",
    byteSize: 7,
    createdAt
  });
  const later = "2026-02-01T00:00:00.000Z";
  db.upsertFile({
    id: "new",
    entityKind: "fixture",
    entityId: "source",
    relativePath: "assets/商品.png",
    byteSize: 9,
    owner: "owner",
    createdAt: later
  });
  expect(db.getFile("old")).toBeUndefined();
  expect(db.getFile("new")).toEqual({
    id: "new",
    entityKind: "fixture",
    entityId: "source",
    relativePath: "assets/商品.png",
    byteSize: 9,
    sha256: undefined,
    mediaType: undefined,
    owner: "owner",
    createdAt
  });
  expect(db.listFiles({ entityKind: "fixture", entityId: "source", owner: "other" })).toEqual([]);
  expect(db.removeFilesForEntity("fixture", "source")).toBe(1);
  expect(db.removeFile("new")).toBe(false);
});

it("preserves SQL NULL versus JSON null in audit details", () => {
  const db = database();
  db.appendAudit({ action: "missing", outcome: "ok" });
  db.appendAudit({ action: "explicit-null", outcome: "ok", details: null });
  db.appendAudit({
    action: "object",
    outcome: "ok",
    requestId: "request",
    actor: "actor",
    details: { selected: ["one"] }
  });
  expect(
    db.connection.prepare("SELECT action, request_id, actor, details_json FROM audit_events ORDER BY id").all()
  ).toEqual([
    { action: "missing", request_id: null, actor: null, details_json: null },
    { action: "explicit-null", request_id: null, actor: null, details_json: "null" },
    { action: "object", request_id: "request", actor: "actor", details_json: '{"selected":["one"]}' }
  ]);
});
