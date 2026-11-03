/** Check the new contract as a cold dist consumer, including its browser-safe subpath. */
import { smokeSharedContract } from "./shared-contract-consumer.mjs";
export async function smokeAudioExtractContract(repoRoot) {
  const runtime = `
    import { AudioExtractInputSchema, AudioExtractJobSchema, AUDIO_EXTRACT_MAX_FILES } from '@toolbox/shared/audio-extract';
    import { Value } from '@sinclair/typebox/value';
    const input={sourceId:'a'.repeat(21),trackIndices:[1],format:'mp3',bitrate:192};
    if(!Value.Check(AudioExtractInputSchema,input)||Value.Check(AudioExtractInputSchema,{...input,path:'private'})||AUDIO_EXTRACT_MAX_FILES!==1000)throw new Error('extraction contract');
    const job={id:'backup_id_12',name:'video.mp4',sourceSha256:'a'.repeat(64),sourceBytes:100,track:{index:1,codec:'aac',language:'und',title:'',channels:2,sampleRate:48000,duration:1,default:true},format:'mp3',bitrate:192,status:'pending',phase:'queued',progress:0,extension:'mp3',mimeType:'audio/mpeg',createdAt:'2026-11-03T00:00:00Z',updatedAt:'2026-11-03T00:00:00Z'};
    if(!Value.Check(AudioExtractJobSchema,job))throw new Error('cold job date/id contract');
  `;
  await smokeSharedContract(repoRoot, {
    name: "audio-extract",
    declarations: `
      import type { AudioExtractJob } from '@toolbox/shared/audio-extract';
      import type { AudioExtractJob as RootJob } from '@toolbox/shared';
      declare const job:AudioExtractJob; const root:RootJob=job;
      // @ts-expect-error Local source paths never belong in portable result records.
      const path:string=job.path;
    `,
    runtime,
    browserRuntime: runtime
  });
  console.log("Audio extraction contract smoke passed: independent browser-safe entry and portable records.");
}
