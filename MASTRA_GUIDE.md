# Mastra 活用ガイド
## 会場設営アプリ × AI Agent

---

## 1. Mastra を利用するための準備手順

### 前提条件

| ツール | バージョン |
|---|---|
| Node.js | v20.0.0 以上 |
| pnpm | v10.0.0 以上 |

### ステップ 1：環境変数の設定

PC の環境変数に使用する LLM の API キーを設定します。

```powershell
# Windows（PowerShell）— システム環境変数に設定する場合
[System.Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY", "sk-ant-...", "User")
[System.Environment]::SetEnvironmentVariable("OPENAI_API_KEY", "sk-...", "User")
[System.Environment]::SetEnvironmentVariable("GOOGLE_GENERATIVE_AI_API_KEY", "AIza...", "User")
```

> Claude のみ使う場合は `ANTHROPIC_API_KEY` のみ設定すれば OK です。

### ステップ 2：依存パッケージのインストール

**Mastra バックエンド**

```bash
cd mastra-backend
pnpm run ci
```

**Vue.js フロントエンド**

```bash
cd venue-map
pnpm run ci
```

### ステップ 3：起動（2つのターミナルが必要）

**ターミナル A：Mastra バックエンド**

```bash
cd mastra-backend
pnpm start
# → http://localhost:4111 で起動
```

**ターミナル B：Vue.js フロントエンド**

```bash
cd venue-map
pnpm start
# → http://localhost:3000 で起動
```

### ステップ 4：動作確認

ブラウザで `http://localhost:3000` を開き、トップバーの **AI** ボタンをクリックするとチャットパネルが開きます。

---

## 2. 会場設営アプリの操作と呼ばれるデータ操作関数

### テナントのレイアウト変更

マップ上でテナントをドラッグ＆ドロップして位置を変更する操作です。

```
[ユーザー操作] マップ上でテナントをドラッグ
       ↓
MapCanvas.vue — onTenantDown() / move イベント
       ↓
useTenantsStore().moveTenants(updates)
       ↓
  tenants.value を更新（x, y 座標を変更）
       ↓
persist() → localStorage に保存
```

**呼び出される関数：**

