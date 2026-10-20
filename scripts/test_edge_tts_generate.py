# 中文模块说明：测试 scripts/test_edge_tts_generate.py 中的稳定行为、边界条件和回归场景
import importlib.util
import io
import json
import pathlib
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from types import ModuleType
from unittest.mock import AsyncMock, MagicMock, patch

SCRIPT_PATH = pathlib.Path(__file__).with_name("edge-tts-generate.py")
sys.modules.setdefault("edge_tts", ModuleType("edge_tts"))
spec = importlib.util.spec_from_file_location("edge_tts_generate", SCRIPT_PATH)
if spec is None or spec.loader is None:
    raise RuntimeError(f"Unable to load Edge-TTS adapter from {SCRIPT_PATH}")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ForbiddenResponseError(RuntimeError):
    status = 403


class EdgeTtsProtocolTest(unittest.TestCase):
    def test_forbidden_error_is_actionable_and_does_not_expose_handshake_url(self):
        error = ForbiddenResponseError("403 wss://speech.example.test/?TrustedClientToken=secret&ConnectionId=private")
        message = module.generation_error_message(error)
        self.assertIn("HTTP 403", message)
        self.assertIn("7.3.1", message)
        self.assertNotIn("wss://", message)
        self.assertNotIn("secret", message)
        self.assertNotIn("private", message)

    def test_request_requires_matching_protocol_version(self):
        request = {
            "protocolVersion": 1,
            "text": "Hello",
            "language": "en-US",
            "voice": "en-US-TestNeural",
            "rate": 0,
            "volume": 0,
            "pitch": 0,
        }
        self.assertEqual(module.validate_request(request)["text"], "Hello")
        request["protocolVersion"] = 2
        with self.assertRaisesRegex(ValueError, "protocol version mismatch"):
            module.validate_request(request)

    def test_every_json_response_declares_protocol_version(self):
        output = io.StringIO()
        with redirect_stdout(output):
            module.emit({"available": True})
        self.assertEqual(json.loads(output.getvalue()), {"protocolVersion": 1, "available": True})


class EdgeTtsGenerationFailureTest(unittest.IsolatedAsyncioTestCase):
    async def test_forbidden_retries_are_bounded_and_partial_files_are_removed(self):
        error = ForbiddenResponseError("403 wss://example.test/?TrustedClientToken=secret")

        async def stream():
            yield {"type": "audio", "data": b"partial"}
            raise error

        communicator = MagicMock()
        communicator.stream = stream
        with tempfile.TemporaryDirectory() as directory:
            audio = pathlib.Path(directory) / "test.mp3"
            subtitle = pathlib.Path(directory) / "test.srt"
            request = {"protocolVersion": 1, "text": "Hello", "language": "en-US", "voice": "en-US-TestNeural"}
            with (
                patch.object(module, "read_request", return_value=request),
                patch.object(module.edge_tts, "Communicate", return_value=communicator, create=True) as communicate,
                patch.object(module.edge_tts, "SubMaker", create=True),
                patch.object(module.asyncio, "sleep", new_callable=AsyncMock) as sleep,
            ):
                with self.assertRaisesRegex(RuntimeError, "HTTP 403"):
                    await module.synthesize("request.json", str(audio), str(subtitle))
                self.assertEqual(communicate.call_count, 3)
                self.assertEqual(sleep.await_count, 2)
            self.assertFalse(audio.exists())
            self.assertFalse(subtitle.exists())


if __name__ == "__main__":
    unittest.main()
