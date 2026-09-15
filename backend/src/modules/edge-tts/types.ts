/**
 * 中文模块说明：Edge-TTS 配音领域，负责任务、Worker 网关、文件和队列
 */
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
