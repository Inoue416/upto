# バッチ実行基盤 オンプレサーバー構築計画

作成日: 2026-06-20
最終レビュー日: 2026-06-20

## 目的

[バッチ実行基盤構築計画](batch-platform-plan.md)に基づき、実機と GitHub/Coolify/Trigger.dev/Tailscale の管理画面でバッチ実行基盤を構築する。

必要なコード、Compose/config template、migration、workflow、runbook は[リポジトリ実装計画](batch-platform-repository-implementation-plan.md)から受け取る。

## 開始条件

- Trigger.dev + Coolify + Tailscale の採用を記録する新 ADR が Accepted である。
- リポジトリ実装計画の検証が完了している。
- secrets を安全に保管・投入できる管理権限がある。
- 現行 systemd timer を直ちに停止せず、移行中の rollback 経路として維持できる。

## 構築範囲

| 領域          | オンプレサーバーまたは管理画面で行う作業                                            | リポジトリから受け取るもの           |
| ------------- | ----------------------------------------------------------------------------------- | ------------------------------------ |
| Capacity / OS | CPU・RAM・disk の確認、Ubuntu/Docker/DNS の準備                                     | resource 要件と構成図                |
| Coolify       | 初期設定、GitHub 接続、application/domain/HTTPS、deploy/rollback 設定               | Dockerfile/Compose と runbook        |
| Trigger.dev   | self-hosted stack の配置・起動、version/health 確認、project/environment/token 作成 | Compose/config template と task 定義 |
| PostgreSQL    | 配置方式の決定、DB/user/volume、backup/restore、migration 適用                      | Drizzle migration と手順             |
| Secrets       | GitHub Actions、Coolify、Trigger.dev の secret store へ登録                         | `.env.example` と secret 配置表      |
| Tailscale     | サーバー参加、MagicDNS/Serve または reverse proxy、ACL、SSH/管理口制限              | 公開ポート一覧と設定手順             |
| GitHub        | Actions secrets、branch protection、Coolify 連携                                    | workflow と必要 secret 名            |
| Go-live       | 小件数実行、retry/replay、ログ、DB保存、重複防止、外部遮断の確認                    | 受け入れ条件と検証手順               |
| Operations    | backup、restore test、credential rotation、disk/health 監視                         | runbook                              |

## 構築手順

### 1. サーバー前提を確認する

- Trigger.dev、Coolify、Upto Web、Upto PostgreSQL、backup の合計 CPU・RAM・disk を見積もる。
- Trigger.dev の目安として webapp 3+ vCPU / 6+ GB RAM、worker 4+ vCPU / 8+ GB RAM を確認し、combined 構成では同居サービス分の余力も確保する。
- Ubuntu、Docker、永続 volume、時刻同期、DNS、backup 保存先を準備する。
- disk 枯渇、container 異常、backup 失敗を検知できる監視方法を決める。

### 2. Tailscaleの管理経路を先に確保する

- サーバーを tailnet に参加させる。
- SSH、Coolify、Trigger.dev、必要な DB 管理口への管理者 ACL を設定する。
- Tailscale Serve または reverse proxy + tailnet IP / MagicDNS の方式を決める。
- 管理 UI の backend は可能な限り localhost listen にする。
- Funnel は使わず、外部公開が必要な Web app だけ通常の HTTPS 公開対象にする。
- Tailscale の identity header を使う場合は、信頼する proxy 境界を限定する。

### 3. Coolifyを構築する

- Coolify を初期設定し、管理 UI を Tailscale 経由に制限する。
- GitHub App auto deploy または deploy webhook のどちらか一方を選ぶ。
- Web application、domain、HTTPS、build/deploy source を設定する。
- migration の release step を設定し、失敗時に新 application を昇格しないことを確認する。
- deploy logs、container logs、rollback 操作を確認する。

### 4. Upto PostgreSQLを構築する

- Coolify managed database または既存 Compose database の一方を選び、二重管理しない。
- DB、user、password、永続 volume、接続制限を設定する。
- backup を定期化し、別領域から restore できることを test する。
- backup 取得後にレビュー済み Drizzle migration を適用する。
- Trigger.dev 内部 DB と Upto PostgreSQL を混同しない。

### 5. Trigger.dev self-hosted stackを構築する

- リポジトリの Compose/config template をサーバーへ配置する。
- `TRIGGER_IMAGE_TAG` を検証済み version に固定し、`latest` を使わない。
- registry password、object storage credential、auth、内部 DB、管理者制限を設定する。
- webapp、worker/supervisor、内部 PostgreSQL/Redis/registry/object storage の永続化と health を確認する。
- project/environment を作成し、task deploy 用 access token を発行する。
- dashboard は `WHITELISTED_EMAILS` や GitHub OAuth 制限と Tailscale ACL の両方で保護する。

### 6. SecretsとGitHubを設定する

