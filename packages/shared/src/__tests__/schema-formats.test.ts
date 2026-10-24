import { afterEach, describe, expect, it, vi } from "vitest";
import { FormatRegistry, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

const previousDateTime = FormatRegistry.Get("date-time");
afterEach(() => {
  if (previousDateTime) FormatRegistry.Set("date-time", previousDateTime);
  else FormatRegistry.Delete("date-time");
  vi.resetModules();
});

describe("existing shared date-time initialization policy", () => {
  it("does not register formats on helper import and initializes explicitly only once", async () => {
    FormatRegistry.Delete("date-time");
    vi.resetModules();
    const { registerSharedSchemaFormats } = await import("../common/schema-formats");
    expect(FormatRegistry.Has("date-time")).toBe(false);
    registerSharedSchemaFormats();
    const registered = FormatRegistry.Get("date-time");
    expect(registered).toBeDefined();
    registerSharedSchemaFormats();
    expect(FormatRegistry.Get("date-time")).toBe(registered);
  });

  it("keeps custom date-time and unrelated validators during repeated explicit initialization", async () => {
    const { registerSharedSchemaFormats } = await import("../common/schema-formats");
    const unrelated = FormatRegistry.Get("email");
    const custom = (value: string) => value === "custom";
    FormatRegistry.Set("date-time", custom);
    registerSharedSchemaFormats();
    registerSharedSchemaFormats();
    expect(FormatRegistry.Get("date-time")).toBe(custom);
    expect(FormatRegistry.Get("email")).toBe(unrelated);
  });

  it("keeps the exact Date.parse acceptance policy when the format was absent", async () => {
    FormatRegistry.Delete("date-time");
    vi.resetModules();
    await import("../common/api-schema");
    const schema = Type.String({ format: "date-time" });
    for (const value of [
      "2026-10-22T00:00:00.000Z",
      "2026-10-22",
      "Thu, 22 Oct 2026 00:00:00 GMT",
      "2026-02-30",
      "not-a-date",
      ""
    ]) {
      expect(Value.Check(schema, value), value).toBe(!Number.isNaN(Date.parse(value)));
    }
    expect(Value.Check(schema, null)).toBe(false);
    expect(Value.Check(schema, 123)).toBe(false);
  });

  it("does not overwrite a pre-existing custom validator when loading the original API schemas", async () => {
    const custom = vi.fn((value: string) => value === "existing-custom-date");
    FormatRegistry.Set("date-time", custom);
    vi.resetModules();
    await import("../common/api-schema");
    expect(FormatRegistry.Get("date-time")).toBe(custom);
    expect(Value.Check(Type.String({ format: "date-time" }), "existing-custom-date")).toBe(true);
    expect(Value.Check(Type.String({ format: "date-time" }), "2026-10-22")).toBe(false);
  });
});
