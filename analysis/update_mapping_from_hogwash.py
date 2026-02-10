#!/usr/bin/env python3
"""Update envwise gondolin mapping from a hogwash GitHub release artifact.

Usage:
  python3 analysis/update_mapping_from_hogwash.py --tag v0.1.4
  python3 analysis/update_mapping_from_hogwash.py --latest
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from pathlib import Path

REPO = "hochej/hogwash"
ASSET = "secret-mapping.gondolin.json"
DEST = Path(__file__).resolve().parent.parent / "data" / "gondolin" / ASSET


def run(*args: str) -> str:
    result = subprocess.run(args, check=True, text=True, capture_output=True)
    return result.stdout.strip()


def resolve_latest_tag() -> str:
    output = run("gh", "release", "view", "-R", REPO, "--json", "tagName")
    data = json.loads(output)
    return data["tagName"]


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tag", help="hogwash release tag (e.g. v0.1.4)")
    parser.add_argument("--latest", action="store_true", help="use latest hogwash release")
    args = parser.parse_args()

    if args.latest and args.tag:
        raise SystemExit("Use either --tag or --latest, not both")

    tag = args.tag or (resolve_latest_tag() if args.latest else None)
    if not tag:
        raise SystemExit("Provide --tag or --latest")

    DEST.parent.mkdir(parents=True, exist_ok=True)

    subprocess.run(
        [
            "gh",
            "release",
            "download",
            tag,
            "-R",
            REPO,
            "-p",
            ASSET,
            "-O",
            str(DEST),
            "--clobber",
        ],
        check=True,
    )

    print(f"Updated {DEST}")
    print(f"Tag: {tag}")
    print(f"SHA256: {sha256(DEST)}")


if __name__ == "__main__":
    main()
