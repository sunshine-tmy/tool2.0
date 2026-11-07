#!/usr/bin/env python3
"""Application-owned compatibility entry for verified video workers.

Keep installed/signed worker bytes intact. Progress-file replacement gains
bounded retries for Windows sharing/access conflicts; new signed sequence helpers
are imported from source, never a stale bytecode cache. Processing, authentication,
path validation and final output publication still belong to the original worker.
"""

from __future__ import annotations

import importlib.abc
import importlib.machinery
import importlib.util
import os
import sys
import time
from pathlib import Path
from types import ModuleType
from typing import Protocol

PROGRESS_RETRY_DELAYS = (0.02, 0.05, 0.1, 0.2, 0.4)
SEQUENCE_HELPERS = frozenset({"video_ai_sequence", "video_ai_engine_assets", "video_ai_sttn", "video_ai_propainter"})


class SourceHelperLoader(importlib.machinery.SourceFileLoader):
    def get_code(self, fullname: str):
        return compile(Path(self.path).read_bytes(), self.path, "exec", dont_inherit=True)


class SequenceHelperFinder(importlib.abc.MetaPathFinder):
    def __init__(self, directory: Path) -> None:
        self.directory = directory

    def find_spec(self, fullname, path=None, target=None):
        if fullname not in SEQUENCE_HELPERS:
            return None
        source = self.directory / f"{fullname}.py"
        if not source.is_file():
            raise ModuleNotFoundError(f"Signed video Worker helper is missing: {fullname}")
        return importlib.util.spec_from_file_location(
            fullname, source, loader=SourceHelperLoader(fullname, str(source))
        )


class ProgressReporterState(Protocol):
    progress_path: Path | None


def install_progress_retry(worker: ModuleType) -> None:
    original = worker.ProgressReporter
    if getattr(original, "_toolbox_progress_retry", False):
        return

    def update(reporter: ProgressReporterState, stage: str, processed: int, *, force: bool = False) -> None:
        for attempt in range(len(PROGRESS_RETRY_DELAYS) + 1):
            try:
                # The original writer advances its throttle before replace().
                # Retrying without force would silently skip the failed write.
                original.update(reporter, stage, processed, force=force or attempt > 0)
                return
            except PermissionError as error:
                if not is_progress_replace_conflict(error, reporter.progress_path):
                    raise
                if attempt == len(PROGRESS_RETRY_DELAYS):
                    raise
                time.sleep(PROGRESS_RETRY_DELAYS[attempt])

    # The base class comes from a dynamically loaded, verified Worker module.
    # Scope the override to that module, never to pathlib or filesystem functions.
    patched = type("RetryingProgressReporter", (original,), {"update": update, "_toolbox_progress_retry": True})
    worker.__dict__["ProgressReporter"] = patched


def is_progress_replace_conflict(error: PermissionError, progress_path: Path | None) -> bool:
    if progress_path is None or getattr(error, "winerror", None) not in {5, 32, 33}:
        return False
    # Do not retry unrelated permission failures (input, models, output or even
    # creation of progress.tmp). Both paths must identify this exact replacement.
    if error.filename is None or error.filename2 is None:
        return False
    return os.path.normcase(os.fspath(error.filename)) == os.path.normcase(
        str(progress_path.with_suffix(".tmp"))
    ) and os.path.normcase(os.fspath(error.filename2)) == os.path.normcase(str(progress_path))


def load_worker(worker_path: Path) -> ModuleType:
    spec = importlib.util.spec_from_file_location("toolbox_video_ai_worker", worker_path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Video worker entry cannot be loaded")
    worker = importlib.util.module_from_spec(spec)
    # Dataclasses and package-local helpers require the original module identity
    # and directory; ROOT remains anchored to the verified worker, not this launcher.
    sys.modules[spec.name] = worker
    sys.path.insert(0, str(worker_path.parent))
    sys.meta_path.insert(0, SequenceHelperFinder(worker_path.parent))
    # Execute the verified source directly: no cached bytecode can replace it,
    # and importing must not write __pycache__ into an installed generation.
    exec(compile(worker_path.read_bytes(), str(worker_path), "exec"), worker.__dict__)
    install_progress_retry(worker)
    return worker


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("Usage: video-ai-worker-launcher.py <verified-worker.py> [worker arguments]")
    worker_path = Path(sys.argv[1]).resolve(strict=True)
    sys.argv = [str(worker_path), *sys.argv[2:]]
    load_worker(worker_path).main()


if __name__ == "__main__":
    main()
