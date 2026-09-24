# 中文模块说明：测试 scripts/test_video_transcribe_faster_whisper.py 中的稳定行为、边界条件和回归场景
import importlib.util
import pathlib
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

SCRIPT_PATH = pathlib.Path(__file__).with_name("video-transcribe-faster-whisper.py")
spec = importlib.util.spec_from_file_location("video_transcribe_faster_whisper", SCRIPT_PATH)
if spec is None or spec.loader is None:
    raise RuntimeError(f"Unable to load transcriber module from {SCRIPT_PATH}")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class FasterWhisperScriptTest(unittest.TestCase):
    def test_defaults_target_local_gpu_accuracy(self):
        args = module.parse_args(["--input", "input.wav", "--output", "output.srt"])

        self.assertEqual(args.model, "large-v3-turbo")
        self.assertEqual(args.fallback_models, "medium,small,base")
        self.assertEqual(args.language, "zh")
        self.assertEqual(args.device, "cuda")
        self.assertEqual(args.compute_type, "int8_float16")
        self.assertEqual(args.beam_size, 5)

    def test_local_desktop_model_does_not_add_downloadable_fallback_ids(self):
        with tempfile.TemporaryDirectory(prefix="whisper-model-") as directory:
            args = module.parse_args(
                [
                    "--input",
                    "input.wav",
                    "--output",
                    "output.srt",
                    "--model",
                    directory,
                    "--fallback-models",
                    "small,base",
                    "--device",
                    "cpu",
                    "--compute-type",
                    "int8",
                ]
            )

            self.assertEqual(module.model_candidates(args), [(directory, "cpu", "int8")])

    def test_metadata_path_defaults_to_output_sidecar(self):
        args = module.parse_args(["--input", "input.wav", "--output", "output.srt"])

        self.assertEqual(module.metadata_path_for(args), pathlib.Path("output.srt.meta.json"))

    def test_create_model_downgrades_model_when_large_cuda_and_cpu_fail(self):
        args = module.parse_args(["--input", "input.wav", "--output", "output.srt"])
        medium_model = object()

        with patch.object(
            module,
            "WhisperModel",
            side_effect=[
                RuntimeError("large cuda unavailable"),
                RuntimeError("medium cuda unavailable"),
                RuntimeError("small cuda unavailable"),
                RuntimeError("base cuda unavailable"),
                RuntimeError("large cpu unavailable"),
                medium_model,
            ],
        ) as model:
            created_model, used_model, used_device, used_compute_type = module.create_model(args)

        self.assertIs(created_model, medium_model)
        self.assertEqual(used_model, "medium")
        self.assertEqual(used_device, "cpu")
        self.assertEqual(used_compute_type, "int8")
        self.assertEqual(model.call_args_list[0].args[0], "large-v3-turbo")
        self.assertEqual(model.call_args_list[1].args[0], "medium")
        self.assertEqual(model.call_args_list[4].args[0], "large-v3-turbo")
        self.assertEqual(model.call_args_list[5].args[0], "medium")
        self.assertEqual(model.call_args_list[5].kwargs, {"device": "cpu", "compute_type": "int8"})

    def test_transcribe_skips_remaining_cuda_candidates_when_cublas_is_missing(self):
        args = module.parse_args(["--input", "input.wav", "--output", "output.srt"])
        info = SimpleNamespace(language="zh", language_probability=0.99)

        def cublas_failure_segments():
            raise RuntimeError("Library cublas64_12.dll is not found or cannot be loaded")
            yield

        class FakeModel:
            def __init__(self, segments, info):
                self.segments = segments
                self.info = info

            def transcribe(self, *args, **kwargs):
                return self.segments, self.info

        large_cuda_model = FakeModel(cublas_failure_segments(), info)
        medium_cpu_model = FakeModel(
            [SimpleNamespace(start=0.0, end=1.0, text="CPU 降级成功", avg_logprob=-0.2, no_speech_prob=0.01)],
            info,
        )

        with patch.object(
            module,
            "WhisperModel",
            side_effect=[
                large_cuda_model,
                RuntimeError("large cpu unavailable"),
                medium_cpu_model,
            ],
        ) as model:
            segments, info, used_model, used_device, used_compute_type = module.transcribe_with_fallback(args)

        self.assertEqual(segments[0].text, "CPU 降级成功")
        self.assertEqual(used_model, "medium")
        self.assertEqual(used_device, "cpu")
        self.assertEqual(used_compute_type, "int8")
        self.assertEqual(
            [(call.args[0], call.kwargs["device"]) for call in model.call_args_list],
            [
                ("large-v3-turbo", "cuda"),
                ("large-v3-turbo", "cpu"),
                ("medium", "cpu"),
            ],
        )

    def test_build_metadata_marks_low_confidence_segments(self):
        info = SimpleNamespace(language="zh", language_probability=0.99)
        segments = [
            SimpleNamespace(id=1, start=0.0, end=1.5, text="清晰片段", avg_logprob=-0.2, no_speech_prob=0.01),
            SimpleNamespace(id=2, start=1.5, end=3.0, text="需要复核", avg_logprob=-0.95, no_speech_prob=0.01),
        ]
        args = module.parse_args(["--input", "input.wav", "--output", "output.srt"])

        metadata = module.build_metadata(args, info, segments, used_model="medium")

        self.assertEqual(metadata["requestedModel"], "large-v3-turbo")
        self.assertEqual(metadata["model"], "medium")
        self.assertEqual(metadata["language"], "zh")
        self.assertAlmostEqual(metadata["averageLogProbability"], -0.575)
        self.assertEqual(metadata["lowConfidenceSegments"][0]["text"], "需要复核")


if __name__ == "__main__":
    unittest.main()
