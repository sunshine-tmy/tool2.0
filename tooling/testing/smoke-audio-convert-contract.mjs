/** Verify the independently consumed conversion contract, without filesystem or decoder capabilities. */
import { smokeSharedContract } from "./shared-contract-consumer.mjs";
export async function smokeAudioConvertContract(repoRoot) {
  const runtime = `
    import {AudioConvertJobSchema,AUDIO_CONVERT_MAX_FILES,AUDIO_CONVERT_MAX_BYTES} from '@toolbox/shared/audio-convert';
    import {Value} from '@sinclair/typebox/value';
    function check(value){if(!value)throw new Error('conversion contract');}
    const job={id:'convert123',name:'example.flac',bitrate:192,status:'pending',progress:0,createdAt:'2026-11-01',updatedAt:'2026-11-01'};
    check(Value.Check(AudioConvertJobSchema,job));
    check(!Value.Check(AudioConvertJobSchema,{...job,ekey:'not-persistent'}));
    check(AUDIO_CONVERT_MAX_FILES===1000 && AUDIO_CONVERT_MAX_BYTES===104857600);
  `;
  await smokeSharedContract(repoRoot, {
    name: "audio-convert",
    declarations: `
      import type {AudioConvertJob} from '@toolbox/shared/audio-convert';
      import type {AudioConvertJob as RootJob} from '@toolbox/shared';
      declare const job:AudioConvertJob; const root:RootJob=job;
      // @ts-expect-error Keys never belong in persistent conversion records.
      const key:string=job.ekey;
    `,
    runtime,
    browserRuntime: runtime
  });
  console.log("Audio conversion contract smoke passed: independent browser-safe entry and nonpersistent keys.");
}
