"""Read-only source and media-contract checks for the opt-in S04 CLI, without CUDA."""

import importlib.util
import subprocess
import sys
import tempfile
import unittest
from copy import deepcopy
from pathlib import Path

ENTRY = Path(__file__).with_name("validate-video-ai-sttn.py")
SPEC = importlib.util.spec_from_file_location("sttn_validation", ENTRY)
assert SPEC and SPEC.loader
probe = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(probe)


def streams(audio=True):
    result = [
        {
            "codec_type": "video",
            "width": 576,
            "height": 1024,
            "nb_frames": "872",
            "avg_frame_rate": "30/1",
            "duration": "29.066667",
        }
    ]
    if audio:
        result.append({"codec_type": "audio", "codec_name": "aac", "duration": "29.070998"})
    return result


class SttnValidationTests(unittest.TestCase):
    def test_media_contract_accepts_original_rate_size_frames_and_small_audio_difference(self):
        source = streams()
        result = probe.verify_media(source, deepcopy(source))
        self.assertEqual(result["frames"], 872)
        self.assertLess(result["audioVideoDurationDifference"], 1 / 30)
        self.assertEqual(probe.verify_media(streams(False), streams(False))["audioCodec"], None)

    def test_media_contract_rejects_frame_size_rate_and_audio_regressions(self):
        for field, value in (("width", 288), ("nb_frames", "871"), ("avg_frame_rate", "25/1")):
            with self.subTest(field=field):
                output = streams()
                output[0][field] = value
                with self.assertRaisesRegex(AssertionError, "contract"):
                    probe.verify_media(streams(), output)
        for output in (streams(False), [*streams(False), {"codec_type": "audio", "duration": "29.2"}]):
            with self.assertRaisesRegex(AssertionError, "contract"):
                probe.verify_media(streams(), output)
        with self.assertRaisesRegex(AssertionError, "contract"):
            probe.verify_media(streams(False), streams())

    def test_manual_area_must_be_inside_original_pixels(self):
        probe.validate_area((24, 730, 528, 72), 576, 1024)
        for area in ((-1, 0, 20, 20), (0, -1, 20, 20), (0, 0, 0, 20), (0, 0, 577, 20), (0, 1000, 20, 25)):
            with self.subTest(area=area), self.assertRaisesRegex(ValueError, "original video"):
                probe.validate_area(area, 576, 1024)

    def test_digest_is_read_only_and_handles_multiple_chunks(self):
        import hashlib

        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory) / "original.mp4"
            content = b"source" * 400_000
            file.write_bytes(content)
            self.assertEqual(probe.file_digest(file), hashlib.sha256(content).hexdigest())
            self.assertEqual(file.read_bytes(), content)

    def test_invalid_real_input_and_existing_output_fail_before_loading_models(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source.mp4"
            source.write_bytes(b"preserve original")
            output = root / "saved-evidence"
            output.mkdir()
            (output / "report.json").write_text("keep", encoding="utf-8")
            executable = Path(sys.executable)
            common = [
                str(executable),
                "-I",
                "-B",
                str(ENTRY),
                "--engine-root",
                str(root),
                "--output",
                str(output),
                "--ffmpeg",
                str(executable),
                "--ffprobe",
                str(executable),
                "--lama-model",
                str(source),
            ]
            for extra in (
                ["--input-video", str(source)],
                ["--manual-area", "0", "0", "1", "1"],
                ["--input-video", str(root / "missing.mp4"), "--manual-area", "0", "0", "1", "1"],
                ["--input-video", str(source), "--manual-area", "0", "0", "1", "1"],
            ):
                result = subprocess.run([*common, *extra], capture_output=True, timeout=20)
                self.assertNotEqual(result.returncode, 0)
            self.assertEqual(source.read_bytes(), b"preserve original")
            self.assertEqual((output / "report.json").read_text(encoding="utf-8"), "keep")


if __name__ == "__main__":
    unittest.main()
