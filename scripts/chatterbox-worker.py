#!/usr/bin/env python3
# 中文模块说明：工程与 Worker 脚本，负责 本地 AI/翻译/配音 Worker 协议和进程服务
"""Loopback-only Chatterbox Multilingual V3 inference worker."""

from __future__ import annotations

import argparse
import asyncio
import importlib.metadata
import json
import os
import random
import re
from pathlib import Path
from typing import Any, Literal

ROOT = Path(__file__).resolve().parents[1]


def load_repo_env() -> None:
    env_path = ROOT / ".env"
    if not env_path.is_file():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_repo_env()


def project_path(value: str | Path) -> Path:
    candidate = Path(value)
    return (ROOT / candidate).resolve() if not candidate.is_absolute() else candidate.resolve()


BASE_STORAGE_ROOT = project_path(os.getenv("STORAGE_ROOT", "storage"))
STORAGE_ROOT = project_path(os.getenv("CHATTERBOX_STORAGE_ROOT", str(BASE_STORAGE_ROOT / "chatterbox")))
MODELS_ROOT = project_path(os.getenv("CHATTERBOX_MODELS_ROOT", "models/chatterbox"))
HOST = os.getenv("CHATTERBOX_WORKER_HOST", "127.0.0.1")
PORT = int(os.getenv("CHATTERBOX_WORKER_PORT", "3220"))
DEVICE_SETTING = os.getenv("CHATTERBOX_DEVICE", "auto").strip().lower()
MODEL_IDLE_MINUTES = max(0, int(os.getenv("CHATTERBOX_MODEL_IDLE_MINUTES", "10")))
MAX_TEXT_LENGTH = 1200

os.environ.setdefault("HF_HOME", str(MODELS_ROOT / "huggingface"))
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field


class WorkerFailure(RuntimeError):
    def __init__(self, code: str, message: str, status: int = 503):
        super().__init__(message)
        self.code = code
        self.status = status


class GenerateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_TEXT_LENGTH)
    language: Literal["ms", "en", "pt-BR"]
    reference_path: str
    output_path: str
    exaggeration: float = Field(default=0.5, ge=0.25, le=1.5)
    cfg_weight: float = Field(default=0.5, ge=0.0, le=1.0)
    temperature: float = Field(default=0.8, ge=0.1, le=1.5)
    seed: int = Field(default=0, ge=0, le=2_147_483_647)


def resolve_trusted_path(value: str, *, must_exist: bool) -> Path:
    candidate = Path(value).resolve()
    try:
        candidate.relative_to(STORAGE_ROOT)
    except ValueError as exc:
        raise WorkerFailure("CHATTERBOX_PATH_FORBIDDEN", "文件路径不在 Chatterbox 存储目录中", 403) from exc
    if must_exist and not candidate.is_file():
        raise WorkerFailure("CHATTERBOX_REFERENCE_MISSING", "参考音频不存在", 404)
    return candidate


def selected_device() -> str:
    import torch

    if DEVICE_SETTING == "cpu":
        return "cpu"
    if DEVICE_SETTING == "cuda":
        if not torch.cuda.is_available():
            raise WorkerFailure("CHATTERBOX_CUDA_UNAVAILABLE", "已要求 CUDA，但当前未检测到可用 NVIDIA GPU")
        return "cuda"
    return "cuda" if torch.cuda.is_available() else "cpu"


def split_text(text: str, limit: int = 280) -> list[str]:
    normalized = " ".join(text.strip().split())
    sentences = [part.strip() for part in re.split(r"(?<=[.!?。！？])\s*", normalized) if part.strip()]
    chunks: list[str] = []
    for sentence in sentences:
        if len(sentence) <= limit:
            chunks.append(sentence)
            continue
        words = sentence.split()
        current = ""
        for word in words:
            if len(word) > limit:
                if current:
                    chunks.append(current)
                    current = ""
                chunks.extend(word[index : index + limit] for index in range(0, len(word), limit))
            elif not current:
                current = word
            elif len(current) + 1 + len(word) <= limit:
                current = f"{current} {word}"
            else:
                chunks.append(current)
                current = word
        if current:
            chunks.append(current)
    return chunks


