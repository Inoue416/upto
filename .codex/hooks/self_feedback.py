#!/usr/bin/env python3
"""Run project self-feedback checks for Codex lifecycle hooks."""

from __future__ import annotations

import argparse
import py_compile
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


CODE_EXTENSIONS = {".css", ".js", ".jsx", ".json", ".jsonc", ".mjs", ".ts", ".tsx"}
HARNESS_PREFIXES = (".agents/", ".codex/", ".github/", "AGENTS.md")
LOGIC_PREFIXES = ("apps/collector/src/", "apps/web/src/lib/", "packages/db/", "packages/domain/")
TEST_MARKERS = (".test.", ".spec.")


def run(command: list[str], cwd: Path, timeout: int = 300) -> int:
  print(f"[self-feedback] {' '.join(command)}", file=sys.stderr, flush=True)
  completed = subprocess.run(command, cwd=cwd, timeout=timeout, stdout=sys.stderr, stderr=sys.stderr)
  return completed.returncode


def compile_python_source(root: Path, relative_path: str) -> int:
  source = root / relative_path
  cache_dir = Path(tempfile.gettempdir()) / "upto-codex-hook-pycache"
  cache_dir.mkdir(parents=True, exist_ok=True)
  output = cache_dir / f"{source.stem}.pyc"
  print(f"[self-feedback] py_compile {relative_path}", file=sys.stderr, flush=True)
  try:
    py_compile.compile(str(source), cfile=str(output), doraise=True)
  except py_compile.PyCompileError as error:
    print(error.msg, file=sys.stderr)
    return 1
  return 0


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


def deleted_adr_files(root: Path) -> list[str]:
  completed = subprocess.run(
    ["git", "status", "--porcelain"],
    cwd=root,
    check=True,
    capture_output=True,
    text=True,
  )
  deleted: list[str] = []
  for line in completed.stdout.splitlines():
    if len(line) < 4:
      continue
    status = line[:2]
    path = line[3:]
    if " -> " in path:
      path = path.split(" -> ", 1)[0]
    if "D" in status and path.startswith("docs/adr/"):
      deleted.append(path)
  return deleted


def should_run_project_verify(files: list[str]) -> bool:
  if any(file in {"package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"} for file in files):
    return True
  if any(file.startswith(("apps/", "packages/")) for file in files):
    return True
  return any(Path(file).suffix in CODE_EXTENSIONS for file in files)


def should_run_harness_verify(files: list[str]) -> bool:
  return any(file.startswith(HARNESS_PREFIXES) for file in files)


def is_test_file(file: str) -> bool:
  name = Path(file).name
  return any(marker in name for marker in TEST_MARKERS)


def is_logic_file(file: str) -> bool:
  if is_test_file(file):
    return False
  if Path(file).suffix not in {".ts", ".tsx"}:
    return False
  return file.startswith(LOGIC_PREFIXES)


def page_story_violations(root: Path) -> list[str]:
  app_root = root / "apps/web/src/app"
  if not app_root.exists():
    return []

  violations: list[str] = []
  for page in app_root.rglob("page.tsx"):
    story = page.with_name("page.stories.tsx")
    if not story.exists():
      violations.append(str(page.relative_to(root)))
  return violations


def run_development_flow_checks(root: Path, files: list[str], *, strict_tdd: bool) -> int:
  deleted_adrs = deleted_adr_files(root)
  if deleted_adrs:
    print(
      "[self-feedback] ADR files are append-only and must not be deleted as obsolete docs:\n"
      + "\n".join(f"  - {file}" for file in deleted_adrs),
      file=sys.stderr,
    )
    return 1

  missing_stories = page_story_violations(root)
  if missing_stories:
    print(
      "[self-feedback] page components must have sibling page.stories.tsx files:\n"
      + "\n".join(f"  - {file}" for file in missing_stories),
      file=sys.stderr,
    )
    return 1

  changed_logic = [file for file in files if is_logic_file(file)]
  changed_tests = [file for file in files if is_test_file(file)]
  if strict_tdd and changed_logic and not changed_tests:
    print(
      "[self-feedback] logic changes require a Vitest test change in the same task:\n"
      + "\n".join(f"  - {file}" for file in changed_logic),
      file=sys.stderr,
    )
    print(
      "[self-feedback] add or update a focused .test.ts/.test.tsx/.spec.ts/.spec.tsx file before finishing.",
      file=sys.stderr,
    )
    return 1

  return 0


def run_stop_checks(root: Path, files: list[str]) -> int:
  flow_result = run_development_flow_checks(root, files, strict_tdd=True)
  if flow_result:
    return flow_result

  commands: list[list[str]] = []
  if should_run_project_verify(files):
    if shutil.which("pnpm") is None:
      print("[self-feedback] pnpm is not available; cannot run project verification", file=sys.stderr)
      return 1
    commands.append(["pnpm", "verify"])

  if should_run_harness_verify(files):
    for source in (".codex/hooks/codex_hook_guard.py", ".codex/hooks/self_feedback.py"):
      result = compile_python_source(root, source)
      if result != 0:
        return result

    commands.extend(
      [
        [
          "codex",
          "execpolicy",
          "check",
          "--pretty",
          "--rules",
          ".codex/rules/project.rules",
          "--",
          "git",
          "reset",
          "--hard",
        ],
        [
          "codex",
          "execpolicy",
          "check",
          "--pretty",
          "--rules",
          ".codex/rules/project.rules",
          "--",
          "git",
          "push",
        ],
        ["/usr/bin/python3", ".codex/hooks/codex_hook_guard.py", "--mode", "user-prompt"],
      ],
    )

  for command in commands:
    result = run(command, root)
    if result != 0:
      return result

  return 0


def main() -> int:
  parser = argparse.ArgumentParser()
  parser.add_argument("--phase", choices=("post-tool", "stop"), default="stop")
  args = parser.parse_args()

  root = Path(__file__).resolve().parents[2]
  files = changed_files(root)
  if not files:
    print("[self-feedback] no local changes; skipping checks", file=sys.stderr)
    return 0

  if args.phase == "post-tool":
    return run_development_flow_checks(root, files, strict_tdd=False)

  return run_stop_checks(root, files)


if __name__ == "__main__":
  raise SystemExit(main())
