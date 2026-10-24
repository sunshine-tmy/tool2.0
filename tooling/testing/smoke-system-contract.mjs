import { smokeSharedContract } from "./shared-contract-consumer.mjs";

export async function smokeSystemContract(repoRoot) {
  const runtime = `
    import {ComponentPlatformSchema, ComponentJobStateSchema, DiagnosticActionSchema, diagnosticFailure, CleanupResultsSchema} from '@toolbox/shared/system';
    import {Value} from '@sinclair/typebox/value';
    function check(value,message){if(!value)throw new Error(message);}
    check(Value.Check(ComponentPlatformSchema,'win32-x64'),'platform');
    check(!Value.Check(ComponentPlatformSchema,'linux-x64'),'unsupported platform');
    check(Value.Check(ComponentJobStateSchema,'queued'),'state');
    check(!Value.Check(ComponentJobStateSchema,'success'),'invalid state');
    check(Value.Check(DiagnosticActionSchema,{action:'restart-worker',componentId:'image-ai',confirmed:true}),'confirmed action');
    check(!Value.Check(DiagnosticActionSchema,{action:'restart-worker',componentId:'image-ai',confirmed:false}),'unconfirmed action');
    check(!diagnosticFailure(new Error('untrusted-detail')).message.includes('untrusted-detail'),'error redaction');
    check(Value.Check(CleanupResultsSchema,[{id:'temp',label:'temporary',files:1,bytes:1}]),'cleanup result');
    check(!Value.Check(CleanupResultsSchema,[{id:'temp',label:'temporary',files:1,bytes:1,skippedFiles:0}]),'invalid skip count');
  `;
  await smokeSharedContract(repoRoot, {
    name: "system",
    declarations: `
      import type {ComponentJob, DiagnosticRun, ComponentPlatform} from '@toolbox/shared/system';
      import type {ComponentJob as RootJob, DiagnosticRun as RootRun} from '@toolbox/shared';
      declare const job:ComponentJob; const old:RootJob=job;
      declare const run:DiagnosticRun; const oldRun:RootRun=run;
      import type {CleanupResult} from '@toolbox/shared/system';
      import type {CleanupResult as RootCleanup} from '@toolbox/shared';
      declare const cleanup:CleanupResult; const originalCleanup:RootCleanup=cleanup;
      // @ts-expect-error Unsupported platforms do not become accepted by regrouping contracts.
      const platform:ComponentPlatform='linux-x64';
      // @ts-expect-error Mixed legacy image responses are not system capability contracts.
      import {ImageCompressResultSchema} from '@toolbox/shared/system';
    `,
    runtime,
    browserRuntime: runtime
  });
  console.log(
    "System contract smoke passed: browser-safe capabilities/diagnostics, original platforms and action confirmation."
  );
}
