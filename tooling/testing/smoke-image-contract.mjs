/** Image-only samples share the hermetic contract consumer, without sharing domain expectations. */
import { smokeSharedContract } from "./shared-contract-consumer.mjs";

export async function smokeImageContract(repoRoot) {
  await smokeSharedContract(repoRoot, {
    name: "image",
    declarations: `
      import {defaultProductImageRecipe, normalizeImageOptions, ProductImageRecipeSchema, type ProductImageRecipe, type ImageAiTask} from '@toolbox/shared/image';
      import type {ProductImageRecipe as RootRecipe, ImageAiTask as RootTask, ImageCompressResult as RootCompression} from '@toolbox/shared';
      import type {ImageCompressResult} from '@toolbox/shared/image';
      declare const compressed:ImageCompressResult; const originalCompression:RootCompression=compressed;
      const recipe: RootRecipe = defaultProductImageRecipe();
      const reverse: ProductImageRecipe = recipe;
      declare const task: ImageAiTask;
      const original: RootTask = task;
      const options = normalizeImageOptions({quality:78, outputFormat:'png'});
      // @ts-expect-error Product layout fields retain their existing types.
      const invalid: ProductImageRecipe = {...recipe, canvas: {width:'1600', height:1600}};
      // @ts-expect-error Unrelated domains must not leak into the image entry.
      import {listTools} from '@toolbox/shared/image';
      // @ts-expect-error Cleanup stays in the system domain.
      import {CleanupResultsSchema} from '@toolbox/shared/image';
    `,
    runtime: `
        import assert from 'node:assert/strict';
        import * as image from '@toolbox/shared/image';
        import * as root from '@toolbox/shared';
        import {Value} from '@sinclair/typebox/value';
        for (const [name,value] of Object.entries(image)) {
          assert.equal(typeof value, typeof root[name], name);
          if (typeof value !== 'function') assert.deepEqual(value, root[name], name);
        }
        assert.equal('listTools' in image, false);
        assert.deepEqual(image.defaultProductImageRecipe(), root.defaultProductImageRecipe());
        const recipe = image.defaultProductImageRecipe();
        assert.equal(Value.Check(image.ProductImageRecipeSchema, recipe), true);
        for (const sample of [recipe, {...recipe, unknown:true}, {...recipe, background:null}]) {
          assert.equal(Value.Check(image.ProductImageRecipeSchema, sample), Value.Check(root.ProductImageRecipeSchema, sample));
        }
        assert.equal(Value.Check(image.ProductImageRecipeSchema, {...recipe, unknown:true}), false);
        assert.deepEqual(image.normalizeImageOptions({}), root.normalizeImageOptions({}));
        assert.deepEqual(image.productImageLayout(1600,1600,800,400,recipe.layout), root.productImageLayout(1600,1600,800,400,recipe.layout));
      `,
    browserRuntime: `
      import {ImageCompressResultSchema} from '@toolbox/shared/image';
      import {Value} from '@sinclair/typebox/value';
      const sample={task:{id:'task-1',toolId:'image-compress',status:'completed',progress:100,createdAt:'2026-10-23T00:00:00Z',updatedAt:'2026-10-23T00:00:01Z'},downloadUrl:'/api/v1/files/task-1.png',originalName:'a.jpg',outputName:'task-1.png',outputFormat:'png',originalSize:1,outputSize:2,savedBytes:-1,compressionRatio:2,width:1,height:1};
      if(!Value.Check(ImageCompressResultSchema,sample))throw new Error('larger output remains accepted');
      if(Value.Check(ImageCompressResultSchema,{...sample,extra:true}))throw new Error('strict response changed');
    `
  });
  console.log(
    "Image contract smoke passed: isolated dist types/runtime, legacy schemas and browser-safe declarations."
  );
}
