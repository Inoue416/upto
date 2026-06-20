# バッチ実行基盤構築計画

作成日: 2026-06-20
最終レビュー日: 2026-06-20

## この文書の役割

本書はバッチ実行基盤の共通方針と、作業計画への入口を管理する。具体的な作業は責任主体ごとに次の文書へ分割する。

- [リポジトリ実装計画](batch-platform-repository-implementation-plan.md): Git 管理し、pull request でレビュー・自動検証する実装。
- [オンプレサーバー構築計画](batch-platform-onprem-server-plan.md): 実機と GitHub/Coolify/Trigger.dev/Tailscale の管理画面でユーザーが行う構築・移行・運用設定。

秘密情報の投入、サービスの初期セットアップ、ネットワーク制御、実データの backup/restore はオンプレサーバー構築計画の範囲とする。

## 概要

TypeScript 製ニュース収集バッチを、自宅サーバー上で運用しやすい実行基盤へ移行する。

既存の `runCollector()`、PostgreSQL、Drizzle schema を活かしつつ、実行管理は Trigger.dev、アプリケーションのデプロイ管理は Coolify、管理画面保護は Tailscale に寄せる。移行後は systemd timer をバッチ起動に使用しない。

本基盤で実現すること:

- Pull Request 作成時の自動テスト。
- `main` ブランチ更新時の自動デプロイ。
- バッチスケジュール、実行履歴、ログ、retry/replay の管理。
- Tailscale による管理画面保護。
- Upto DB による job/article status の永続化。

## 既存ADRとの差分

ADR-0001 はバッチ基盤を「Ubuntu Server + Docker Compose + systemd timer」として Accepted にしている。本計画は Trigger.dev をスケジュール、履歴、再実行 UI、リトライ制御の中心に置くため、実装前に次のいずれかを行う。

- 新 ADR を作成し、Trigger.dev + Coolify + Tailscale への変更を Accepted として記録する。
- ADR-0001を維持する場合は、本計画を Proposed 扱いに戻して実装対象から外す。

## システム構成

```text
GitHub

├─ Pull Request
│   └─ GitHub Actions
│       ├─ format / lint / typecheck / test
│       └─ 必要に応じて Playwright
│
└─ Merge to main
    ├─ GitHub Actions
    │   └─ Trigger.dev tasks deploy
    └─ Coolify GitHub App または webhook
        └─ Web app deploy / DB migration

Self-host server

├─ Coolify
│   └─ application deploy / environment / logs / rollback
├─ Trigger.dev self-hosted stack
│   └─ schedules / run history / logs / retry / replay
├─ Upto PostgreSQL
│   └─ articles / crawl_jobs / contents / summaries / metrics
└─ Tailscale
    └─ Coolify / Trigger.dev / SSH / DB maintenance access
```

## 責務分担

| 領域                | 採用                 | 責務                                                                 |
| ------------------- | -------------------- | -------------------------------------------------------------------- |
| CI                  | GitHub Actions       | PR / main の format、lint、typecheck、test、build を実行する。       |
| App deploy          | Coolify              | Web app の build/deploy、環境変数、ログ、rollback を管理する。       |
| Batch orchestration | Trigger.dev          | スケジュール、実行履歴、ログ、retry/replay、同時実行制御を管理する。 |
| DB                  | PostgreSQL + Drizzle | 記事、ジョブ履歴、要約、メトリクスを保存する。                       |
| Private access      | Tailscale            | Coolify / Trigger.dev / SSH / DB 管理口を tailnet 内に閉じる。       |

Coolify はアプリケーション配置、Trigger.dev はバッチ実行制御を担当する。Trigger.dev の実行履歴だけに依存せず、Upto DB の `crawl_jobs` と article status も保持する。

## 共通の技術方針

### Trigger.dev task

- 既存 `runCollector()` を薄い adapter から呼び出す。
- `Asia/Tokyo` の 08:00 / 20:00 を schedule 初期値とする。
- task queue と collector concurrency の初期値を 1 とする。
- task retry は feed 全体の一時障害に使い、記事単位の失敗は collector が記録して処理を継続する。
- scheduled run の idempotency key は実行時刻単位とし、手動 retry/replay を妨げないようにする。

### Databaseと履歴

- Trigger.dev 内部 DB と Upto PostgreSQL を分離する。
- 同じ `normalized_url` の重複行を作らず、要約済み記事を再要約しない。
- `crawl_jobs`、article status、`retry_count`、`error_summary` を維持する。
- DB migration はリポジトリで生成・レビューし、backup 後の本番適用はオンプレ側で行う。

