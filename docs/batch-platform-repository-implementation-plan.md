# バッチ実行基盤 リポジトリ実装計画

作成日: 2026-06-20
最終レビュー日: 2026-06-20

## 目的

[バッチ実行基盤構築計画](batch-platform-plan.md)のうち、Git 管理し、pull request でレビュー・自動検証できる成果物を実装する。

実機、GitHub、Coolify、Trigger.dev、Tailscale の管理画面で行う作業は[オンプレサーバー構築計画](batch-platform-onprem-server-plan.md)に従う。

## 開始条件

ADR-0001 はバッチ基盤として systemd timer を Accepted にしている。Trigger.dev + Coolify + Tailscale への変更を記録する新 ADR が Accepted になるまで、本計画の ADR 以外の実装には着手しない。

## 実装範囲

| 領域                     | リポジトリに追加・変更するもの                                            | 実機に対する責任境界                                                      |
| ------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Architecture             | ADR-0004 と ADR-0001 の supersession 追記                                 | ADR の承認後に後続へ進む。                                                |
| Trigger.dev task         | `trigger.config.ts`、scheduled task、`runCollector()` adapter、テスト     | deploy 先作成と access token 発行はオンプレ側で行う。                     |
| Trigger.dev self-hosting | version pin 済み Compose/config template、秘密値を含まない `.env.example` | 配置、起動、credential 投入、永続 volume 作成はオンプレ側で行う。         |
| CI/CD                    | PR CI と Trigger.dev task deploy の GitHub Actions workflow               | Actions secrets と branch protection は GitHub 上で設定する。             |
| Application deploy       | Web/collector の Dockerfile、Compose 定義、migration command              | Coolify application、domain、deploy source、secret は管理画面で設定する。 |
| Database                 | 必要な Drizzle schema/migration と migration 手順                         | DB 作成、backup/restore、本番 migration の承認・実行はオンプレ側で行う。  |
| Operations docs          | deploy、rollback、手動実行、retry、backup、障害確認の runbook             | runbook に従う実作業と結果確認はオンプレ側で行う。                        |
| Legacy cleanup           | systemd timer 前提の docs / artifacts の legacy 化                        | 稼働確認前に実機の旧 timer を停止・削除しない。                           |

実際の API key、access token、password、Tailscale auth key、`.env` はリポジトリに保存しない。

## 詳細実装

### 1. ADRを追加する

対象:

- `docs/adr/0004-batch-platform.md`
- `docs/adr/0001-technology-stack.md` の末尾追記

次を決定として記録する。

- systemd timer ではなく Trigger.dev をバッチ実行基盤に採用する。
- Coolify を deployment platform として採用する。
- Tailscale で管理 UI を保護する。
- Upto DB の job/article status をアプリケーション上の正規履歴として維持する。
- schedule をコード管理に固定するか、dashboard で変更可能にするかを決める。

### 2. Trigger.dev self-hosting templateを追加する

対象候補:

- `deploy/trigger/` または `infra/trigger/`
- `.env.example`
- `docs/server-deployment-runbook.md`

方針:

- Trigger.dev v4 の Docker Compose self-hosting を前提にする。
- webapp と worker を同一サーバーで動かす combined 構成の template を作る。
- `TRIGGER_IMAGE_TAG` は `latest` ではなく、オンプレ構築時に検証する version を固定できるようにする。
- registry、object storage、auth、内部 DB の秘密値を placeholder にする。
- Trigger.dev 内部 DB と Upto PostgreSQL を分離し、collector は既存 `DATABASE_URL` に接続する。

### 3. collectorをTrigger.dev task化する

対象候補:

- `apps/collector/src/trigger/news-collector.ts`
- `apps/collector/src/index.ts`
- `apps/collector/src/config.ts`
- `apps/collector/package.json`
- `trigger.config.ts`

方針:

- 既存 `runCollector()` を呼ぶ薄い adapter とし、収集ロジックを重複させない。
- task payload は最小限にし、通常設定は環境変数から読む。
- schedule payload の `timestamp`、`lastTimestamp`、`timezone` と Trigger.dev run ID をログに残す。
- task queue の `concurrencyLimit` は 1 とする。
- `Asia/Tokyo` の 08:00 / 20:00 を declarative schedule の初期値とする。
- task retry は feed 全体の一時障害向けに短く設定する。
- 記事単位の失敗は既存 collector が継続処理し、`failedCount` と `errorSummary` に残す。
- scheduled run の idempotency key は実行時刻単位とし、手動 replay/retry を妨げない設計にする。

