import { smokeSharedContract } from "./shared-contract-consumer.mjs";

export async function smokeSpeechContract(repoRoot) {
  for (const custom of [false, true]) {
    const runtime = `
      import {FormatRegistry} from '@sinclair/typebox'; import {Value} from '@sinclair/typebox/value';
      function check(value,message){if(!value)throw new Error(message);}
      check(!FormatRegistry.Has('date-time'),'cold registry');
      const custom=${custom}, validator=value=>value==='custom-date';
      if(custom)FormatRegistry.Set('date-time',validator);
      const speech=await import('@toolbox/shared/speech');
      if(custom)check(FormatRegistry.Get('date-time')===validator,'custom preserved');
      for(const schema of [speech.EdgeTtsTaskSchema.properties.createdAt,speech.ChatterboxTaskSchema.properties.createdAt]) {
        check(Value.Check(schema,custom?'custom-date':'2026-10-22T00:00:00.000Z'),'valid date');
        check(!Value.Check(schema,'invalid'),'invalid date');
      }
      const edge=await import('@toolbox/shared/edge-tts'), clone=await import('@toolbox/shared/chatterbox');
      check(JSON.stringify(speech.EdgeTtsTaskSchema)===JSON.stringify(edge.EdgeTtsTaskSchema),'legacy Edge schema');
      check(JSON.stringify(speech.ChatterboxTaskSchema)===JSON.stringify(clone.ChatterboxTaskSchema),'legacy clone schema');
      check(speech.CHATTERBOX_LANGUAGES.includes('pt-BR'),'language');
    `;
    await smokeSharedContract(repoRoot, {
      name: custom ? "speech-custom" : "speech-default",
      declarations: `
        import type {EdgeTtsTask, ChatterboxTask, ChatterboxDevice} from '@toolbox/shared/speech';
        import type {EdgeTtsTask as OldEdge} from '@toolbox/shared/edge-tts';
        import type {ChatterboxTask as OldClone} from '@toolbox/shared/chatterbox';
        declare const edge:EdgeTtsTask; const old:OldEdge=edge;
        declare const clone:ChatterboxTask; const oldClone:OldClone=clone;
        // @ts-expect-error Existing device boundary is CPU/CUDA only.
        const device:ChatterboxDevice='mps';
      `,
      runtime,
      browserRuntime: custom
        ? runtime
        : `
        import {EdgeTtsTaskSchema, ChatterboxTaskSchema} from '@toolbox/shared/speech';
        import {Value} from '@sinclair/typebox/value';
        for(const schema of [EdgeTtsTaskSchema.properties.createdAt,ChatterboxTaskSchema.properties.createdAt]) {
          if(!Value.Check(schema,'2026-10-22T00:00:00.000Z')||Value.Check(schema,'invalid'))throw new Error('Lost static speech initialization');
        }
      `
    });
  }
  console.log(
    "Speech contract smoke passed: fixed legacy subpaths, independent engines and browser date initialization."
  );
}
