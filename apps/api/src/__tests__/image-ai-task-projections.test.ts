import { expect, expectTypeOf, it } from "vitest";
import { defaultProductImageRecipe } from "@toolbox/shared";
import type { StoredInput as LegacyInput, StoredImageAiTask as LegacyTask } from "../domains/image-ai/task-manager";
import type { StoredInput, StoredImageAiTask } from "../domains/image-ai/types";
import { toEntity, toPublicTask, toUnifiedTask } from "../domains/image-ai/task-projections";

function stored(): StoredImageAiTask {
  return {
    id: "projection-001",
    operation: "product_image",
    status: "completed",
    progress: 73,
    queuePosition: null,
    scale: 2,
    recipe: defaultProductImageRecipe(),
    source: { taskId: "source-001", resultId: "source-001-1" },
    phase: "已留档",
    results: [
      {
        id: "projection-001-1",
        originalName: "商品.png",
        outputName: "product.png",
        outputPath: "synthetic-private/outputs/product.png",
        downloadUrl: "/api/v1/tools/image-ai/tasks/projection-001/files/projection-001-1",
        width: 32,
        height: 24,
        provider: "sharp",
        model: "商品图渲染器 v1",
        warnings: ["result warning"]
      }
    ],
    inputs: [
      {
        path: "synthetic-private/input.png",
        originalName: "商品.png",
        mimetype: "image/png",
        size: 10,
        width: 32,
        height: 24
      }
    ],
    warnings: ["task warning"],
    error: "领域错误原文",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    expiresAt: null,
    maskPath: "synthetic-private/mask.png",
    assets: { foreground: "synthetic-private/foreground.png" },
    cancelRequested: true,
    submissionKey: "synthetic-private-submission"
  };
}

it("keeps the original manager type exports identical to their new single owner", () => {
  expectTypeOf<LegacyInput>().toEqualTypeOf<StoredInput>();
  expectTypeOf<LegacyTask>().toEqualTypeOf<StoredImageAiTask>();
});

it.each(["pending", "running", "completed", "failed", "canceled"] as const)(
  "projects %s to the existing unified shape without changing the domain object",
  (status) => {
    const task = stored();
    task.status = status;
    const before = structuredClone(task);
    Object.freeze(task);
    expect(toUnifiedTask(task)).toStrictEqual({
      id: task.id,
      toolId: "image-ai",
      status: status === "canceled" ? "failed" : status,
      progress: 73,
      outputPath: task.results[0].outputPath,
      error: status === "canceled" ? "CANCELLED" : task.error,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt
    });
    expect(task).toStrictEqual(before);
  }
);

it("projects only the first output and does not invent missing outputs or errors", () => {
  const task = stored();
  task.results.push({ ...task.results[0], id: "projection-001-2", outputPath: "second.png" });
  expect(toUnifiedTask(task).outputPath).toBe(task.results[0].outputPath);
  task.results = [];
  delete task.error;
  expect(toUnifiedTask(task)).toHaveProperty("outputPath", undefined);
  expect(toUnifiedTask(task)).toHaveProperty("error", undefined);
  task.status = "canceled";
  expect(toUnifiedTask(task).error).toBe("CANCELLED");
});

it.each(["pending", "running", "completed", "failed", "canceled"] as const)(
  "keeps %s entity status, payload identity and metadata unchanged",
  (status) => {
    const task = stored();
    task.status = status;
    const before = structuredClone(task);
    Object.freeze(task);
    const entity = toEntity(task);
    expect(entity).toStrictEqual({
      id: task.id,
      kind: "image-ai-task",
      status,
      payload: task,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt
    });
    expect(entity.payload).toBe(task);
    expect(entity).not.toBe(toEntity(task));
    expect(Object.keys(entity)).toEqual(["id", "kind", "status", "payload", "createdAt", "updatedAt"]);
    expect(task).toStrictEqual(before);
  }
);

