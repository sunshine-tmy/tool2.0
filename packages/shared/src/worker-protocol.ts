import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

export const WORKER_PROTOCOL_VERSION = 1 as const;

const NonNegativeNumber = Type.Number({ minimum: 0 });
const WorkerProtocolVersionSchema = Type.Integer({ minimum: 1 });

export const ImageWorkerHealthSchema = Type.Object({
  protocolVersion: WorkerProtocolVersionSchema,
  available: Type.Boolean(),
  deploymentUsage: Type.Union([Type.Literal("internal-noncommercial"), Type.Literal("commercial")]),
  workerUrl: Type.String({ pattern: "^https?://" }),
  models: Type.Array(
    Type.Object({
      provider: Type.String({ minLength: 1 }),
      model: Type.String({ minLength: 1 }),
      version: Type.String(),
      license: Type.String(),
      sha256: Type.Optional(Type.String({ pattern: "^[a-fA-F0-9]{64}$" })),
      device: Type.String(),
      available: Type.Boolean(),
      reason: Type.Optional(Type.String())
    })
  )
});

export const ImageWorkerSuggestionSchema = Type.Object({
  width: Type.Integer({ minimum: 1 }),
  height: Type.Integer({ minimum: 1 }),
  suggestions: Type.Array(
    Type.Object({
      polygon: Type.Array(
        Type.Object({
          x: Type.Number({ minimum: 0, maximum: 1 }),
          y: Type.Number({ minimum: 0, maximum: 1 })
        }),
        { minItems: 3 }
      ),
      confidence: Type.Number({ minimum: 0, maximum: 1 })
    })
  ),
  provider: Type.Literal("paddleocr"),
  model: Type.String({ minLength: 1 }),
  warnings: Type.Array(Type.String())
});

export const ImageWorkerProcessSchema = Type.Object({
  provider: Type.Union([
    Type.Literal("lama"),
    Type.Literal("real-esrgan"),
    Type.Literal("bria-rmbg-2.0"),
    Type.Literal("birefnet-general")
  ]),
  model: Type.String({ minLength: 1 }),
  warnings: Type.Optional(Type.Array(Type.String()))
});

export const ChatterboxWorkerHealthSchema = Type.Object({
  protocolVersion: WorkerProtocolVersionSchema,
  available: Type.Boolean(),
  packageVersion: Type.Optional(Type.String()),
  model: Type.Literal("multilingual-v3"),
  modelLoaded: Type.Boolean(),
  device: Type.Optional(Type.Union([Type.Literal("cuda"), Type.Literal("cpu")])),
  gpuName: Type.Optional(Type.String()),
  message: Type.Optional(Type.String()),
  watermarked: Type.Literal(true)
});

export const ChatterboxWorkerGenerateSchema = Type.Object({
  sampleRate: Type.Integer({ minimum: 1 }),
  samples: Type.Integer({ minimum: 0 }),
  durationSeconds: NonNegativeNumber,
  chunks: Type.Integer({ minimum: 1 }),
  segments: Type.Array(
    Type.Object({
      text: Type.String({ minLength: 1 }),
      startSeconds: NonNegativeNumber,
      endSeconds: NonNegativeNumber
    })
  ),
  device: Type.String({ minLength: 1 }),
  watermarked: Type.Literal(true)
});

export type ImageWorkerHealth = Static<typeof ImageWorkerHealthSchema>;
export type ImageWorkerSuggestion = Static<typeof ImageWorkerSuggestionSchema>;
export type ImageWorkerProcess = Static<typeof ImageWorkerProcessSchema>;
export type ChatterboxWorkerHealth = Static<typeof ChatterboxWorkerHealthSchema>;
export type ChatterboxWorkerGenerate = Static<typeof ChatterboxWorkerGenerateSchema>;

export function isImageWorkerHealth(value: unknown): value is ImageWorkerHealth {
  return Value.Check(ImageWorkerHealthSchema, value);
}

export function isImageWorkerSuggestion(value: unknown): value is ImageWorkerSuggestion {
  return Value.Check(ImageWorkerSuggestionSchema, value);
}

export function isImageWorkerProcess(value: unknown): value is ImageWorkerProcess {
  return Value.Check(ImageWorkerProcessSchema, value);
}

export function isChatterboxWorkerHealth(value: unknown): value is ChatterboxWorkerHealth {
  return Value.Check(ChatterboxWorkerHealthSchema, value);
}

export function isChatterboxWorkerGenerate(value: unknown): value is ChatterboxWorkerGenerate {
  return Value.Check(ChatterboxWorkerGenerateSchema, value);
}
