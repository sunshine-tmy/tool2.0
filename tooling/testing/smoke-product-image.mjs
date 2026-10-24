import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const sourceId = "product-smoke-source";
const sourceUrl = `/api/v1/tools/image-ai/tasks/${sourceId}/files/${sourceId}-1`;

/** Small synthetic legacy archive, isolated from models, services and user business data. */
export async function prepareProductSmokeFixture(root, repoRoot) {
  const sharp = createRequire(path.join(repoRoot, "apps/api/package.json"))("sharp");
  const inputs = path.join(root, "image-ai/inputs", sourceId),
    outputs = path.join(root, "image-ai/outputs", sourceId),
    tasks = path.join(root, "image-ai/tasks");
  await Promise.all([
    fs.mkdir(inputs, { recursive: true }),
    fs.mkdir(outputs, { recursive: true }),
    fs.mkdir(tasks, { recursive: true })
  ]);
  const input = path.join(inputs, "original.png"),
    output = path.join(outputs, "cutout.png");
  const bytes = await sharp({ create: { width: 20, height: 10, channels: 4, background: "#ff0000" } })
    .png()
    .toBuffer();
  await Promise.all([fs.writeFile(input, bytes), fs.writeFile(output, bytes)]);
  const now = new Date().toISOString();
  await fs.writeFile(
    path.join(tasks, `${sourceId}.json`),
    JSON.stringify({
      id: sourceId,
      operation: "background_remove",
      status: "completed",
      progress: 100,
      queuePosition: null,
      inputs: [
        { path: input, originalName: "product.png", mimetype: "image/png", size: bytes.length, width: 20, height: 10 }
      ],
      results: [
        {
          id: `${sourceId}-1`,
          originalName: "product.png",
          outputName: "cutout.png",
          outputPath: output,
          downloadUrl: sourceUrl,
          width: 20,
          height: 10,
          provider: "birefnet-general",
          model: "synthetic-smoke",
          warnings: []
        }
      ],
      warnings: [],
      createdAt: now,
      updatedAt: now,
      expiresAt: null
    })
  );
}

export async function smokeProductImage(app, recipe) {
  recipe.canvas = { width: 256, height: 256 };
  const fields = {
    taskId: sourceId,
    resultId: `${sourceId}-1`,
    recipe: JSON.stringify(recipe),
    submissionKey: "compiled-product-smoke-123"
  };
  const boundary = "product-smoke-boundary-123";
  const payload =
    Object.entries(fields)
      .map(([key, value]) => `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`)
      .join("") + `--${boundary}--\r\n`;
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/tools/image-ai/compositions",
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload
  });
  assert.equal(response.statusCode, 202, response.body);
  const id = response.json().data.id;
  for (let attempt = 0; attempt < 160; attempt++) {
    const status = await app.inject({ method: "GET", url: `/api/v1/tools/image-ai/tasks/${id}` });
    const task = status.json().data;
    if (["pending", "running"].includes(task.status)) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      continue;
    }
    assert.equal(task.status, "completed", JSON.stringify(task));
    assert.equal(task.results[0].provider, "sharp");
    assert.equal(task.results[0].width, 256);
    const download = await app.inject({ method: "GET", url: task.results[0].downloadUrl });
    assert.equal(download.statusCode, 200);
    assert.equal(download.headers["content-type"], "image/png");
    console.log("Built product renderer smoke passed: independent local PNG, no Python worker.");
    return;
  }
  throw new Error("Built product renderer smoke timed out");
}
