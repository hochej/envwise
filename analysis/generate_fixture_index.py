#!/usr/bin/env python3
"""Generate a normalized JSONL index for test fixtures.

Output:
  test/fixtures/generated/index.jsonl

Each line is a JSON object describing one fixture file and any inferred labels.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional


REPO_ROOT = Path(__file__).resolve().parent.parent
FIXTURES_ROOT = REPO_ROOT / "test" / "fixtures"
RAW_ROOT = FIXTURES_ROOT / "raw"
OUTPUT = FIXTURES_ROOT / "generated" / "index.jsonl"


def is_text_file(path: Path, sample_size: int = 4096) -> bool:
    """Best-effort text/binary detection for fixture files."""
    try:
        data = path.read_bytes()[:sample_size]
    except Exception:
        return False

    # Empty files are treated as text fixtures.
    if not data:
        return True

    # Null bytes strongly indicate binary.
    if b"\x00" in data:
        return False

    # If most bytes are printable-ish UTF-8 text, consider it text.
    try:
        data.decode("utf-8")
        return True
    except UnicodeDecodeError:
        return False


def infer_expected(parts: tuple[str, ...]) -> Optional[str]:
    """Infer expected label from path conventions."""
    if "valid" in parts:
        return "secret"
    if "invalid" in parts or "benign" in parts:
        return "non-secret"
    return None


def classify_dataset_kind(source: str, rel_parts: tuple[str, ...]) -> str:
    if source == "fake-leaks":
        return "corpus"

    # detect-secrets subtrees
    if rel_parts and rel_parts[0] == "plugin_tests":
        return "labeled-unit"
    if rel_parts and rel_parts[0] == "test_data":
        return "corpus"
    return "other"


def infer_provider(source: str, rel_parts: tuple[str, ...], filename: str) -> str:
    if source == "fake-leaks":
        # provider is top-level directory under fake-leaks.
        # root-level files are metadata, not provider-specific.
        if len(rel_parts) <= 1:
            return "_root"
        return rel_parts[0]

    # detect-secrets conventions
    if rel_parts and rel_parts[0] == "plugin_tests":
        stem = Path(filename).stem
        return stem.replace("_test", "")
    if rel_parts and rel_parts[0] == "plugins":
        return Path(filename).stem
    if rel_parts and rel_parts[0] == "test_data":
        return "test_data"
    return "unknown"


def iter_fixture_files():
    for source in ["fake-leaks", "detect-secrets"]:
        root = RAW_ROOT / source
        if not root.exists():
            continue

        for path in sorted(root.rglob("*")):
            if path.is_dir():
                continue

            rel = path.relative_to(RAW_ROOT)
            rel_parts = rel.parts[1:]  # parts within source subtree
            expected = infer_expected(rel_parts)

            record = {
                "source": source,
                "path": rel.as_posix(),
                "provider": infer_provider(source, rel_parts, path.name),
                "datasetKind": classify_dataset_kind(source, rel_parts),
                "expected": expected,
                "expectedDerivedFrom": "path" if expected else None,
                "isText": is_text_file(path),
                "sizeBytes": path.stat().st_size,
            }
            yield record


def main() -> None:
    records = list(iter_fixture_files())

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    labeled = sum(1 for r in records if r["expected"] is not None)
    text_files = sum(1 for r in records if r["isText"])
    print(f"Wrote {len(records)} records to {OUTPUT.relative_to(REPO_ROOT)}")
    print(f"Labeled records: {labeled}")
    print(f"Text records: {text_files}")


if __name__ == "__main__":
    main()
