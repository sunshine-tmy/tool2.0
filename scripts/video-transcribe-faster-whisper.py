# 中文模块说明：工程与 Worker 脚本，负责 开发、清理、构建或发布自动化
import argparse
import gc
import json
from pathlib import Path
from typing import Any

# The transcriber dependency is installed in its own Worker environment. Keep
# importing this protocol adapter possible in the lightweight CI environment so
# unit tests can exercise argument parsing and fallback logic without pulling in
# the full model runtime.
WhisperModel: Any = None

LOW_CONFIDENCE_LOG_PROBABILITY = -0.75


def format_timestamp(seconds: float) -> str:
    safe = max(0.0, seconds)
    hours = int(safe // 3600)
    minutes = int((safe % 3600) // 60)
    whole_seconds = int(safe % 60)
    milliseconds = int(round((safe - int(safe)) * 1000))
    return f"{hours:02d}:{minutes:02d}:{whole_seconds:02d},{milliseconds:03d}"


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Transcribe audio with faster-whisper and write SRT text.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--metadata-output", default="")
    parser.add_argument("--model", default="large-v3-turbo")
    parser.add_argument("--language", default="zh")
    parser.add_argument("--device", default="cuda")
    parser.add_argument("--compute-type", default="int8_float16")
    parser.add_argument("--fallback-models", default="medium,small,base")
    parser.add_argument("--beam-size", type=int, default=5)
    parser.add_argument("--best-of", type=int, default=5)
    parser.add_argument("--temperature", default="0")
    parser.add_argument("--low-confidence-log-probability", type=float, default=LOW_CONFIDENCE_LOG_PROBABILITY)
    return parser.parse_args(argv)


def metadata_path_for(args: argparse.Namespace) -> Path:
    if args.metadata_output:
        return Path(args.metadata_output)
    return Path(f"{args.output}.meta.json")


def parse_temperatures(value: str) -> list[float]:
    return [float(item.strip()) for item in value.split(",") if item.strip()]


def parse_fallback_models(value: str) -> list[str]:
    return [model.strip() for model in value.split(",") if model.strip()]


def unique_models(models: list[str]) -> list[str]:
    unique: list[str] = []
    for model in models:
        if model not in unique:
            unique.append(model)
    return unique


def whisper_model_class() -> Any:
    global WhisperModel
    if WhisperModel is None:
        try:
            from faster_whisper import WhisperModel as implementation
        except ModuleNotFoundError as error:
            raise RuntimeError("faster-whisper is not installed in this Worker environment") from error
        WhisperModel = implementation
    return WhisperModel


def model_candidates(args: argparse.Namespace) -> list[tuple[str, str, str]]:
    # A signed desktop package supplies a local model directory. Do not retry
    # public model identifiers in this mode: faster-whisper would download them.
    models = (
        [args.model]
        if Path(args.model).is_dir()
        else unique_models([args.model, *parse_fallback_models(args.fallback_models)])
    )
    candidates = [(model, args.device, args.compute_type) for model in models]
    if args.device != "cpu":
        candidates.extend((model, "cpu", "int8") for model in models)
    return candidates


def create_model(args: argparse.Namespace) -> tuple[Any, str, str, str]:
    errors: list[str] = []
    for model_name, device, compute_type in model_candidates(args):
        try:
            model = whisper_model_class()(model_name, device=device, compute_type=compute_type)
            return model, model_name, device, compute_type
        except Exception as error:
            errors.append(f"{model_name}/{device}/{compute_type}: {error}")
            gc.collect()

    raise RuntimeError("Unable to load any faster-whisper model. Tried " + " | ".join(errors))


def is_cuda_runtime_error(error: Exception) -> bool:
    message = str(error).lower()
    return any(token in message for token in ("cublas", "cudnn", "cuda"))


def transcribe_with_fallback(args: argparse.Namespace) -> tuple[list, object, str, str, str]:
    language = args.language if args.language else None
    errors: list[str] = []
    skipped_devices: set[str] = set()

    for model_name, device, compute_type in model_candidates(args):
        if device in skipped_devices:
            continue
        try:
            model = whisper_model_class()(model_name, device=device, compute_type=compute_type)
            segments, info = model.transcribe(
                args.input,
                language=language,
                vad_filter=True,
                beam_size=args.beam_size,
                best_of=args.best_of,
                temperature=parse_temperatures(args.temperature),
                condition_on_previous_text=True,
            )
            return list(segments), info, model_name, device, compute_type
        except Exception as error:
            errors.append(f"{model_name}/{device}/{compute_type}: {error}")
            if device == "cuda" and is_cuda_runtime_error(error):
                skipped_devices.add("cuda")
            gc.collect()

    raise RuntimeError("Unable to transcribe with any faster-whisper model. Tried " + " | ".join(errors))


def average(values: list[float]) -> float | None:
    if not values:
        return None
    return round(sum(values) / len(values), 4)


def number_or_none(value: object) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    return None


def build_metadata(
    args: argparse.Namespace,
    info: object,
    segments: list,
    used_model: str | None = None,
    used_device: str | None = None,
    used_compute_type: str | None = None,
) -> dict:
    avg_log_probs = [
        value
        for value in (number_or_none(getattr(segment, "avg_logprob", None)) for segment in segments)
        if value is not None
    ]
    low_confidence_segments = []
    for index, segment in enumerate(segments, start=1):
        avg_logprob = number_or_none(getattr(segment, "avg_logprob", None))
        if avg_logprob is None or avg_logprob > args.low_confidence_log_probability:
            continue
        low_confidence_segments.append(
            {
                "index": index,
                "startSeconds": number_or_none(getattr(segment, "start", None)),
                "endSeconds": number_or_none(getattr(segment, "end", None)),
                "text": getattr(segment, "text", "").strip(),
                "averageLogProbability": round(avg_logprob, 4),
                "noSpeechProbability": number_or_none(getattr(segment, "no_speech_prob", None)),
            }
        )

    return {
        "requestedModel": args.model,
        "model": used_model or args.model,
        "language": args.language or None,
        "detectedLanguage": getattr(info, "language", None),
        "languageProbability": number_or_none(getattr(info, "language_probability", None)),
        "device": used_device or args.device,
        "computeType": used_compute_type or args.compute_type,
        "averageLogProbability": average(avg_log_probs),
        "lowConfidenceSegments": low_confidence_segments,
    }


def write_transcript(output_path: Path, segments: list) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as output:
        for index, segment in enumerate(segments, start=1):
            text = segment.text.strip()
            if not text:
                continue
            output.write(f"{index}\n")
            output.write(f"{format_timestamp(segment.start)} --> {format_timestamp(segment.end)}\n")
            output.write(f"{text}\n\n")


def write_metadata(metadata_path: Path, metadata: dict) -> None:
    metadata_path.parent.mkdir(parents=True, exist_ok=True)
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    args = parse_args()

    segments, info, used_model, used_device, used_compute_type = transcribe_with_fallback(args)

    output_path = Path(args.output)
    write_transcript(output_path, segments)
    write_metadata(
        metadata_path_for(args), build_metadata(args, info, segments, used_model, used_device, used_compute_type)
    )


if __name__ == "__main__":
    main()
