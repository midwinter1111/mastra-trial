# VenueMap Marché

イベント会場の設営・運営を支援する Web アプリ。

## セットアップ

```bash
pnpm run ci
pnpm start
```

## 環境変数

`.env.example` をコピーして `.env.local` を作成してください。

```bash
cp .env.example .env.local
```

`VITE_ANTHROPIC_API_KEY` を設定すると、テナント情報の AI 自動補完機能が有効になります。

**未設定でも AI 以外の全機能は動作します。**

### Windows PowerShell でシェルから注入する場合

```powershell
$env:VITE_ANTHROPIC_API_KEY=$env:ANTHROPIC_API_KEY; pnpm start
```

### macOS / Linux

```bash
VITE_ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY pnpm start
```

## セキュリティ注意事項

- `.env.local` は `.gitignore` に含まれており、リポジトリにコミットされません
- API キーはブラウザの環境変数 (`import.meta.env`) 経由でのみ参照します
- **本番環境ではブラウザから直接 Claude API を呼ぶ実装は使用せず、サーバーサイドプロキシを経由してください**（`services/claude.ts` の `dangerouslyAllowBrowser: true` オプション参照）

## 既知の制約

- `localStorage` のみを使用（バックエンドなし）
- ブラウザから直接 Claude API を呼ぶ PoC 実装（本番環境ではサーバーサイド経由を推奨）
- リアルタイム同期なし（単一ユーザー想定）

## 主要機能

- **設営モード**: テナント配置・移動・リサイズ、グリッド吸着
- **運営モード**: 呼び出し番号付与（なぞり連番 / 数字パッド / 直接入力）
- **Tweaks パネル**: テーマ・表示切替（右下の ⚙ ボタン）
- **Undo / Redo**: Ctrl+Z / Ctrl+Shift+Z
- **Claude AI**: テナント名からカテゴリ・サイズ・メモを自動補完（編集モーダルの ✨ ボタン）
