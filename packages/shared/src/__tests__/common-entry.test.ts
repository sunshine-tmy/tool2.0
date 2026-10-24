import { describe, expect, expectTypeOf, it } from "vitest";
import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import * as root from "../index";
import * as common from "../common/index";
import * as response from "../common/api-response";
import * as api from "../common/api-schema";
import * as worker from "../common/worker-protocol";
import * as tools from "../common/tools";

describe("common contract entry", () => {
  it("preserves existing exports, original references and private initialization", () => {
    const existing = { ...response, ...api, ...worker, ...tools };
    expect(Object.keys(common).sort()).toEqual(Object.keys(existing).sort());
    for (const [key, value] of Object.entries(existing)) {
      expect(Reflect.get(common, key)).toBe(value);
      expect(Reflect.get(root, key)).toBe(value);
    }
    expect(common).not.toHaveProperty("registerSharedSchemaFormats");
  });
  it("preserves response factories and type optionality", () => {
    expectTypeOf<common.ApiResponse<{ value: number }>>().toEqualTypeOf<root.ApiResponse<{ value: number }>>();
    expectTypeOf<common.ApiSuccess<number>["requestId"]>().toEqualTypeOf<string | undefined>();
    expect(common.ok({ value: 1 })).toStrictEqual(root.ok({ value: 1 }));
    expect(common.fail("CODE", "message", { retry: true })).toStrictEqual(
      root.fail("CODE", "message", { retry: true })
    );
  });
  it("does not narrow response extra fields or relax strict request ids", () => {
    const payload = { success: true, data: { value: 1 }, requestId: "req-1", extra: true };
    const schema = common.apiSuccessSchema(Type.Object({ value: Type.Number() }));
    expect(Value.Check(schema, payload)).toBe(true);
    for (const sample of [{ taskId: "task-1" }, { taskId: "../task" }, { taskId: "task-1", path: "x" }]) {
      expect(Value.Check(common.TaskIdParamsSchema, sample)).toBe(Value.Check(root.TaskIdParamsSchema, sample));
      expect([...Value.Errors(common.TaskIdParamsSchema, sample)]).toEqual([
        ...Value.Errors(root.TaskIdParamsSchema, sample)
      ]);
    }
    expect(Value.Check(common.TaskIdParamsSchema, { taskId: "../task" })).toBe(false);
  });
  it("preserves worker protocol version, envelope checks and the six current tool ids", () => {
    expect(common.WORKER_PROTOCOL_VERSION).toBe(1);
    for (const sample of [{}, { provider: "sharp", model: "local", warnings: [] }]) {
      expect(common.isImageWorkerProcess(sample)).toBe(root.isImageWorkerProcess(sample));
    }
    expect(common.listTools().map((tool) => tool.id)).toEqual(root.listTools().map((tool) => tool.id));
    expect(common.listTools()).toHaveLength(6);
  });
});
