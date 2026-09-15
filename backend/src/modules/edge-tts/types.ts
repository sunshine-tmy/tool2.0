import type { EdgeTtsVoice } from "@toolbox/shared";

export type RuntimeInfo = { available: boolean; version?: string; message: string };
export type VoiceCache = { voices: EdgeTtsVoice[]; expiresAt: number };

export type TaskPaths = {
  dir: string;
  meta: string;
  request: string;
  audio: string;
  audioTemp: string;
  subtitle: string;
  subtitleTemp: string;
};
