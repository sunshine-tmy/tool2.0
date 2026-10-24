/** Audio-library expectations stay domain-specific; filesystem/compiler isolation is shared with image tests. */
import { smokeSharedContract } from "./shared-contract-consumer.mjs";

export async function smokeAudioLibraryContract(repoRoot) {
  await smokeSharedContract(repoRoot, {
    name: "audio-library",
    declarations: `
      import {AudioLibraryCatalogSchema, type AudioLibraryCatalog, type AudioLibraryItem, type AudioLibraryEdit} from '@toolbox/shared/audio-library';
      import type {AudioLibraryCatalog as RootCatalog, AudioLibraryItem as RootItem} from '@toolbox/shared';
      const legacy: AudioLibraryCatalog = {version:1, libraryId:'library-1', revision:0, groups:[], items:[], pendingDeletes:[]};
      const root: RootCatalog = legacy;
      const reverse: AudioLibraryCatalog = root;
      declare const item: AudioLibraryItem;
      const oldItem: RootItem = item;
      const edit: AudioLibraryEdit = {groupId:null};
      // @ts-expect-error Groups remain nullable IDs, never numeric IDs.
      const invalid: AudioLibraryEdit = {groupId:123};
      // @ts-expect-error Library entries must not expose unrelated image contracts.
      import {ImageAiTaskSchema} from '@toolbox/shared/audio-library';
    `,
    runtime: `
      import assert from 'node:assert/strict';
      import * as library from '@toolbox/shared/audio-library';
      import {Value} from '@sinclair/typebox/value';
      const legacy = {version:1, libraryId:'library-1', revision:0, groups:[], items:[], pendingDeletes:[]};
      // Validate before importing the old root: this entry must stand on its own.
      assert.equal(Value.Check(library.AudioLibraryCatalogSchema, legacy), true);
      assert.equal(Value.Check(library.AudioLibraryEditSchema, {groupId:null}), true);
      assert.equal(Value.Check(library.AudioLibraryGroupSchema, {id:'g', name:'分组', parentId:null}), true);
      assert.equal(Value.Check(library.AudioLibraryGroupSchema, {id:'g', name:'分组'}), false);
      const root = await import('@toolbox/shared');
      for (const [name,value] of Object.entries(library)) assert.deepEqual(value, root[name], name);
      assert.equal('ImageAiTaskSchema' in library, false);
      assert.equal(library.AUDIO_LIBRARY_MAX_FILE_BYTES, 100 * 1024 * 1024);
      assert.equal(library.AUDIO_LIBRARY_DEFAULT_STORAGE_BYTES, 10 * 1024 ** 3);
      for (const sample of [legacy, {...legacy,presets:[]}, {...legacy,presets:null}, {...legacy,path:'untrusted'}]) {
        assert.equal(Value.Check(library.AudioLibraryCatalogSchema,sample), Value.Check(root.AudioLibraryCatalogSchema,sample));
      }
      assert.equal(Value.Check(library.AudioLibraryCatalogSchema,{...legacy,presets:null}),false);
      assert.equal(Value.Check(library.AudioLibraryCatalogSchema,{...legacy,path:'untrusted'}),false);
    `
  });
  console.log(
    "Audio-library contract smoke passed: independent dist entry, legacy catalogs and nullable/optional fields."
  );
}