### Security

- `DATABASE_URL`、`GEMINI_API_KEY`、`TRIGGER_ACCESS_TOKEN`、Coolify webhook token、Tailscale auth key を Git 管理しない。
- secrets は GitHub Actions、Coolify、Trigger.dev の適切な secret store に分ける。
- Coolify、Trigger.dev、DB 管理口は Tailscale ACL で制限する。
- 外部公開が必要な Web app のみ通常の HTTPS 公開対象とし、Tailscale Funnel は使わない。

### Migration

- systemd artifacts はリポジトリで legacy 化する。
- Trigger.dev の定期実行を最低1回確認するまで、実機の旧 systemd timer を停止しない。
- rollback 手段を確認した後に旧 timer を停止する。

## 現状と移行後

現状:

- `apps/collector/src/run-collector.ts` に idempotent な collector 処理がある。
- `packages/db/src/schema.ts` に `crawl_jobs`、`articles.retry_count`、`articles.normalized_url` unique index がある。
- `docker-compose.yml` に Upto PostgreSQL と collector service がある。
- `deploy/systemd/` と `docs/server-deployment-runbook.md` は systemd timer 前提を含む。

移行後:

- Trigger.dev task から collector entrypoint を呼ぶ。
- Trigger.dev queue で同時実行を制限する。
- Coolify が Web app の deploy を管理する。
- Tailscale が管理 UI と保守経路を保護する。
- systemd timer 関連の手順を legacy 化する。

## 全体の実施順序

```text
新 ADR Accepted
  -> リポジトリ実装計画を完了
  -> オンプレサーバー構築計画を実施
  -> migration / deploy
  -> 小件数の手動検証
  -> 定期実行を最低1回確認
  -> 旧 systemd timer 停止
```

リポジトリ実装の完了だけでは本番移行完了としない。オンプレ側で定期実行、アクセス制限、backup/restore、rollback を確認して受け入れ完了とする。

## 全体の受け入れ条件

- PR で format、lint、typecheck、unit test が自動実行される。
- `main` 更新後に Web app と Trigger.dev task が deploy される。
- Trigger.dev dashboard で手動実行、履歴、ログ、retry/replay を操作できる。
- schedule が `Asia/Tokyo` の期待時刻に発火し、同時実行数が 1 に制限される。
- 重複行、要約済み記事の再要約、単一記事失敗による batch 全停止が発生しない。
- Upto DB に job/article status が残る。
- Coolify と Trigger.dev dashboard が Tailscale 経由でのみ管理できる。
- secrets が Git に含まれない。
- backup/restore と rollback を実行できる。
- systemd timer なしで定期実行できる。

詳細な受け入れ方法は、各作業計画に記載する。

## 非目標

- Kubernetes 化。
- バッチ実行履歴を Trigger.dev のみに寄せて `crawl_jobs` を削除すること。
- URL 正規化、重複排除、本文抽出、Gemini 要約ロジックの大規模再設計。
- 認証情報や `.env` をリポジトリに保存すること。

## 参照した一次情報

- Trigger.dev v4 docs: <https://trigger.dev/docs/introduction>
- Trigger.dev self-hosting Docker Compose: <https://trigger.dev/docs/self-hosting/docker>
- Trigger.dev scheduled tasks: <https://trigger.dev/docs/tasks/scheduled>
- Trigger.dev GitHub Actions deploy: <https://trigger.dev/docs/github-actions>
- Trigger.dev concurrency queues: <https://trigger.dev/docs/queue-concurrency>
- Trigger.dev idempotency: <https://trigger.dev/docs/idempotency>
- Coolify docs: <https://coolify.io/docs>
- Coolify applications docs: <https://coolify.io/docs/applications>
- Tailscale Serve docs: <https://tailscale.com/docs/features/tailscale-serve>
- Tailscale ACL docs: <https://tailscale.com/docs/features/access-control/acls>

## レビュー記録

### Review 1: 不合格

初版は構成図のみで、ADR 差分、責務境界、hardening、secrets、resource 要件、idempotency、受け入れ条件が不足していた。

### Review 2: 合格

Trigger.dev、Coolify、Tailscale、Upto DB の責務、実装順序、検証計画、リスク対策を具体化した。

### Review 3: 作業主体を分離

Git 管理する実装と実機・管理画面で行う作業の境界を明記した。

### Review 4: 計画ファイルを分割

共通方針を本書に残し、リポジトリ実装計画とオンプレサーバー構築計画を別ファイルへ分割した。
