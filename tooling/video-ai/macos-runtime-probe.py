"""Offline Python 3.12 arm64 runtime probe for the macOS validation harness."""

from __future__ import annotations

import argparse
import json
import os
import platform
import sqlite3
import ssl
import subprocess
import sys
import tempfile
import venv
from pathlib import Path


def interpreter_path(environment: Path) -> Path:
    if sys.platform == "win32":
        return environment / "Scripts" / "python.exe"
    return environment / "bin" / "python"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--assets-dir", type=Path)
    parser.add_argument("--case", required=True, choices=["M01-01-python-runtime"])
    arguments = parser.parse_args()

    if sys.version_info[:2] != (3, 12):
        raise RuntimeError(f"Python 3.12 is required; detected {sys.version_info.major}.{sys.version_info.minor}")
    if sys.platform != "darwin" or platform.machine() != "arm64":
        raise RuntimeError(f"native macOS arm64 Python is required; detected {sys.platform}-{platform.machine()}")

    connection = sqlite3.connect(":memory:")
    connection.execute("create table probe (value integer not null)")
    connection.execute("insert into probe values (1)")
    if connection.execute("select value from probe").fetchone() != (1,):
        raise RuntimeError("SQLite in-memory round trip failed")
    connection.close()

    output_directory = arguments.output_dir.resolve(strict=True)
    if not output_directory.is_dir():
        raise RuntimeError("output directory is not a directory")

    with tempfile.TemporaryDirectory(prefix=".python-runtime-probe-", dir=output_directory) as temporary:
        environment = Path(temporary) / "venv"
        venv.EnvBuilder(with_pip=False, clear=True).create(environment)
        child_python = interpreter_path(environment)
        child_source = (
            "import json,platform,sqlite3,ssl,sys;"
            "print(json.dumps({'version':'.'.join(map(str,sys.version_info[:3])),'machine':platform.machine(),"
            "'sqlite':sqlite3.sqlite_version,'openssl':ssl.OPENSSL_VERSION}))"
        )
        child = subprocess.run(
            [str(child_python), "-I", "-c", child_source],
            check=False,
            capture_output=True,
            text=True,
            timeout=30,
            env={
                "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
                "HOME": str(output_directory / "home"),
                "TMPDIR": str(output_directory / "temp"),
                "PYTHONNOUSERSITE": "1",
                "PYTHONDONTWRITEBYTECODE": "1",
            },
        )
        if child.returncode != 0:
            raise RuntimeError(f"venv interpreter failed: {child.stderr[-4000:]}")
        isolated = json.loads(child.stdout)
        if isolated.get("machine") != "arm64" or not isolated.get("version", "").startswith("3.12."):
            raise RuntimeError(f"venv interpreter mismatch: {isolated}")

    result = {
        "caseId": arguments.case,
        "status": "pass",
        "modelValidation": "not_run",
        "python": ".".join(map(str, sys.version_info[:3])),
        "machine": platform.machine(),
        "ssl": ssl.OPENSSL_VERSION,
        "sqlite": sqlite3.sqlite_version,
        "sqliteRoundTrip": True,
        "venvInterpreter": isolated,
        "dependenciesInstalled": False,
        "networkUsed": False,
    }
    output_path = output_directory / "probe-result.json"
    output_path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:  # Printed to the harness's bounded stderr capture.
        print(f"{type(error).__name__}: {error}", file=sys.stderr)
        raise SystemExit(1)