it("keeps the public field whitelist and original property order without exposing stored paths", () => {
  const task = stored();
  const before = structuredClone(task);
  Object.freeze(task);
  const projected = toPublicTask(task);
  expect(Object.keys(projected)).toEqual([
    "id",
    "operation",
    "status",
    "progress",
    "queuePosition",
    "scale",
    "recipe",
    "source",
    "phase",
    "results",
    "inputs",
    "warnings",
    "error",
    "createdAt",
    "updatedAt",
    "expiresAt"
  ]);
  if (!projected.inputs) throw new Error("Expected stored inputs to be projected");
  expect(projected.inputs).toStrictEqual([
    { originalName: "商品.png", mimetype: "image/png", size: 10, width: 32, height: 24 }
  ]);
  expect(Object.keys(projected.results[0])).toEqual([
    "id",
    "originalName",
    "outputName",
    "downloadUrl",
    "width",
    "height",
    "provider",
    "model",
    "warnings"
  ]);
  expect(JSON.stringify(projected)).not.toContain("synthetic-private");
  expect(projected).toMatchObject({
    operation: "product_image",
    status: "completed",
    progress: 73,
    queuePosition: null,
    scale: 2,
    phase: "已留档",
    error: task.error,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    expiresAt: null
  });
  expect(task).toStrictEqual(before);
});

it("copies only the same containers while preserving the existing nested reference ownership", () => {
  const task = stored();
  const projected = toPublicTask(task);
  if (!projected.inputs) throw new Error("Expected stored inputs to be projected");
  expect(projected).not.toBe(task);
  expect(projected.results).not.toBe(task.results);
  expect(projected.results[0]).not.toBe(task.results[0]);
  expect(projected.inputs).not.toBe(task.inputs);
  expect(projected.inputs[0]).not.toBe(task.inputs[0]);
  expect(projected.warnings).not.toBe(task.warnings);
  expect(projected.recipe).toBe(task.recipe);
  expect(projected.source).toBe(task.source);
  expect(projected.results[0].warnings).toBe(task.results[0].warnings);
  projected.results[0].outputName = "caller.png";
  projected.inputs[0].originalName = "caller.png";
  projected.warnings.push("caller-only");
  expect(task.results[0].outputName).toBe("product.png");
  expect(task.inputs[0].originalName).toBe("商品.png");
  expect(task.warnings).toEqual(["task warning"]);
});

it("preserves result extension fields but does not add an input or top-level extension to the public DTO", () => {
  const task = stored();
  const extension = { label: "existing extension" };
  task.results[0] = Object.assign(task.results[0], { extension });
  task.inputs[0] = Object.assign(task.inputs[0], { extension });
  Object.assign(task, { extension });
  const projected = toPublicTask(task);
  expect(projected.results[0]).toHaveProperty("extension", extension);
  expect(Reflect.get(projected.results[0], "extension")).toBe(extension);
  expect(projected.inputs?.[0]).not.toHaveProperty("extension");
  expect(projected).not.toHaveProperty("extension");
});

it("retains explicit undefined optional fields, queue positions and expiry without defaulting them", () => {
  const task = stored();
  delete task.scale;
  delete task.recipe;
  delete task.source;
  delete task.phase;
  delete task.error;
  task.results = [];
  task.inputs = [];
  task.queuePosition = 3;
  task.expiresAt = "2099-01-01T00:00:00.000Z";
  const projected = toPublicTask(task);
  for (const key of ["scale", "recipe", "source", "phase", "error"]) {
    expect(projected).toHaveProperty(key, undefined);
    expect(JSON.parse(JSON.stringify(projected))).not.toHaveProperty(key);
  }
  expect(projected).toMatchObject({ results: [], inputs: [], queuePosition: 3, expiresAt: task.expiresAt });
  expect(task.expiresAt).toBe("2099-01-01T00:00:00.000Z");
});
