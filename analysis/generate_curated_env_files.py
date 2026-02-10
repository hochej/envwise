#!/usr/bin/env -S uv run --python 3.12 python
"""Generate simplified curated env fixture files.

Outputs:
- test/fixtures/valid-secrets.env
- test/fixtures/invalid-vars.env
"""

from __future__ import annotations

import json
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
GENERATED_MAPPING_MODULE = REPO_ROOT / "src" / "generated" / "secret-mapping.ts"
OUT_DIR = REPO_ROOT / "test" / "fixtures"
TEMPLATES_DIR = Path(__file__).resolve().parent / "fixture-templates"
INVALID_VARS_TEMPLATE = TEMPLATES_DIR / "invalid-vars.txt"
VALUE_PATTERN_SECRETS_TEMPLATE = TEMPLATES_DIR / "value-pattern-secrets.txt"


def sanitize_keyword_for_var(keyword: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "_", keyword).strip("_").upper()


def assignment_name(line: str) -> str | None:
    stripped = line.strip()
    if not stripped or stripped.startswith("#") or "=" not in stripped:
        return None
    return stripped.split("=", 1)[0].strip()


def append_unique_assignment(
    lines: list[str],
    seen: set[str],
    assignment: str,
    *,
    skipped_duplicates: list[str] | None = None,
) -> None:
    name = assignment_name(assignment)
    if not name:
        lines.append(assignment)
        return

    if name in seen:
        if skipped_duplicates is not None:
            skipped_duplicates.append(name)
        return

    seen.add(name)
    lines.append(assignment)


def assert_unique_assignment_keys(lines: list[str], label: str) -> None:
    first_seen: dict[str, int] = {}
    duplicates: list[tuple[str, int, int]] = []

    for line_number, line in enumerate(lines, start=1):
        name = assignment_name(line)
        if not name:
            continue

        if name in first_seen:
            duplicates.append((name, first_seen[name], line_number))
            continue

        first_seen[name] = line_number

    if not duplicates:
        return

    preview = ", ".join(f"{name} ({a}->{b})" for name, a, b in duplicates[:8])
    raise SystemExit(f"{label} contains duplicate env keys: {preview}")


def load_assignments_template(path: Path) -> list[str]:
    if not path.exists():
        raise SystemExit(f"Missing fixture template: {path}")

    lines: list[str] = []
    for line in path.read_text().splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        lines.append(stripped)

    return lines


def load_mapping_from_generated_module() -> dict:
    if not GENERATED_MAPPING_MODULE.exists():
        raise SystemExit(
            "Missing bundled mapping module. Run `pnpm mapping:update -- --latest` first: "
            f"{GENERATED_MAPPING_MODULE}"
        )

    content = GENERATED_MAPPING_MODULE.read_text(encoding="utf-8")
    marker = "export const SECRET_MAPPING_JSON = "
    start = content.find(marker)
    if start < 0:
        raise SystemExit(f"Malformed mapping module: {GENERATED_MAPPING_MODULE}")

    start += len(marker)
    end = content.find(";\n\nexport const SECRET_MAPPING_DATA", start)
    if end < 0:
        raise SystemExit(f"Malformed mapping module: {GENERATED_MAPPING_MODULE}")

    json_literal = content[start:end].strip()
    raw_json = json.loads(json_literal)

    if not isinstance(raw_json, str):
        raise SystemExit(f"Malformed mapping module payload: {GENERATED_MAPPING_MODULE}")

    mapping = json.loads(raw_json)
    if not isinstance(mapping, dict):
        raise SystemExit("Mapping payload must be a JSON object")

    return mapping