| ファイル | 関数名 | 処理内容 |
|---|---|---|
| [MapCanvas.vue](venue-map/src/components/MapCanvas.vue#L305) | `onTenantDown()` | ポインターイベントでドラッグ開始を検知 |
| [stores/tenants.ts](venue-map/src/stores/tenants.ts#L55) | `moveTenants(updates)` | 複数テナントの x, y 座標を一括更新 |
| [stores/tenants.ts](venue-map/src/stores/tenants.ts#L27) | `persist()` | 更新後の状態を localStorage に保存 |

```typescript
// stores/tenants.ts
function moveTenants(updates: Record<string, { x: number; y: number }>) {
  if (!moveBuffer) {
    pushHistory()  // アンドゥ用スナップショットを保存
    moveBuffer = setTimeout(() => { moveBuffer = null }, 250)
  }
  tenants.value = tenants.value.map((t) =>
    updates[t.id] ? { ...t, ...updates[t.id] } : t
  )
  persist()
}
```

---

### テナントの呼び出し番号変更

番号ツール（N キー）でスワイプしてテナントに番号を付与する操作です。

```
[ユーザー操作] 番号ツールでテナントをなぞる
       ↓
MapCanvas.vue — beginSweep() → addToTrail()
       ↓
useTenantsStore().assignNumbers(assignments)
       ↓
  tenants.value の num フィールドを更新
       ↓
persist() → localStorage に保存
```

**呼び出される関数：**

| ファイル | 関数名 | 処理内容 |
|---|---|---|
| [MapCanvas.vue](venue-map/src/components/MapCanvas.vue#L209) | `beginSweep()` | スワイプ操作でテナントを順番に収集 |
| [MapCanvas.vue](venue-map/src/components/MapCanvas.vue#L212) | `addToTrail()` | なぞったテナントをトレイルに追加し次番号を計算 |
| [stores/tenants.ts](venue-map/src/stores/tenants.ts#L108) | `assignNumbers(assignments)` | 指定テナントに番号を一括設定 |

```typescript
// stores/tenants.ts
function assignNumbers(assignments: Array<{ id: string; num: number }>) {
  pushHistory()  // アンドゥ用スナップショットを保存
  const map: Record<string, number> = {}
  assignments.forEach(({ id, num }) => { map[id] = num })
  tenants.value = tenants.value.map((t) =>
    map[t.id] !== undefined ? { ...t, num: map[t.id] } : t
  )
  persist()
}
```

---

## 3. Mastra でのツール定義

Mastra のツールは `createTool()` で定義します。入力スキーマ（Zod）、説明文、実行関数の 3 点がポイントです。

### ツール 1：テナントのレイアウト変更（位置の入れ替え）

```typescript
// mastra-backend/src/mastra/tools/venue.ts
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export const swapTenantPositions = createTool({
  // ① ツールの識別子（AI がツールを呼ぶときの名前）
  id: 'swap_tenant_positions',

  // ② AI に渡すツールの説明（これを読んで AI がいつ使うかを判断）
  description:
    '指定した2つのテナントの配置位置（x, y 座標とサイズ）を入れ替えます。テナントは名前の一部または番号で指定します。',

  // ③ 入力スキーマ（Zod で型安全に定義）
  inputSchema: z.object({
    tenantA: z.string().describe('1つ目のテナント（名前の一部または呼び出し番号）'),
    tenantB: z.string().describe('2つ目のテナント（名前の一部または呼び出し番号）'),
    tenants: z.array(TenantSnapshot).describe('現在配置されているテナントの一覧'),
  }),

  // ④ 実行関数（AI がツールを選んだときに呼ばれる）
  execute: async ({ tenantA, tenantB, tenants }) => {
    const a = findTenant(tenantA, tenants)
    const b = findTenant(tenantB, tenants)

    if (!a || !b) return { success: false, updates: [], message: '...' }

    // 2 テナントの x, y, w, h を入れ替えた更新データを返す
    return {
      success: true,
      updates: [
        { id: a.id, x: b.x, y: b.y, w: b.w, h: b.h },
        { id: b.id, x: a.x, y: a.y, w: a.w, h: a.h },
      ],
      message: `「${a.name}」と「${b.name}」の位置を入れ替えました`,
    }
  },
})
```

**フロントエンド側での反映（AiChat.vue）：**

```typescript
// ツール実行結果（tool result）を受け取ってストアに反映
if (tr.toolName === 'swap_tenant_positions' && tr.result?.success) {
  const updateMap = Object.fromEntries(
    tr.result.updates.map((u) => [u.id, { x: u.x, y: u.y, w: u.w, h: u.h }])
  )
  tenantsStore.updateTenants((prev) =>
    prev.map((t) => (updateMap[t.id] ? { ...t, ...updateMap[t.id] } : t))
  )
}
```

---

### ツール 2：テナントの呼び出し番号変更（自動採番）

```typescript
export const autoAssignNumbers = createTool({
  // ① ツールの識別子
  id: 'auto_assign_numbers',

  // ② AI に渡すツールの説明
  description:
    '全テナントの呼び出し番号を、左上から右・下の順（行優先）で自動的に振り直します。',

  // ③ 入力スキーマ
  inputSchema: z.object({
    startFrom: z.number().default(1).describe('開始番号（デフォルト: 1）'),
    tenants: z.array(TenantSnapshot).describe('番号を振り直す対象のテナント一覧'),
  }),

  // ④ 実行関数
  execute: async ({ startFrom = 1, tenants }) => {
    // 縦 40px 以内を「同じ行」とみなし、行優先・列順にソート
    const ROW_TOLERANCE = 40
    const sorted = [...tenants].sort((a, b) => {
      const rowA = Math.round(a.y / ROW_TOLERANCE)
      const rowB = Math.round(b.y / ROW_TOLERANCE)
      return rowA !== rowB ? rowA - rowB : a.x - b.x
    })

    const assignments = sorted.map((t, i) => ({ id: t.id, num: startFrom + i }))

    return {
      success: true,
      assignments, // [{ id: 't01', num: 1 }, { id: 't02', num: 2 }, ...]
      message: `${assignments.length} 件に番号を割り当てました`,
    }
  },
})
```

**フロントエンド側での反映（AiChat.vue）：**

```typescript
if (tr.toolName === 'auto_assign_numbers' && tr.result?.success) {
  // assignNumbers() は既存の Pinia アクションをそのまま使う
  tenantsStore.assignNumbers(tr.result.assignments)
}
```

---

## 4. 全体のデータフロー

```
[ユーザー] 自然言語で指示（例：「3番と7番を入れ替えて」）
    ↓
[AiChat.vue] POST /api/chat
  body: { message, tenants: [...], llm: 'claude' }
    ↓
[Vite Proxy] http://localhost:4111/api/chat に転送
    ↓
[Mastra Backend] agentMap[llm].generate(messages)
    ↓
[LLM] ツールを選択して呼び出す
  → swap_tenant_positions({ tenantA: "3", tenantB: "7", tenants: [...] })
    ↓
[Tool: swap_tenant_positions] テナントを特定して座標を入れ替え
  → { success: true, updates: [{ id, x, y, w, h }, ...] }
    ↓
[Mastra Backend] レスポンスを返す
  → { message: "入れ替えました", toolResults: [...] }
    ↓
[AiChat.vue] ツール結果を受け取り Store に反映
  → tenantsStore.updateTenants(...)
    ↓
[Pinia Store] tenants.value を更新 → localStorage に保存
    ↓
[MapCanvas.vue] Vue の reactivity で自動的に再描画
```

---

## 5. 従来の自動化との比較

| 項目 | 従来（Playwright 等） | Mastra による AI Store 操作 |
|---|---|---|
| 操作対象 | DOM（HTMLの見た目） | State（Pinia Storeの状態） |
| アプローチ | 命令型（手順を事前に固定） | 目的型（ゴールに応じて手順を自動生成） |
| 変化への強さ | 画面デザイン変更で壊れやすい | 内部ロジック・状態が変わらなければ壊れにくい |
| 安全性 | 想定外の UI 操作が起きうる | Tool として公開した限定操作に縛れる |
| 主な用途 | テスト自動化・スクレイピング | AI 支援業務操作 |

---

## 6. ディレクトリ構成

```
mastra-trial/
├── mastra-backend/                 ← Mastra バックエンドサーバー
│   ├── package.json
│   └── src/
│       ├── index.ts               ← Hono サーバー（ポート 4111）
│       └── mastra/
│           ├── index.ts           ← Mastra インスタンス
│           ├── agents/
│           │   └── venue.ts       ← Claude / ChatGPT / Gemini エージェント
│           └── tools/
│               └── venue.ts       ← swap_tenant_positions / auto_assign_numbers
└── venue-map/                      ← Vue.js フロントエンド
    └── src/
        ├── stores/
        │   └── ai.ts              ← AI パネルの状態管理
        └── components/
            └── AiChat.vue         ← AI チャットパネル
```
