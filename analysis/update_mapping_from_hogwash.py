#!/usr/bin/env -S uv run --python 3.12 python
"""Backward-compatible wrapper for mapping updates.

This command now delegates to `analysis/generate_mapping_module.py` and updates only:
- src/generated/secret-mapping.ts

Usage remains compatible:
  uv run --python 3.12 python analysis/update_mapping_from_hogwash.py --latest
  uv run --python 3.12 python analysis/update_mapping_from_hogwash.py --tag v0.1.4
  uv run --python 3.12 python analysis/update_mapping_from_hogwash.py --tag v0.1.4 --sha256 <expected_sha256>
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
GENERATOR = REPO_ROOT / "analysis" / "generate_mapping_module.py"


def main() -> None:
    cmd = [sys.executable, str(GENERATOR), *sys.argv[1:]]
    subprocess.run(cmd, check=True)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
