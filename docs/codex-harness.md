# Codex harness

作成日: 2026-06-07

このリポジトリでは Codex を制御するためのハーネスを、公式 Codex manual の現行仕様に合わせて repo scope で管理する。

## 参照した公式仕様

- Codex manual: `https://developers.openai.com/codex/codex-manual.md`
- 取得結果: `codex-cli 0.137.0` の manual helper で current と確認
- 主要仕様:
  - `AGENTS.md` は Codex 起動時に global から project、current directory へ向けて読み込まれる
  - project `.codex/config.toml`、project hooks、project rules は trusted project でのみ読み込まれる
  - repo skills は `.agents/skills` から検出される
  - custom subagents は `.codex/agents/*.toml` で定義できる
  - hooks は `.codex/hooks.json` または config inline で定義できる
  - rules は active config layer の `rules/*.rules` から読み込まれる。rules は experimental 扱いのため、Codex 更新後は再検証する

## ファイル構成

```txt
AGENTS.md
.codex/
  config.toml
  hooks.json
  agents/
    architecture-reviewer.toml
    security-reviewer.toml
    test-planner.toml
  hooks/
    codex_hook_guard.py
  rules/
    project.rules
.agents/
  skills/
    adr-maintainer/
      SKILL.md
    codex-harness-maintainer/
      SKILL.md
    news-summary-implementation-planner/
      SKILL.md
docs/
  codex-harness.md
```

## 制御面の役割

| 制御面 | 役割 |
|---|---|
| `AGENTS.md` | リポジトリの恒久的な作業規約、技術スタック、検証方針、レビュー観点 |
| `.codex/config.toml` | trusted project で使う Codex 既定値、sandbox、approval、hook 有効化、subagent 上限 |
| `.codex/rules/project.rules` | sandbox 外実行のコマンド判定。破壊的 git 操作、sudo、dependency 変更、push などを制限 |
| `.codex/hooks.json` | lifecycle hook の登録。`Stop` で自己フィードバック検証を起動 |
| `.codex/hooks/codex_hook_guard.py` | prompt/command/permission request 内の秘密情報と明確に危険な command を検出 |
| `.codex/hooks/self_feedback.py` | worktree 変更に応じて `pnpm format:check`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、harness 検証を自動実行 |
| `.agents/skills/*` | Codex が必要時に読み込む再利用ワークフロー |
| `.codex/agents/*` | 明示的に subagent を使うときの専門 agent |

## Trust and activation

project `.codex/` layer は Codex がこの repository を trusted と判断した場合だけ読み込まれる。初回または hook 変更後は Codex CLI で `/hooks` を開き、表示された hook 定義を確認して trust する。

skills は repo scope の `.agents/skills` に置いているため、Codex の skill discovery 対象になる。skill が見えない場合は Codex を再起動する。

subagents は自動では起動しない。使う場合は、たとえば次のように明示する。

```text
architecture-reviewer, security-reviewer, test-planner の subagent を並列に使って、この変更をレビューしてください。全員の結果を待って統合してください。
```

## Validation

rules:

```bash
codex execpolicy check --pretty --rules .codex/rules/project.rules -- git reset --hard
codex execpolicy check --pretty --rules .codex/rules/project.rules -- git push
codex execpolicy check --pretty --rules .codex/rules/project.rules -- pnpm add zod
codex execpolicy check --pretty --rules .codex/rules/project.rules -- pnpm verify
codex execpolicy check --pretty --rules .codex/rules/project.rules -- rm -rf node_modules
```

hooks:

```bash
python3 -m py_compile .codex/hooks/codex_hook_guard.py
python3 -m py_compile .codex/hooks/self_feedback.py
printf '{"prompt":"hello"}' | /usr/bin/python3 .codex/hooks/codex_hook_guard.py --mode user-prompt
printf '{"prompt":"sk-example-secret-secret-secret-secret"}' | /usr/bin/python3 .codex/hooks/codex_hook_guard.py --mode user-prompt
printf '{"tool_input":{"command":"git reset --hard"}}' | /usr/bin/python3 .codex/hooks/codex_hook_guard.py --mode pre-tool
printf '{"tool_input":{"command":"pnpm test"}}' | /usr/bin/python3 .codex/hooks/codex_hook_guard.py --mode pre-tool
```

config:

```bash
codex --cd . debug prompt-input "harness smoke test" > /tmp/upto-prompt-input.json
codex --strict-config --cd . --ask-for-approval never "Summarize active project instructions." 
```

`debug prompt-input` renders model-visible input without calling a model. The strict config command may call a model. Use it only when an authenticated Codex run is acceptable. For local syntax-only checks, prefer TOML/JSON parsing, `codex execpolicy check`, and direct hook script execution.

As of `codex-cli 0.137.0`, `--strict-config` is not supported by the local-only `debug`, `execpolicy`, or `features` subcommands.

## Maintenance policy

- Update this document when adding or removing Codex control surfaces.
- Do not store user-specific credentials or private absolute paths in repo-scoped files.
- Keep hooks conservative. They should block only clear high-risk cases to avoid surprising normal development.
- Prefer rules for command approval behavior and hooks for cross-cutting prompt/tool checks.
- Use skills for repeatable workflows and subagents for explicit parallel review or exploration.
- Keep `Stop` self-feedback fast. Escalate browser E2E or Docker checks only when the touched files require them.
