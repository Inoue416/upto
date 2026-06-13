#!/usr/bin/env python3
"""Run fast project verification when Codex leaves local changes behind."""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path


CODE_EXTENSIONS = {".css", ".js", ".jsx", ".json", ".jsonc", ".mjs", ".ts", ".tsx"}
HARNESS_PREFIXES = (".agents/", ".codex/", "AGENTS.md")


def run(command: list[str], cwd: Path, timeout: int = 180) -> int:
  print(f"[self-feedback] {' '.join(command)}", flush=True)
  completed = subprocess.run(command, cwd=cwd, timeout=timeout)
  return completed.returncode


def changed_files(root: Path) -> list[str]:
  completed = subprocess.run(
    ["git", "status", "--porcelain"],
    cwd=root,
    check=True,
    capture_output=True,
    text=True,
  )
  files: list[str] = []
  for line in completed.stdout.splitlines():
    if not line:
      continue
    path = line[3:] if len(line) > 3 else line
    if " -> " in path:
      path = path.split(" -> ", 1)[1]
    files.append(path)
  return files


def should_run_project_verify(files: list[str]) -> bool:
  if any(file in {"package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"} for file in files):
    return True
  if any(file.startswith(("apps/", "packages/")) for file in files):
    return True
  return any(Path(file).suffix in CODE_EXTENSIONS for file in files)


def should_run_harness_verify(files: list[str]) -> bool:
  return any(file.startswith(HARNESS_PREFIXES) for file in files)


def main() -> int:
  root = Path(__file__).resolve().parents[2]
  files = changed_files(root)
  if not files:
    print("[self-feedback] no local changes; skipping checks")
    return 0

  if shutil.which("pnpm") is None:
    print("[self-feedback] pnpm is not available; cannot run project verification", file=sys.stderr)
    return 1

  commands: list[list[str]] = []
  if should_run_project_verify(files):
    commands.extend(
      [
        ["pnpm", "format:check"],
        ["pnpm", "lint"],
        ["pnpm", "typecheck"],
        ["pnpm", "test"],
      ],
    )

  if should_run_harness_verify(files):
    commands.extend(
      [
        ["python3", "-m", "py_compile", ".codex/hooks/codex_hook_guard.py"],
        ["python3", "-m", "py_compile", ".codex/hooks/self_feedback.py"],
        [
          "codex",
          "execpolicy",
          "check",
          "--rules",
          ".codex/rules/project.rules",
          "--",
          "git",
          "reset",
          "--hard",
        ],
      ],
    )

  for command in commands:
    result = run(command, root)
    if result != 0:
      return result

  return 0


if __name__ == "__main__":
  raise SystemExit(main())
