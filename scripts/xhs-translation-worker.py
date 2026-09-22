# 中文模块说明：工程与 Worker 脚本，负责 本地 AI/翻译/配音 Worker 协议和进程服务
from __future__ import annotations

import asyncio
import hmac
import os
from pathlib import Path

import ctranslate2
import sentencepiece as spm
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

MODEL_DIR = Path(os.environ.get("XHS_TRANSLATION_MODEL_DIR", ".runtime/xhs-translate/model"))
PORT = int(os.environ.get("XHS_TRANSLATION_PORT", "5557"))
app = FastAPI(title="xhs-translation-worker")
WORKER_TOKEN = os.environ.get("XHS_TRANSLATION_TOKEN", "")
translator: ctranslate2.Translator | None = None
source_processor: spm.SentencePieceProcessor | None = None
target_processor: spm.SentencePieceProcessor | None = None
lock = asyncio.Lock()


@app.middleware("http")
async def require_worker_token(request: Request, call_next):
    if WORKER_TOKEN and not hmac.compare_digest(request.headers.get("x-toolbox-worker-token", ""), WORKER_TOKEN):
        return JSONResponse(
            status_code=401,
            content={"success": False, "error": {"code": "WORKER_AUTH_REQUIRED", "message": "Worker authentication required"}},
        )
    return await call_next(request)


class TranslateRequest(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=64)


class TranslateResponse(BaseModel):
    translations: list[str]


def model_ready() -> bool:
    return translator is not None and source_processor is not None and target_processor is not None


def load_model() -> None:
    global translator, source_processor, target_processor
    if model_ready():
        return
    model_file = MODEL_DIR / "model.bin"
    source_file = MODEL_DIR / "source.spm"
    target_file = MODEL_DIR / "target.spm"
    if not model_file.exists() or not source_file.exists() or not target_file.exists():
        raise RuntimeError("翻译模型文件不完整")
    # Build every component locally and publish them together. A failed first
    # load must not leave the process in a half-initialized state where health
    # reports success but translation keeps failing.
    # SentencePiece's Windows file loader cannot reliably open paths containing
    # CJK characters. Loading the model bytes keeps projects such as
    # F:\\git仓库内容\\... fully supported without relocating user data.
    loaded_source_processor = spm.SentencePieceProcessor(model_proto=source_file.read_bytes())
    loaded_target_processor = spm.SentencePieceProcessor(model_proto=target_file.read_bytes())
    loaded_translator = ctranslate2.Translator(str(MODEL_DIR), device="cpu", compute_type="int8")
    source_processor = loaded_source_processor
    target_processor = loaded_target_processor
    translator = loaded_translator


@app.get("/health")
async def health() -> dict[str, object]:
    return {"ok": True, "loaded": model_ready()}


@app.post("/translate", response_model=TranslateResponse)
async def translate(request: TranslateRequest) -> TranslateResponse:
    if any(len(text) > 350 for text in request.texts):
        raise HTTPException(status_code=413, detail="单段文本不得超过350个字符")
    async with lock:
        try:
            load_model()
            current_translator = translator
            current_source_processor = source_processor
            current_target_processor = target_processor
            if current_translator is None or current_source_processor is None or current_target_processor is None:
                raise RuntimeError("翻译模型初始化状态不完整")
            # Marian models are trained with an explicit source end token. The
            # Hugging Face tokenizer adds it automatically, while raw
            # SentencePiece encoding does not. Omitting it can make decoding
            # repeat short phrases until max_decoding_length is reached.
            tokenized = [[*current_source_processor.encode(text, out_type=str), "</s>"] for text in request.texts]
            results = current_translator.translate_batch(tokenized, beam_size=4, max_decoding_length=512)
            translations = [current_target_processor.decode(result.hypotheses[0]) for result in results]
            if len(translations) != len(request.texts):
                raise RuntimeError("翻译结果数量不一致")
            return TranslateResponse(translations=translations)
        except HTTPException:
            raise
        except Exception as error:
            raise HTTPException(status_code=500, detail=f"翻译失败：{type(error).__name__}") from error


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="warning")
