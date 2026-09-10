"""Local-only adapter for the pinned XHS-Downloader source tree."""

import asyncio
import os
import sys
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn

source_dir = Path(os.environ["XHS_SOURCE_DIR"]).resolve()
sys.path.insert(0, str(source_dir))

from source import XHS  # noqa: E402


class ExtractRequest(BaseModel):
    url: str
    cookie: str = ""


app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
lock = asyncio.Lock()


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/extract")
async def extract(payload: ExtractRequest):
    async with lock:
        try:
            async with XHS(
                cookie=payload.cookie,
                record_data=False,
                download_record=False,
                live_download=True,
            ) as client:
                result = await client.extract(payload.url, download=False, data=True)
            return {"success": True, "items": result}
        except Exception as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("XHS_PROVIDER_PORT", "5556")), log_level="warning")
