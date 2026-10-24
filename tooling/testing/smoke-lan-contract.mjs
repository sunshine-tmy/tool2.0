import { smokeSharedContract } from "./shared-contract-consumer.mjs";

export async function smokeLanContract(repoRoot) {
  for (const custom of [false, true]) {
    const checks = `
      import {FormatRegistry} from '@sinclair/typebox';
      import {Value} from '@sinclair/typebox/value';
      function check(value, message) { if (!value) throw new Error(message); }
      check(!FormatRegistry.Has('date-time'),'cold registry');
      const custom = ${custom};
      const validator = value => value === 'custom-date';
      if (custom) FormatRegistry.Set('date-time',validator);
      const lan = await import('@toolbox/shared/lan');
      check(FormatRegistry.Has('date-time'),'initializer retained');
      if (custom) check(FormatRegistry.Get('date-time') === validator,'custom validator preserved');
      const record = {id:'file-123',originalName:'商品.pdf',storedName:'file.pdf',mimeType:'application/pdf',extension:'pdf',size:1,category:'pdf',createdAt:custom?'custom-date':'2026-10-22T00:00:00.000Z',expiresAt:custom?'custom-date':'2026-10-23T00:00:00.000Z',downloadCount:0,previewable:true};
      check(Value.Check(lan.LanFileRecordSchema,record),'valid file date');
      check(!Value.Check(lan.LanFileRecordSchema,{...record,createdAt:'invalid'}),'invalid date');
      check(!Value.Check(lan.LanFileRecordSchema,{...record,untrusted:true}),'unknown field');
      check(lan.classifyLanFile('商品.pdf') === 'pdf','classification');
      check(!('registerSharedSchemaFormats' in lan),'private initializer');
    `;
    await smokeSharedContract(repoRoot, {
      name: custom ? "lan-custom" : "lan-default",
      declarations: `
        import type {LanFileRecord, LanChunkParams, LanApplicationAccess} from '@toolbox/shared/lan';
        import type {LanFileRecord as RootRecord} from '@toolbox/shared';
        declare const record: LanFileRecord; const root: RootRecord = record;
        const params: LanChunkParams = {uploadId:'upload-1',index:'0'};
        // @ts-expect-error URL chunk indexes remain strings, not numbers.
        const bad: LanChunkParams = {uploadId:'upload-1',index:0};
        // @ts-expect-error Cross-domain exports must not leak.
        import {ImageAiTaskSchema} from '@toolbox/shared/lan';
      `,
      runtime: checks,
      browserRuntime: custom
        ? checks
        : `
        import {LanFileRecordSchema, classifyLanFile} from '@toolbox/shared/lan';
        import {FormatRegistry} from '@sinclair/typebox';
        import {Value} from '@sinclair/typebox/value';
        if (!FormatRegistry.Has('date-time')) throw new Error('Static named imports lost initialization');
        const file={id:'file-123',originalName:'商品.pdf',storedName:'file.pdf',mimeType:'application/pdf',extension:'pdf',size:1,category:'pdf',createdAt:'2026-10-22T00:00:00.000Z',expiresAt:'2026-10-23T00:00:00.000Z',downloadCount:0,previewable:true};
        if (!Value.Check(LanFileRecordSchema,file)) throw new Error('Static consumer rejected valid date');
        if (Value.Check(LanFileRecordSchema,{...file,createdAt:'invalid'})) throw new Error('Static consumer accepted invalid date');
        if (classifyLanFile('商品.pdf') !== 'pdf') throw new Error('Classification changed');
      `
    });
  }
  console.log("LAN contract smoke passed: cold/default/custom registry, browser tree-shaking and legacy fields.");
}