class ModelManager:
    def __init__(self) -> None:
        self.model: Any = None
        self.device: str | None = None
        self.lock = asyncio.Lock()

    def load(self) -> Any:
        if self.model is not None:
            return self.model
        device = selected_device()
        try:
            self.model = load_multilingual_model(device)
            self.device = device
            return self.model
        except Exception as exc:
            self.model = None
            raise WorkerFailure("CHATTERBOX_MODEL_LOAD_FAILED", f"Chatterbox V3 模型加载失败：{exc}") from exc

    def generate(self, payload: GenerateRequest) -> dict[str, Any]:
        import torch
        import torchaudio

        model = self.load()
        reference = resolve_trusted_path(payload.reference_path, must_exist=True)
        output = resolve_trusted_path(payload.output_path, must_exist=False)
        output.parent.mkdir(parents=True, exist_ok=True)
        if payload.seed:
            torch.manual_seed(payload.seed)
            random.seed(payload.seed)
            if torch.cuda.is_available():
                torch.cuda.manual_seed_all(payload.seed)

        try:
            model.prepare_conditionals(str(reference), exaggeration=payload.exaggeration)
            generated = []
            chunks = split_text(payload.text)
            for chunk in chunks:
                wav = model.generate(
                    chunk,
                    # The installed multilingual model accepts Portuguese as "pt".
                    # Brazilian pronunciation is guided by the reference recording.
                    language_id="pt" if payload.language == "pt-BR" else payload.language,
                    exaggeration=payload.exaggeration,
                    cfg_weight=payload.cfg_weight,
                    temperature=payload.temperature,
                )
                generated.append(wav.detach().cpu())
            silence = torch.zeros((1, int(model.sr * 0.18)))
            combined_parts = []
            segments = []
            cursor_samples = 0
            for index, (chunk, wav) in enumerate(zip(chunks, generated, strict=False)):
                if index:
                    combined_parts.append(silence)
                    cursor_samples += int(silence.shape[-1])
                start_samples = cursor_samples
                combined_parts.append(wav)
                cursor_samples += int(wav.shape[-1])
                segments.append(
                    {
                        "text": chunk,
                        "startSeconds": round(float(start_samples) / model.sr, 3),
                        "endSeconds": round(float(cursor_samples) / model.sr, 3),
                    }
                )
            combined = torch.cat(combined_parts, dim=-1)
            temp_output = output.with_suffix(".tmp.wav")
            torchaudio.save(str(temp_output), combined, model.sr, encoding="PCM_S", bits_per_sample=16)
            temp_output.replace(output)
            return {
                "sampleRate": model.sr,
                "samples": int(combined.shape[-1]),
                "durationSeconds": round(float(combined.shape[-1]) / model.sr, 3),
                "chunks": len(chunks),
                "segments": segments,
                "device": self.device,
                "watermarked": True,
            }
        except torch.cuda.OutOfMemoryError as exc:
            torch.cuda.empty_cache()
            raise WorkerFailure("CHATTERBOX_OUT_OF_MEMORY", "GPU 显存不足，请缩短文本后重试", 507) from exc
        except WorkerFailure:
            raise
        except Exception as exc:
            raise WorkerFailure("CHATTERBOX_GENERATION_FAILED", f"声音克隆生成失败：{exc}", 422) from exc

    def unload(self) -> None:
        if self.model is None:
            return
        self.model = None
        self.device = None
        import gc

        import torch

        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()


