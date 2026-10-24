/** Cold processes prove root initialization preserves default policy and existing validators. */
import { smokeSharedContract } from "./shared-contract-consumer.mjs";

const declarations = `
  import {XhsTranslationFieldSchema, LanNoteSchema, TaskSchema} from '@toolbox/shared';
  // @ts-expect-error Initialization is internal, not a new public cross-domain API.
  import {registerSharedSchemaFormats} from '@toolbox/shared';
`;

export async function smokeSchemaFormats(repoRoot) {
  await smokeSharedContract(repoRoot, {
    name: "formats-default",
    declarations,
    runtime: `
      import assert from 'node:assert/strict';
      import {FormatRegistry, Type} from '@sinclair/typebox';
      import {Value} from '@sinclair/typebox/value';
      assert.equal(FormatRegistry.Has('date-time'), false);
      const shared = await import('@toolbox/shared');
      assert.equal(FormatRegistry.Has('date-time'), true);
      const schema = Type.String({format:'date-time'});
      for (const value of ['2026-10-22T00:00:00.000Z','2026-10-22','Thu, 22 Oct 2026 00:00:00 GMT','2026-02-30','not-a-date','']) {
        assert.equal(Value.Check(schema,value), !Number.isNaN(Date.parse(value)), value);
      }
      const field = {source:'source', machine:'translation', editedAt:'2026-10-22T00:00:00.000Z'};
      assert.equal(Value.Check(shared.XhsTranslationFieldSchema,field),true);
      assert.equal(Value.Check(shared.XhsTranslationFieldSchema,{...field, editedAt:'not-a-date'}),false);
      assert.equal(Value.Check(shared.XhsTranslationFieldSchema,{...field, extra:true}),false);
      assert.equal(Value.Check(shared.XhsTranslationFieldSchema,{source:'source',machine:'translation'}),true);
      assert.equal('registerSharedSchemaFormats' in shared,false);
    `
  });
  await smokeSharedContract(repoRoot, {
    name: "formats-custom",
    declarations,
    runtime: `
      import assert from 'node:assert/strict';
      import {FormatRegistry, Type} from '@sinclair/typebox';
      import {Value} from '@sinclair/typebox/value';
      const custom = value => value === 'existing-custom-date';
      const unrelated = value => value === 'untouched';
      FormatRegistry.Set('date-time',custom);
      FormatRegistry.Set('existing-other-format',unrelated);
      const shared = await import('@toolbox/shared');
      assert.equal(FormatRegistry.Get('date-time'),custom);
      assert.equal(FormatRegistry.Get('existing-other-format'),unrelated);
      const schema = Type.String({format:'date-time'});
      assert.equal(Value.Check(schema,'existing-custom-date'),true);
      assert.equal(Value.Check(schema,'2026-10-22'),false);
      const field = {source:'source',machine:'translation',editedAt:'existing-custom-date'};
      assert.equal(Value.Check(shared.XhsTranslationFieldSchema,field),true);
      assert.equal(Value.Check(shared.XhsTranslationFieldSchema,{...field,editedAt:'2026-10-22'}),false);
    `
  });
  console.log(
    "Schema format smoke passed: cold dist initialization, unchanged Date.parse policy, custom validators retained."
  );
}
