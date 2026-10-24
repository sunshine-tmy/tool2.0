import { smokeSharedContract } from "./shared-contract-consumer.mjs";

export async function smokeArchiveContract(repoRoot) {
  for (const custom of [false, true]) {
    const runtime = `
      import {FormatRegistry} from '@sinclair/typebox';
      import {Value} from '@sinclair/typebox/value';
      function check(value,message) {if(!value) throw new Error(message);}
      check(!FormatRegistry.Has('date-time'),'cold registry');
      const custom=${custom}; const validator=value=>value==='custom-date';
      if(custom) FormatRegistry.Set('date-time',validator);
      const archive=await import('@toolbox/shared/archive');
      check(FormatRegistry.Has('date-time'),'independent initialization');
      if(custom) check(FormatRegistry.Get('date-time')===validator,'custom format');
      const field={source:'原文',machine:'translation',editedAt:custom?'custom-date':'2026-10-22T00:00:00.000Z'};
      check(Value.Check(archive.XhsTranslationFieldSchema,field),'valid translation date');
      check(!Value.Check(archive.XhsTranslationFieldSchema,{...field,editedAt:'invalid'}),'invalid date');
      check(!Value.Check(archive.XhsTranslationFieldSchema,{...field,cookie:'untrusted'}),'unknown field');
      check(archive.isContentTranslationBatchInput({mode:'missing-or-stale',filter:{platform:'douyin'}}),'neutral filter');
      check(!archive.isLegacyTranslationBatchInput({mode:'missing-or-stale',filter:{platform:'douyin'}}),'legacy boundary');
      check(archive.identifyArchiveLink('https://www.douyin.com/video/123456').ok,'platform links');
      check(!('registerSharedSchemaFormats' in archive),'private initializer');
    `;
    await smokeSharedContract(repoRoot, {
      name: custom ? "archive-custom" : "archive-default",
      declarations: `
        import type {ContentArchiveItem, XhsArchiveItem, ContentTranslationBatchInput} from '@toolbox/shared/archive';
        import type {ContentArchiveItem as RootItem} from '@toolbox/shared';
        declare const item:ContentArchiveItem; const root:RootItem=item;
        const batch:ContentTranslationBatchInput={mode:'missing-or-stale',filter:{platform:'douyin'}};
        // @ts-expect-error Legacy and neutral identities remain separate.
        const old:XhsArchiveItem=item;
        // @ts-expect-error Unrelated schemas are not exported.
        import {ImageAiTaskSchema} from '@toolbox/shared/archive';
      `,
      runtime,
      browserRuntime: custom
        ? runtime
        : `
        import {XhsTranslationFieldSchema, isContentTranslationBatchInput, isLegacyTranslationBatchInput} from '@toolbox/shared/archive';
        import {FormatRegistry} from '@sinclair/typebox';
        import {Value} from '@sinclair/typebox/value';
        if(!FormatRegistry.Has('date-time')) throw new Error('Lost static initialization');
        const field={source:'source',machine:'translation',editedAt:'2026-10-22T00:00:00.000Z'};
        if(!Value.Check(XhsTranslationFieldSchema,field)) throw new Error('Valid date rejected');
        if(Value.Check(XhsTranslationFieldSchema,{...field,editedAt:'invalid'})) throw new Error('Invalid date accepted');
        const batch={mode:'missing-or-stale',filter:{platform:'douyin'}};
        if(!isContentTranslationBatchInput(batch)||isLegacyTranslationBatchInput(batch)) throw new Error('Legacy boundary changed');
      `
    });
  }
  console.log(
    "Archive contract smoke passed: independent default/custom dates, static browser imports and legacy boundaries."
  );
}