def main() -> None:
    mapping = load_mapping_from_generated_module()

    valid_lines: list[str] = []
    seen_valid_names: set[str] = set()
    skipped_valid_duplicates: list[str] = []

    valid_lines.append("# Curated valid secret env vars")
    valid_lines.append("# Rule: every entry should be treated as secret and ideally mapped to a host")
    valid_lines.append("")

    valid_lines.append("# Exact-name mapping coverage")
    for i, name in enumerate(sorted(mapping["exact_name_host_map"].keys()), start=1):
        append_unique_assignment(
            valid_lines,
            seen_valid_names,
            f"{name}=exact_secret_value_{i:03d}",
            skipped_duplicates=skipped_valid_duplicates,
        )

    valid_lines.append("")
    valid_lines.append("# Keyword mapping coverage (one var per keyword)")
    for i, keyword in enumerate(sorted(mapping["keyword_host_map"].keys()), start=1):
        key = sanitize_keyword_for_var(keyword)
        append_unique_assignment(
            valid_lines,
            seen_valid_names,
            f"{key}_API_KEY=keyword_secret_value_{i:03d}",
            skipped_duplicates=skipped_valid_duplicates,
        )

    valid_lines.append("")
    valid_lines.append("# Provider-specific secret-like entries")
    for assignment in [
        "GITHUB_TOKEN=secret_value_for_github",
        "OPENAI_API_KEY=secret_value_for_openai",
        "GITLAB_TOKEN=secret_value_for_gitlab",
        "NPM_TOKEN=secret_value_for_npm",
        "SLACK_TOKEN=secret_value_for_slack",
        "STRIPE_API_KEY=secret_value_for_stripe",
        "TWILIO_AUTH_TOKEN=secret_value_for_twilio",
    ]:
        append_unique_assignment(
            valid_lines,
            seen_valid_names,
            assignment,
            skipped_duplicates=skipped_valid_duplicates,
        )

    valid_lines.append("")
    valid_lines.append("# Real-world secret-like names (mapped by exact env var name)")
    for assignment in [
        "BRAVE_API_KEY=secret_value_for_brave",
        "GEMINI_API_KEY=secret_value_for_gemini",
        "KIMI_API_KEY=secret_value_for_kimi",
        "OPENROUTER_API_KEY=secret_value_for_openrouter",
        "DEEPSEEK_API_KEY=secret_value_for_deepseek",
        "PERPLEXITY_API_KEY=secret_value_for_perplexity",
        "GROQ_API_KEY=secret_value_for_groq",
        "TOGETHER_X_API_KEY=secret_value_for_together_x",
    ]:
        append_unique_assignment(
            valid_lines,
            seen_valid_names,
            assignment,
            skipped_duplicates=skipped_valid_duplicates,
        )

    valid_lines.append("")
    valid_lines.append("# Realistic token-shaped values (must match by value)")
    for assignment in load_assignments_template(VALUE_PATTERN_SECRETS_TEMPLATE):
        append_unique_assignment(
            valid_lines,
            seen_valid_names,
            assignment,
            skipped_duplicates=skipped_valid_duplicates,
        )

    invalid_lines: list[str] = []
    invalid_lines.append("# Curated invalid / non-secret env vars")
    invalid_lines.append("# Rule: these should not be classified as secret")
    invalid_lines.append("")
    invalid_lines.extend(load_assignments_template(INVALID_VARS_TEMPLATE))

    assert_unique_assignment_keys(valid_lines, "valid-secrets.env")
    assert_unique_assignment_keys(invalid_lines, "invalid-vars.env")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "valid-secrets.env").write_text("\n".join(valid_lines) + "\n")
    (OUT_DIR / "invalid-vars.env").write_text("\n".join(invalid_lines) + "\n")

    print(f"wrote {OUT_DIR / 'valid-secrets.env'} ({len(valid_lines)} lines)")
    print(f"wrote {OUT_DIR / 'invalid-vars.env'} ({len(invalid_lines)} lines)")
    if skipped_valid_duplicates:
        unique_skipped = sorted(set(skipped_valid_duplicates))
        print(
            f"skipped {len(skipped_valid_duplicates)} duplicate valid assignments"
            f" ({', '.join(unique_skipped)})"
        )


if __name__ == "__main__":
    main()
