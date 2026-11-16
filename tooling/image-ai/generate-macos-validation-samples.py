"""Generate deterministic, synthetic inputs for the M01-02 model probe."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    return ImageFont.load_default(size=size)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def generate_samples(assets_directory: Path) -> dict[str, object]:
    samples = assets_directory / "samples"
    samples.mkdir(parents=True, exist_ok=False)

    product = Image.new("RGB", (512, 512), "#e9edf0")
    draw = ImageDraw.Draw(product)
    draw.rectangle((0, 380, 512, 511), fill="#d9dedf")
    draw.ellipse((105, 390, 405, 455), fill="#bbc2c4")
    draw.polygon([(167, 118), (345, 118), (374, 411), (138, 411)], fill="#c65332")
    draw.polygon([(167, 118), (345, 118), (333, 157), (178, 157)], fill="#913c29")
    draw.line((178, 159, 334, 159), fill="#e88e68", width=5)
    draw.rounded_rectangle((174, 224, 338, 352), radius=10, fill="#f6f0df", outline="#5d4034", width=3)
    draw.text((198, 247), "COFFEE", font=font(31), fill="#35261f")
    draw.text((216, 293), "128", font=font(30), fill="#35261f")
    draw.ellipse((226, 330, 242, 346), fill="#4c7650")
    draw.ellipse((249, 330, 265, 346), fill="#4c7650")
    product_path = samples / "product.png"
    product.save(product_path, format="PNG", optimize=False)

    ocr = Image.new("RGB", (960, 400), "white")
    ocr_draw = ImageDraw.Draw(ocr)
    ocr_draw.rounded_rectangle((48, 58, 912, 342), radius=18, fill="#f4f5f7", outline="#59616a", width=3)
    ocr_draw.text((104, 116), "SALE 128", font=font(92), fill="#101820")
    ocr_draw.text((108, 247), "COFFEE", font=font(58), fill="#263746")
    ocr_path = samples / "ocr.png"
    ocr.save(ocr_path, format="PNG", optimize=False)

    mask = Image.new("L", (512, 512), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle((166, 239, 345, 324), radius=4, fill=255)
    mask_path = samples / "repair-mask.png"
    mask.save(mask_path, format="PNG", optimize=False)

    return {
        "schemaVersion": 1,
        "generator": "tooling/image-ai/generate-macos-validation-samples.py",
        "font": "Pillow built-in default TrueType font",
        "samples": [
            {"path": str(path.relative_to(assets_directory)), "bytes": path.stat().st_size, "sha256": sha256(path)}
            for path in (product_path, ocr_path, mask_path)
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--assets-dir", required=True, type=Path)
    arguments = parser.parse_args()
    root = arguments.assets_dir.resolve(strict=True)
    if not root.is_dir():
        raise RuntimeError("assets directory must be a directory")
    result = generate_samples(root)
    print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"{type(error).__name__}: {error}")
        raise SystemExit(1)