def load_multilingual_model(device: str) -> Any:
    """加载 V3 模型，并在 CUDA 上避免主内存中同时保留两份 2 GiB T3 权重。"""
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS

    if device != "cuda":
        # CPU/MPS 路径保留上游实现，确保非 CUDA 环境仍使用项目支持的加载行为。
        return ChatterboxMultilingualTTS.from_pretrained(device=device, t3_model="v3")

    import gc

    import torch
    from chatterbox.models.s3gen import S3Gen
    from chatterbox.models.t3 import T3
    from chatterbox.models.t3.modules.t3_config import T3Config
    from chatterbox.models.tokenizers import MTLTokenizer
    from chatterbox.models.voice_encoder import VoiceEncoder
    from chatterbox.mtl_tts import Conditionals
    from huggingface_hub import snapshot_download
    from safetensors.torch import load_file as load_safetensors

    t3_model = "t3_mtl23ls_v3.safetensors"
    checkpoint_dir = Path(
        snapshot_download(
            repo_id="ResembleAI/chatterbox",
            repo_type="model",
            revision="main",
            allow_patterns=[
                "ve.pt",
                t3_model,
                "s3gen.pt",
                "grapheme_mtl_merged_expanded_v1.json",
                "conds.pt",
                "Cangjie5_TC.json",
            ],
            token=os.getenv("HF_TOKEN"),
        )
    )

    voice_encoder = VoiceEncoder()
    voice_encoder.load_state_dict(torch.load(checkpoint_dir / "ve.pt", map_location="cpu", weights_only=True))
    voice_encoder.to(device).eval()

    # 上游实现会先在 CPU 创建完整 T3，再读取同等大小的 safetensors，再复制一次给模型。
    # 对 16 GiB 内存主机而言，这会在模型真正开始推理前触发原生访问冲突。meta 避开空参数分配，
    # safetensors 直接落到 GPU，assign 则把已加载权重绑定到模型，而非再复制一份。
    with torch.device("meta"):
        t3 = T3(T3Config.multilingual())
    t3.to_empty(device=device)
    t3_state = load_safetensors(checkpoint_dir / t3_model, device=0)
    if "model" in t3_state:
        t3_state = t3_state["model"][0]
    t3.load_state_dict(t3_state, assign=True)
    del t3_state
    gc.collect()
    t3.eval()

    # S3Gen 约 1 GiB，亦不能先完整落在 CPU；否则即使 T3 已转入显存，低内存主机仍会失败。
    with torch.device("meta"):
        s3gen = S3Gen()
    s3gen.to_empty(device=device)
    s3gen_state = torch.load(checkpoint_dir / "s3gen.pt", map_location=device, weights_only=True)
    s3gen.load_state_dict(s3gen_state, assign=True)
    del s3gen_state
    gc.collect()
    s3gen.to(device).eval()

    tokenizer = MTLTokenizer(str(checkpoint_dir / "grapheme_mtl_merged_expanded_v1.json"))
    conds = None
    if (conditionals_path := checkpoint_dir / "conds.pt").exists():
        conds = Conditionals.load(conditionals_path, map_location="cpu").to(device)

    return ChatterboxMultilingualTTS(t3, s3gen, voice_encoder, tokenizer, device, conds=conds)


manager = ModelManager()
idle_unload_task: asyncio.Task[None] | None = None
app = FastAPI(title="Chatterbox Multilingual V3 Worker", docs_url=None, redoc_url=None)


@app.exception_handler(WorkerFailure)
async def worker_failure_handler(_: Request, exc: WorkerFailure) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content={"success": False, "error": {"code": exc.code, "message": str(exc)}},
    )


@app.get("/health")
async def health() -> dict[str, Any]:
    try:
        import torch

        version = importlib.metadata.version("chatterbox-tts")
        device = selected_device()
        gpu_name = torch.cuda.get_device_name(0) if device == "cuda" else None
        return {
            "success": True,
            "data": {
                "protocolVersion": 1,
                "available": True,
                "packageVersion": version,
                "model": "multilingual-v3",
                "modelLoaded": manager.model is not None,
                "device": device,
                "gpuName": gpu_name,
                "watermarked": True,
            },
        }
    except Exception as exc:
        return {
            "success": True,
            "data": {
                "protocolVersion": 1,
                "available": False,
                "model": "multilingual-v3",
                "modelLoaded": False,
                "message": str(exc),
                "watermarked": True,
            },
        }


@app.post("/generate")
async def generate(payload: GenerateRequest) -> dict[str, Any]:
    global idle_unload_task
    if idle_unload_task and not idle_unload_task.done():
        idle_unload_task.cancel()
    async with manager.lock:
        result = await asyncio.to_thread(manager.generate, payload)
    if MODEL_IDLE_MINUTES > 0:
        idle_unload_task = asyncio.create_task(unload_after_idle())
    return {"success": True, "data": result}


async def unload_after_idle() -> None:
    try:
        await asyncio.sleep(MODEL_IDLE_MINUTES * 60)
        async with manager.lock:
            await asyncio.to_thread(manager.unload)
    except asyncio.CancelledError:
        return


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Chatterbox Multilingual V3 worker")
    parser.add_argument("--host", default=HOST)
    parser.add_argument("--port", type=int, default=PORT)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--preload", action="store_true")
    return parser.parse_args()


if __name__ == "__main__":
    arguments = parse_args()
    if arguments.check:
        import inspect

        from chatterbox.mtl_tts import ChatterboxMultilingualTTS

        if "t3_model" not in inspect.signature(ChatterboxMultilingualTTS.from_pretrained).parameters:
            raise RuntimeError("Installed chatterbox-tts build does not support Multilingual V3")
        print(
            json.dumps(
                {
                    "available": True,
                    "version": importlib.metadata.version("chatterbox-tts"),
                    "device": selected_device(),
                }
            )
        )
    elif arguments.preload:
        loaded = manager.load()
        print(json.dumps({"loaded": loaded is not None, "device": manager.device, "model": "multilingual-v3"}))
    else:
        import uvicorn

        uvicorn.run(app, host=arguments.host, port=arguments.port, log_level="warning")