### 4. GitHub Actionsを整備する

対象候補:

- `.github/workflows/ci.yml`
- `.github/workflows/deploy-trigger.yml`

PR CI:

- `pnpm install --frozen-lockfile`
- `pnpm format:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- Web 変更時の Playwright

`main` deploy:

- PR と同じ品質ゲートを通してから Trigger.dev task を deploy する。
- `TRIGGER_API_URL` と `TRIGGER_ACCESS_TOKEN` は GitHub Actions secrets から読む。
- Coolify の GitHub App auto deploy と deploy webhook を併用しない。

### 5. Coolify向けデプロイ定義を整備する

対象候補:

- `apps/web/Dockerfile` または Coolify の Nixpacks 設定
- `apps/collector/Dockerfile`
- `docker-compose.yml`
- `docs/server-deployment-runbook.md`

方針:

- Web app を Coolify application として build/deploy できるようにする。
- DB migration command を release step として明示し、失敗時は新アプリを昇格しない。
- collector を systemd 用 oneshot container として扱わない。
- Coolify managed database と既存 Compose database を二重管理しない手順にする。

### 6. runbookと旧手順を更新する

対象:

- `docs/server-deployment-runbook.md`
- `docs/manual-batch-verification.md`
- `deploy/systemd/`

次を記載する。

- Trigger.dev の手動実行、再実行、ログ確認、schedule 有効化・無効化。
- Coolify の deploy、rollback、migration、環境変数設定。
- Tailscale の公開ポートとアクセス制限。
- Upto PostgreSQL と Trigger.dev 内部 storage/database を分けた backup/restore。
- systemd timer 手順の legacy 表示と、安全な移行順序。

## 実施順序

1. ADR-0004 を作成し、Accepted 後に後続へ進む。
2. Trigger.dev self-hosted template、version pin、`.env.example`、secret 配置表を追加する。
3. collector の狭いテストを先に追加する。
4. Trigger.dev adapter、schedule、queue、retry、idempotency を実装する。
5. PR CI と Trigger.dev deploy workflow を追加する。
6. Coolify 向け build/deploy 定義と migration command を整備する。
7. runbook を更新する。
8. systemd timer 前提の docs / artifacts を legacy 化する。
9. ローカル検証を完了し、オンプレ構築へ引き渡す。

## オンプレ側への引き渡し物

- version pin 済み Trigger.dev Compose/config template。
- `.env.example` と secret 名・配置先の一覧。
- Web/collector の build/deploy 定義。
- レビュー済み Drizzle migration と適用手順。
- GitHub Actions workflow と必要な Actions secret 名。
- deploy、migration、rollback、retry、backup/restore の runbook。
- 小件数検証と受け入れ確認の手順。

## 受け入れ条件

- PR で format、lint、typecheck、unit test が自動実行される。
- Trigger.dev adapter が既存 `runCollector()` を再利用している。
- task と collector の同時実行数が初期値 1 に制限される。
- 同じ `normalized_url` の記事で重複行が増えず、要約済み記事を再要約しないテストがある。
- 単一記事失敗で batch 全体が停止しないテストがある。
- `crawl_jobs`、`articles.retry_count`、`error_summary` に履歴を残す既存要件を維持する。
- deploy 定義、migration、rollback、secret 配置、手動検証の runbook が揃っている。
- secrets が Git に含まれていない。

## 検証

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @upto/collector test
pnpm --filter @upto/collector typecheck
pnpm -r build
```

DB schema/migration を変更した場合のみ、隔離した検証 DB で migration を確認する。本番 DB への適用は本計画の範囲外とする。

## リスクと対策

| リスク                                                    | 対策                                                                                            |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Trigger.dev retry と collector 内リトライで過剰実行になる | task retry は短くし、記事単位失敗は DB status で追跡する。                                      |
| Gemini API quota を超える                                 | queue と collector concurrency を 1 にし、要約済み URL は再要約しない。                         |
| Trigger.dev 履歴と Upto DB 履歴が不一致になる             | Trigger.dev run ID を collector log に残し、必要なら別 ADR/migration で column 追加を判断する。 |
| Coolify と GitHub Actions が二重 deploy する              | Coolify GitHub App auto deploy か deploy webhook のどちらか一方を runbook で指定する。          |
| systemd 前提の古い手順で誤運用する                        | legacy 表示を追加し、新手順を runbook の先頭に置く。                                            |
