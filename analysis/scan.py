#!/usr/bin/env python3
"""Scan test corpus against gondolin value patterns and report hit rates."""

import json
import re
import os
import sys
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
GONDOLIN = REPO_ROOT / "data" / "gondolin" / "secret-mapping.gondolin.json"
FAKE_LEAKS = REPO_ROOT / "test" / "fixtures" / "raw" / "fake-leaks"
DETECT_SECRETS = REPO_ROOT / "test" / "fixtures" / "raw" / "detect-secrets"


def fix_regex(pattern: str) -> str:
    """Fix Go-compatible regex for Python.

    Handles:
    - end anchor: \\z -> $
    - inline case flag normalization: (?i)
    - POSIX character classes inside bracket expressions (e.g. [[:alnum:]])
    """
    p = pattern.replace("\\z", "$")

    # Convert common POSIX bracket classes used by upstream regexes.
    # Python's `re` does not support POSIX classes and may emit FutureWarning
    # (e.g. "Possible nested set") while changing match semantics.
    posix_class_map = {
        "[[:alnum:]]": "[A-Za-z0-9]",
        "[[:alpha:]]": "[A-Za-z]",
        "[[:digit:]]": "[0-9]",
        "[[:xdigit:]]": "[A-Fa-f0-9]",
        "[[:lower:]]": "[a-z]",
        "[[:upper:]]": "[A-Z]",
        "[[:space:]]": "[\\t\\r\\n\\f\\v ]",
    }
    for src, dst in posix_class_map.items():
        p = p.replace(src, dst)

    if "(?i)" in p:
        p = p.replace("(?i)", "")
        p = "(?i)" + p

    return p


def load_patterns():
    with open(GONDOLIN) as f:
        data = json.load(f)

    patterns = []
    failed = []
    for vp in data["value_patterns"]:
        try:
            compiled = re.compile(fix_regex(vp["regex"]))
            patterns.append({
                "id": vp["id"],
                "regex": compiled,
                "secret_group": vp.get("secret_group", 0),
                "keywords": vp.get("keywords", []),
                "keyword": vp.get("keyword", ""),
                "raw": vp["regex"],
            })
        except re.error as e:
            failed.append((vp["id"], str(e)))
    return patterns, failed


def scan_directory(root_dir, patterns):
    """Scan all files under root_dir, return {pattern_id: [(file, match)]}."""
    hits = defaultdict(list)
    files_scanned = 0

    for root, dirs, files in os.walk(root_dir):
        dirs[:] = [d for d in dirs if d not in [".git", "node_modules", "__pycache__"]]
        for fname in files:
            fpath = os.path.join(root, fname)
            try:
                content = open(fpath, "r", errors="ignore").read()
            except Exception:
                continue
            files_scanned += 1
            rel = os.path.relpath(fpath, root_dir)
            for p in patterns:
                for m in p["regex"].finditer(content):
                    sg = p["secret_group"]
                    matched = m.group(sg) if sg and sg <= len(m.groups()) else m.group(0)
                    hits[p["id"]].append((rel, matched[:80]))
    return hits, files_scanned


def main():
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--gaps", action="store_true", help="Show patterns with no test data")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show match details")
    args = parser.parse_args()

    patterns, failed = load_patterns()
    print(f"Loaded {len(patterns)} patterns ({len(failed)} failed to compile)")

    if args.gaps:
        fl_hits, _ = scan_directory(FAKE_LEAKS, patterns)
        ds_hits, _ = scan_directory(DETECT_SECRETS, patterns)
        combined = set(fl_hits.keys()) | set(ds_hits.keys())
        missing = [p["id"] for p in patterns if p["id"] not in combined]
        print(f"\n{len(missing)} patterns with zero hits across all test data:")
        for pid in sorted(missing):
            print(f"  {pid}")
        return

    for name, root_dir in [("fake-leaks", FAKE_LEAKS), ("detect-secrets", DETECT_SECRETS)]:
        hits, files_scanned = scan_directory(root_dir, patterns)
        firing = len(hits)
        total_matches = sum(len(v) for v in hits.values())

        print(f"\n## {name}: {files_scanned} files, {firing}/{len(patterns)} patterns fire, {total_matches} total matches")
        for pid, matches in sorted(hits.items(), key=lambda x: -len(x[1]))[:20]:
            unique_files = len(set(f for f, _ in matches))
            print(f"  {pid}: {len(matches)} matches in {unique_files} files")
            if args.verbose:
                for f, val in matches[:3]:
                    print(f"    {f}: {val}")


if __name__ == "__main__":
    main()
