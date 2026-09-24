# 中文模块说明：工程与 Worker 脚本，负责 本地 AI/翻译/配音 Worker 协议和进程服务
"""Audit each Worker lock independently and enforce the reviewed exception set."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUDITS = [
    ("edge-tts.lock.txt", []),
    ("video-transcribe.lock.txt", []),
    ("chatterbox.lock.txt", []),
    # BasicSR has no fixed PyPI release. Its medium-severity issue requires a
    # locally attacker-controlled SLURM_NODELIST; image-ai-worker.py deletes
    # that variable immediately before importing BasicSR.
    ("image-ai.lock.txt", ["PYSEC-2026-1215"]),
]
PYTORCH_EXCEPTIONS = [
    # Chatterbox V3 and the pinned CPU workers require Torch 2.6.
    # The worker is loopback-only, never enables distributed/training APIs, and
    # loads only administrator-installed model files. Keep this explicit list so
    # any newly published advisory still fails CI.
    "PYSEC-2025-189",
    "PYSEC-2025-190",
    "PYSEC-2025-191",
    "PYSEC-2025-192",
    "PYSEC-2025-193",
    "PYSEC-2025-194",
    "PYSEC-2025-195",
    "PYSEC-2025-198",
    "PYSEC-2025-199",
    "PYSEC-2025-200",
    "PYSEC-2025-201",
    "PYSEC-2025-202",
    "PYSEC-2025-203",
    "PYSEC-2025-204",
    "PYSEC-2025-205",
    "PYSEC-2025-206",
    "PYSEC-2025-207",
    "PYSEC-2025-208",
    "PYSEC-2025-209",
    "PYSEC-2026-139",
    "PYSEC-2026-1970",
    "PYSEC-2026-2286",
]


def run_audit(requirement: Path, ignored: list[str], *, no_deps: bool = False) -> int:
    command = [sys.executable, "-m", "pip_audit", "--disable-pip", "-r", str(requirement)]
    if no_deps:
        command.append("--no-deps")
    for vulnerability in ignored:
        command.extend(["--ignore-vuln", vulnerability])
    print(f"Auditing {requirement.name}...", flush=True)
    return subprocess.run(command, cwd=ROOT, check=False).returncode


def main() -> int:
    failed = False
    for filename, ignored in AUDITS:
        failed = run_audit(ROOT / "scripts" / filename, ignored) != 0 or failed
    failed = (
        run_audit(
            ROOT / "scripts" / "pytorch-audit-requirements.txt",
            PYTORCH_EXCEPTIONS,
            no_deps=True,
        )
        != 0
        or failed
    )
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
