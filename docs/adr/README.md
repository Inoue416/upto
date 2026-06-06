# ADR 運用ルール

このディレクトリには Architecture Decision Record を Markdown で記録する。

## 基本方針

- ADR は append-only で運用する
- 採番は `0001-title.md` の形式にする
- 1 ADR には 1 つの主要な意思決定だけを書く
- 一度 `Accepted` にした ADR の本文は削除・上書きしない
- 誤記修正、補足、前提変更、撤回、置き換えは末尾の `追記` セクションに日付付きで追加する
- 意思決定が変わった場合は、新しい ADR を作成し、古い ADR の末尾に `Superseded by ADR-XXXX` を追記する

## ステータス

- `Proposed`: 提案中
- `Accepted`: 採用
- `Rejected`: 不採用
- `Deprecated`: 非推奨
- `Superseded`: 新しい ADR に置き換え済み

## ファイル命名

```txt
docs/adr/0001-technology-stack.md
docs/adr/0002-batch-scheduling.md
docs/adr/0003-database-hosting.md
```

タイトルは小文字英数字とハイフンを基本にする。

## ADR テンプレート

```md
# ADR-XXXX: タイトル

日付: YYYY-MM-DD
ステータス: Proposed | Accepted | Rejected | Deprecated | Superseded

## 背景

意思決定が必要になった背景を書く。

## 決定

採用する方針を書く。

## 理由

なぜその判断にしたかを書く。

## 影響

良い影響、制約、運用上の注意を書く。

## 代替案

検討したが採用しなかった案を書く。

## 追記

- YYYY-MM-DD: 追記内容。
```

## append-only の具体ルール

既存 ADR に対して許可する操作:

- ファイル末尾への追記
- ステータス変更履歴の末尾追記
- 新しい ADR から参照するための末尾追記

既存 ADR に対して避ける操作:

- 決定本文の削除
- 決定本文の意味を変える書き換え
- 過去の判断理由を現在の都合で修正すること
- ファイル名変更による履歴の断絶

誤字脱字の修正も原則として末尾の追記で扱う。読みづらさが大きい場合だけ、修正理由を同じコミットまたは作業ログで明示する。
