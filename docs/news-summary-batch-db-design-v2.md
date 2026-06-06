# ニュース要約アプリ 設計書

## 追加UI要件（PC版）

モバイルでは縦スワイプで記事カードを切り替える。

PC版ではスワイプ操作が存在しないため、**マウスホイール・トラックパッドスクロールをスワイプとして扱う**。

### PC UX方針

- 1スクロール = 1カード移動を基本とする
- TikTok / YouTube Shorts / Instagram Reels に近い体験を目指す
- ホイールスクロール時にスナップする
- トラックパッドの慣性スクロールにも対応する
- キーボード操作にも対応する
  - ↑ : 前の記事
  - ↓ : 次の記事
  - Space : 次の記事
  - Shift + Space : 前の記事

### 実装イメージ

```txt
スクロール
↓
スクロール量を監視
↓
閾値到達
↓
次カードへアニメーション
↓
スクロール位置をスナップ
```

### Web実装候補

```css
.container {
  scroll-snap-type: y mandatory;
}

.card {
  scroll-snap-align: start;
}
```

### UIレイアウト

```txt
┌───────────────────────────────┐
│ 記事タイトル                  │
│                               │
│ 要約                          │
│                               │
│ ・ポイント1                   │
│ ・ポイント2                   │
│ ・ポイント3                   │
│                               │
│ 元記事を読む                  │
│                               │
│      ↓ スクロール             │
└───────────────────────────────┘
```

---

## DB設計

### 主テーブル

- sources
- feed_endpoints
- crawl_jobs
- articles
- article_contents
- article_summaries
- article_metrics

### ER構成

```txt
sources
  └─ feed_endpoints
       └─ crawl_jobs

sources
  └─ articles
       ├─ article_contents
       ├─ article_summaries
       └─ article_metrics
```

---

## データ取得対象

### Phase 1

- Zenn
- Qiita
- はてなブックマーク IT

### Phase 2

- Hacker News
- GitHub Blog

### Phase 3

- 企業テックブログ
- GitHub Releases
- DEV Community

---

## バッチ処理方針

```txt
RSS/API取得
↓
URL正規化
↓
重複排除
↓
本文抽出
↓
Gemini要約
↓
スコア計算
↓
DB保存
```

### 要約モデル

通常記事:

- Gemini 2.5 Flash-Lite

重要記事:

- Gemini 2.5 Flash

### 長文記事

```txt
本文抽出
↓
見出し単位で分割
↓
チャンク要約
↓
統合要約
↓
DB保存
```

### フォールバック

```txt
本文抽出失敗
↓
RSS概要のみ表示

または

Gemini URL Context
```

---

## MVP目標

- 日本語IT記事を高速に収集
- Geminiで自動要約
- 縦スワイプ型UI
- PCではスクロール＝スワイプ体験
- トレンド順表示
- 元記事への導線を提供
