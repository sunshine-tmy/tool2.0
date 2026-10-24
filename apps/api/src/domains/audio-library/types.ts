/** Read-only projections for importing speech assets; each engine retains its state machine and artifact lock. */
export type AudioLibrarySpeechItem = Readonly<{
  id: string;
  status: string;
  attempt: number;
  text: string;
  fileName?: string;
  referenceTranslation?: string;
  error?: string;
}>;

export type AudioLibrarySpeechBatch = Readonly<{
  id: string;
  language: string;
  items: readonly AudioLibrarySpeechItem[];
}>;

export interface AudioLibrarySpeechSource {
  withArtifact<T>(batchId: string, operation: () => Promise<T>): Promise<T>;
  get(batchId: string): AudioLibrarySpeechBatch | undefined | Promise<AudioLibrarySpeechBatch | undefined>;
  itemPaths(batchId: string, itemId: string): { readonly audio: string };
}
