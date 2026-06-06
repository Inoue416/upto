#!/usr/bin/env python3
"""Small fail-closed guards for repository-local Codex hooks.

The hook input schema may grow over time, so this script extracts strings
defensively from JSON stdin and only blocks clear high-risk cases.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from typing import Any, Iterable


SECRET_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("OpenAI-style API key", re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b")),
    ("Google API key", re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b")),
    ("GitHub token", re.compile(r"\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b")),
    ("GitHub fine-grained token", re.compile(r"\bgithub_pat_[A-Za-z0-9_]{40,}\b")),
    ("AWS access key id", re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b")),
    ("private key block", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
)

DANGEROUS_COMMAND_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("destructive recursive remove", re.compile(r"(^|\s)rm\s+-[A-Za-z]*r[A-Za-z]*f[A-Za-z]*(\s|$)")),
    ("hard git reset", re.compile(r"(^|\s)git\s+reset\s+--hard(\s|$)")),
    ("force push", re.compile(r"(^|\s)git\s+push\b.*\s--force(?:-with-lease)?(\s|$)")),
    ("privileged command", re.compile(r"(^|\s)sudo(\s|$)")),
    ("world-writable recursive chmod", re.compile(r"(^|\s)chmod\s+-R\s+777(\s|$)")),
    ("pipe remote script to shell", re.compile(r"\b(?:curl|wget)\b.*\|\s*(?:sh|bash|zsh)\b")),
)


def read_stdin() -> str:
    if sys.stdin.isatty():
        return ""
    return sys.stdin.read()


def parse_payload(raw: str) -> Any:
    if not raw.strip():
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"raw": raw}


def collect_strings(value: Any) -> Iterable[str]:
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for item in value.values():
            yield from collect_strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from collect_strings(item)


def joined_text(payload: Any) -> str:
    return "\n".join(collect_strings(payload))


def fail(message: str) -> int:
    print(f"Codex hook blocked this request: {message}", file=sys.stderr)
    return 1


def check_for_secrets(text: str) -> int:
    for label, pattern in SECRET_PATTERNS:
        if pattern.search(text):
            return fail(f"possible {label} detected. Remove secrets from prompts, commands, and files.")
    return 0


def check_command_safety(text: str) -> int:
    for label, pattern in DANGEROUS_COMMAND_PATTERNS:
        if pattern.search(text):
            return fail(f"{label} requires explicit human handling in this repository.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=("pre-tool", "permission", "user-prompt"), required=True)
    args = parser.parse_args()

    payload = parse_payload(read_stdin())
    text = joined_text(payload)

    secret_result = check_for_secrets(text)
    if secret_result:
        return secret_result

    if args.mode in {"pre-tool", "permission"}:
        return check_command_safety(text)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