秘密値を次の secret store に分けて登録する。

- GitHub Actions: `TRIGGER_API_URL`、`TRIGGER_ACCESS_TOKEN` など workflow が必要とする値。
- Coolify: Web app の `DATABASE_URL` など deploy/runtime 用の値。
- Trigger.dev: collector の `DATABASE_URL`、`GEMINI_API_KEY`、model、collector 設定。

Coolify webhook token、Tailscale auth key、DB password を含め、秘密値を Git、shell history、共有ログへ残さない。GitHub では必須 CI を branch protection に設定する。

### 7. Deployする

- `main` の品質ゲートが成功することを確認する。
- Coolify で Web app を deploy する。
- Trigger.dev task deploy workflow を実行する。
- Trigger.dev dashboard で最新 deployment と schedule を確認し、有効化する。
- schedule の timezone が `Asia/Tokyo`、発火時刻が 08:00 / 20:00 であることを確認する。

### 8. 小件数で検証する

- `COLLECTOR_MAX_ITEMS_PER_FEED=1` 相当で manual run する。
- 同条件で2回実行し、2回目で要約済み記事が再要約されないことを確認する。
- task/collector concurrency が 1 で、二重起動しないことを確認する。
- 単一記事を失敗させ、他の記事が継続されることを確認する。
- Trigger.dev dashboard で run history、logs、retry、replay を確認する。
- Upto DB の `crawl_jobs`、article status、`retry_count`、`error_summary` を確認する。
- Coolify の deploy logs と rollback を確認する。
- Tailscale 外のネットワークから管理 UI と DB 管理口に接続できないことを確認する。

### 9. 本番へ切り替える

- Trigger.dev schedule の定期実行を最低1回確認する。
- Upto PostgreSQL と Trigger.dev 内部 storage/database の backup が成功していることを確認する。
- rollback 手順を再確認してから旧 systemd timer を停止する。
- 旧 timer の削除は安定稼働期間を経て別途判断する。

## 運用設定

### スケジュールと同時実行

- schedule: 08:00 / 20:00 JST。
- timezone: `Asia/Tokyo`。
- Trigger.dev queue: `concurrencyLimit: 1`。
- collector: `COLLECTOR_CONCURRENCY=1`。
- API quota と DB 負荷を確認してから段階的に増やす。

### 失敗時の確認先

- Trigger.dev: task run、attempt、retry、replay、task logs。
- Upto DB: `crawl_jobs`、article status、retry count、error summary。
- Coolify: deploy logs、container logs、rollback logs。

一時障害は Trigger.dev task retry を使う。記事単位失敗は collector の継続処理と DB status で追跡する。

### Backup対象

- Upto PostgreSQL。
- Trigger.dev 内部 PostgreSQL。
- Trigger.dev object storage と永続 volume。
- version pin、Compose/config の非秘密部分。

backup の作成成功だけで完了とせず、restore test を定期的に実施する。

## 受け入れ条件

- `main` 更新後、Coolify で Web app が deploy される。
- `main` 更新後、Trigger.dev task が deploy され、最新 schedule が有効になる。
- dashboard から手動実行、履歴、ログ、retry/replay を操作できる。
- schedule が `Asia/Tokyo` の期待時刻に発火する。
- collector の同時実行が 1 に制限される。
- 重複行と要約済み記事の再要約が発生しない。
- 単一記事失敗で batch 全体が停止しない。
- Upto DB にアプリケーション側の履歴が残る。
- Coolify と Trigger.dev dashboard は Tailscale 経由でのみ管理できる。
- backup/restore と rollback を実行できる。
- systemd timer なしで定期実行できる。

## 引き渡しゲート

```text
ADR Accepted
  -> リポジトリ実装と自動テスト完了
  -> オンプレ基盤・secret 設定完了
  -> migration / deploy
  -> 小件数の手動検証
  -> 定期実行を最低1回確認
  -> 旧 systemd timer 停止
```

## リスクと対策

| リスク                                           | 対策                                                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Trigger.dev self-hosting の hardening が不足する | version pin、credential 変更、backup、管理者制限、Tailscale ACL をすべて確認する。               |
| Coolify と GitHub Actions が二重 deploy する     | GitHub App auto deploy か deploy webhook の一方だけを有効にする。                                |
| retry で Gemini API quota を超える               | concurrency を 1 に維持し、実行履歴と quota を確認する。                                         |
| Trigger.dev 履歴と Upto DB 履歴が一致しない      | 同じ実行の Trigger.dev run ID、task logs、`crawl_jobs` を突合する。                              |
| backup が復旧に使えない                          | Upto DB と Trigger.dev storage を分けて定期 restore test する。                                  |
| 移行中に収集が二重起動する                       | Trigger.dev の初回 schedule と旧 systemd timer の発火時刻を重ねず、切替後に旧 timer を停止する。 |
