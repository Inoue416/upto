# ADR-0002: 開発ハーネスと自己フィードバック

日付: 2026-06-07
ステータス: Accepted

## 背景

ニュース要約アプリの実装を始めるには、Web アプリ、collector batch、DB/domain package の足場だけでなく、AI エージェントが作業直後に lint、format、typecheck、test の結果を見て自己修正できる開発ハーネスが必要である。

また、linter/formatter は高速でモダンな構成を優先し、ESLint/Prettier ではなく oxlint/oxfmt を使う方針に変更する。

## 決定

開発ハーネスは以下を採用する。

| 領域 | 採用技術 |
|---|---|
| Package manager | pnpm workspace |
| Linter | oxlint |
| Formatter | oxfmt |
| Typecheck | TypeScript |
| Unit test | Vitest |
| Browser E2E | Playwright |
| Codex 自己フィードバック | `.codex/hooks/self_feedback.py` を `Stop` hook で実行 |
| Codex command policy | `.codex/rules/project.rules` |
| Codex reusable workflow | `.agents/skills/*` |

root scripts は以下を標準にする。

```bash
pnpm format
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm verify
```

`pnpm verify` は `format:check -> lint -> typecheck -> test` の順に実行する。Codex の `Stop` hook は worktree の変更内容に応じて同じ検証を自動実行し、harness 変更時は `py_compile` と `codex execpolicy check` も追加で実行する。

## 理由

- oxlint と oxfmt は Oxc compiler stack 上で高速に動作し、AI エージェントの短い修正ループに向いている
- ESLint/Prettier を入れないことで、重複する lint/format 設定と依存を避けられる
- Stop hook で機械的チェックを起動すると、Codex が完了応答を返す前に失敗を検出しやすくなる
- rules で破壊的操作や supply-chain 変更を制限しつつ、`pnpm verify` などの検証コマンドは明示的に許可できる
- Playwright は常時 hook で走らせず、UI 変更時や CI で使うことでフィードバック速度と網羅性のバランスを取れる

## 影響

- ESLint と Prettier は導入しない
- format 対象はコード、設定、ハーネス、package metadata を中心にする
- 既存 ADR は append-only で運用するため、root の oxfmt script では `docs/**` と `AGENTS.md` を対象外にする
- Codex hook は project `.codex/` layer が trusted の場合だけ読み込まれるため、初回または hook 変更後は `/hooks` で trust する必要がある
- `pnpm approve-builds` は dependency build script の承認を伴うため、rules で prompt 対象にする

## 代替案

- ESLint + Prettier: エコシステムは広いが、今回の高速・モダンな自己フィードバック要件では oxlint/oxfmt を優先する
- Biome: formatter/linter 統合は魅力だが、ユーザー指定に合わせて Oxc 系の oxlint/oxfmt を採用する
- Git pre-commit hook のみ: 人間の commit 前には有効だが、Codex の作業完了直後の自己フィードバックには lifecycle hook の方が直接効く
- Playwright を Stop hook で毎回実行: UI 変更以外でも重くなるため、常時 hook では Vitest までに留める

## 追記

- 2026-06-07: 初版作成。pnpm monorepo、oxlint、oxfmt、Vitest、Playwright、Codex Stop hook による自己フィードバックを Accepted として記録。
