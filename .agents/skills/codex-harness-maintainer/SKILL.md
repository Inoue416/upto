---
name: codex-harness-maintainer
description: Maintain this repository's Codex harness, including AGENTS.md, .codex/config.toml, rules, hooks, repo skills, and custom subagents. Use when asked to change Codex behavior or agent control.
---

Use this skill when the task changes Codex control surfaces for this repository.

Workflow:

1. Refresh official Codex behavior before making claims.
   - Prefer the `openai-docs` skill's Codex manual helper when available.
   - Confirm the current behavior for AGENTS.md, project `.codex/config.toml`, `.codex/rules`, `.codex/hooks.json`, `.agents/skills`, and `.codex/agents`.
2. Inspect the current harness files:
   - `AGENTS.md`
   - `.codex/config.toml`
   - `.codex/rules/project.rules`
   - `.codex/hooks.json`
   - `.codex/hooks/`
   - `.agents/skills/`
   - `.codex/agents/`
   - `docs/codex-harness.md`
3. Keep control surfaces separated by purpose:
   - `AGENTS.md`: durable repo conventions and review expectations.
   - `.codex/config.toml`: trusted project defaults and subagent limits.
   - `.codex/rules/*.rules`: command escalation decisions.
   - `.codex/hooks.json` and `.codex/hooks/`: lifecycle checks.
   - `.agents/skills/*/SKILL.md`: reusable workflows.
   - `.codex/agents/*.toml`: specialized parallel subagents.
4. Validate after edits:
   - `codex execpolicy check --pretty --rules .codex/rules/project.rules -- git reset --hard`
   - `codex execpolicy check --pretty --rules .codex/rules/project.rules -- git push`
   - `printf '{"prompt":"hello"}' | /usr/bin/python3 .codex/hooks/codex_hook_guard.py --mode user-prompt`
   - `printf '{"tool_input":{"command":"git reset --hard"}}' | /usr/bin/python3 .codex/hooks/codex_hook_guard.py --mode pre-tool`
5. Update `docs/codex-harness.md` whenever behavior, file locations, validation commands, or trust requirements change.

Do not add provider credentials, personal tokens, private MCP server auth, or user-specific absolute paths to repo-scoped harness files.
