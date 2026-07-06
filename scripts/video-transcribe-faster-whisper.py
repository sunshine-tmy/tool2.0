import argparse
from pathlib import Path

from faster_whisper import WhisperModel


def format_timestamp(seconds: float) -> str:
    safe = max(0.0, seconds)
    hours = int(safe // 3600)
    minutes = int((safe % 3600) // 60)
    whole_seconds = int(safe % 60)
    milliseconds = int(round((safe - int(safe)) * 1000))
    return f"{hours:02d}:{minutes:02d}:{whole_seconds:02d},{milliseconds:03d}"


def main() -> None:
    parser = argparse.ArgumentParser(description="Transcribe audio with faster-whisper and write SRT text.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--model", default="base")
    parser.add_argument("--language", default="")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--compute-type", default="int8")
    args = parser.parse_args()

    model = WhisperModel(args.model, device=args.device, compute_type=args.compute_type)
    language = args.language if args.language else None
    segments, _info = model.transcribe(args.input, language=language, vad_filter=True)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as output:
        for index, segment in enumerate(segments, start=1):
            text = segment.text.strip()
            if not text:
                continue
            output.write(f"{index}\n")
            output.write(f"{format_timestamp(segment.start)} --> {format_timestamp(segment.end)}\n")
            output.write(f"{text}\n\n")


if __name__ == "__main__":
    main()
