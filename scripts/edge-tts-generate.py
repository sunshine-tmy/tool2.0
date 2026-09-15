#!/usr/bin/env python3
"""Small, JSON-driven Edge-TTS adapter used by the local toolbox backend."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Any

import edge_tts

SUPPORTED_LOCALES = {"ms-MY", "en-US", "en-GB", "pt-BR"}
MAX_TEXT_LENGTH = 20_000
PROTOCOL_VERSION = 1


def emit(value: object) -> None:
    if isinstance(value, dict):
        value = {"protocolVersion": PROTOCOL_VERSION, **value}
    sys.stdout.write(json.dumps(value, ensure_ascii=False))
    sys.stdout.flush()


def read_request(file_path: str) -> dict[str, Any]:
    value = json.loads(Path(file_path).read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError("Input must be a JSON object")
    return value


def integer(value: Any, name: str, minimum: int, maximum: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < minimum or value > maximum:
        raise ValueError(f"{name} must be an integer between {minimum} and {maximum}")
    return value


def validate_request(value: dict[str, Any]) -> dict[str, Any]:
    if value.get("protocolVersion") != PROTOCOL_VERSION:
        raise ValueError("Worker protocol version mismatch")
    text = value.get("text")
    locale = value.get("language")
    voice = value.get("voice")
    if not isinstance(text, str) or not text.strip():
        raise ValueError("Text is required")
    if len(text) > MAX_TEXT_LENGTH:
        raise ValueError(f"Text exceeds {MAX_TEXT_LENGTH} characters")
    if locale not in SUPPORTED_LOCALES:
        raise ValueError("Unsupported language")
    if not isinstance(voice, str) or not voice.startswith(f"{locale}-"):
        raise ValueError("Voice does not match the selected language")
    return {
        "text": text.strip(),
        "voice": voice,
        "rate": integer(value.get("rate", 0), "rate", -50, 100),
        "volume": integer(value.get("volume", 0), "volume", -50, 50),
        "pitch": integer(value.get("pitch", 0), "pitch", -50, 50),
    }


async def list_supported_voices() -> list[dict[str, Any]]:
    voices = await edge_tts.list_voices()
    result: list[dict[str, Any]] = []
    for voice in voices:
        locale = voice.get("Locale")
        short_name = voice.get("ShortName")
        if locale not in SUPPORTED_LOCALES or not isinstance(short_name, str):
            continue
        result.append(
            {
                "name": str(voice.get("FriendlyName") or short_name),
                "shortName": short_name,
                "locale": locale,
                "gender": voice.get("Gender") if voice.get("Gender") in {"Female", "Male"} else "Neutral",
            }
        )
    return sorted(result, key=lambda item: (item["locale"], item["gender"], item["shortName"]))


async def synthesize(input_path: str, audio_path: str, subtitle_path: str | None) -> dict[str, Any]:
    request = validate_request(read_request(input_path))
    audio_target = Path(audio_path)
    subtitle_target = Path(subtitle_path) if subtitle_path else None
    audio_target.parent.mkdir(parents=True, exist_ok=True)
    if subtitle_target:
        subtitle_target.parent.mkdir(parents=True, exist_ok=True)

    last_error: Exception | None = None
    for attempt in range(3):
        audio_target.unlink(missing_ok=True)
        if subtitle_target:
            subtitle_target.unlink(missing_ok=True)
        try:
            communicator = edge_tts.Communicate(
                request["text"],
                request["voice"],
                rate=f"{request['rate']:+d}%",
                volume=f"{request['volume']:+d}%",
                pitch=f"{request['pitch']:+d}Hz",
            )
            submaker = edge_tts.SubMaker()
            audio_bytes = 0
            with audio_target.open("wb") as audio_file:
                async for chunk in communicator.stream():
                    if chunk["type"] == "audio":
                        data = chunk["data"]
                        audio_file.write(data)
                        audio_bytes += len(data)
                    elif subtitle_target and chunk["type"] in ("WordBoundary", "SentenceBoundary"):
                        submaker.feed(chunk)
            if audio_bytes <= 0:
                raise RuntimeError("The service returned no audio data")
            if subtitle_target:
                subtitle_target.write_text(submaker.get_srt(), encoding="utf-8")
            return {
                "audioBytes": audio_bytes,
                "subtitleBytes": subtitle_target.stat().st_size if subtitle_target else 0,
                "voice": request["voice"],
            }
        except Exception as error:  # The adapter reports a sanitized message to the backend.
            last_error = error
            if attempt < 2:
                await asyncio.sleep(1 if attempt == 0 else 3)

    audio_target.unlink(missing_ok=True)
    if subtitle_target:
        subtitle_target.unlink(missing_ok=True)
    raise RuntimeError(str(last_error) if last_error else "Speech generation failed")


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description="Edge-TTS toolbox adapter")
    commands = root.add_subparsers(dest="command", required=True)
    commands.add_parser("check")
    commands.add_parser("voices")
    generate = commands.add_parser("generate")
    generate.add_argument("--input", required=True)
    generate.add_argument("--audio", required=True)
    generate.add_argument("--subtitle")
    return root


async def main() -> None:
    args = parser().parse_args()
    if args.command == "check":
        emit({"available": True, "version": getattr(edge_tts, "__version__", "unknown")})
    elif args.command == "voices":
        emit({"voices": await list_supported_voices()})
    else:
        emit(await synthesize(args.input, args.audio, args.subtitle))


if __name__ == "__main__":
    try:
        # The selector policy is only available on Windows.  Resolve it
        # dynamically so Linux/macOS type checking does not require a
        # platform-specific asyncio attribute.
        windows_policy = getattr(asyncio, "WindowsSelectorEventLoopPolicy", None)
        if os.name == "nt" and windows_policy is not None:
            asyncio.set_event_loop_policy(windows_policy())
        asyncio.run(main())
    except Exception as error:
        sys.stderr.write(str(error))
        sys.stderr.flush()
        raise SystemExit(1) from error
