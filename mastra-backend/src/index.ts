import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createVenueTools, TenantSnapshot } from './mastra/tools/venue'

const PORT = 4111

const anthropicProvider = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? process.env.VITE_ANTHROPIC_API_KEY ?? '',
})
const openaiProvider = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? process.env.VITE_OPENAI_API_KEY ?? '',
})
const googleProvider = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.VITE_GOOGLE_GENERATIVE_AI_API_KEY ?? '',
})

const modelMap = {
  claude: anthropicProvider('claude-sonnet-4-6'),
  openai: openaiProvider('gpt-4o'),
  gemini: googleProvider('gemini-2.0-flash'),
} as const

type LLMKey = keyof typeof modelMap

const SYSTEM_PROMPT = `あなたはイベント会場の設営・運営をサポートするAIアシスタントです。

## 応答の絶対ルール（最優先）
- テキストによる分析・計画・説明は禁止。必ずツール呼び出しを先に行い、すべて完了後に1〜3文で結果を報告する
- 「〇〇しようと思います」「〇〇します」のような宣言文は書かない。直接ツールを実行する
- ユーザーの指示は確認や質問なしに即座に実行する

## 利用可能なツール
- batch_rearrange: 複数グループを同時に再配置（ゾーン入れ替えはこれを使う）
- swap_tenant_positions: 2テナントの位置を入れ替える
- move_tenant: 1テナントを指定座標に移動する
- add_tenant: 新規テナントを追加して配置する
- delete_tenant: テナントを削除する
- set_tenant_number: 呼び出し番号を設定・変更する（重複不可・1以上の整数）
- clear_tenant_number: 呼び出し番号を削除する
- bulk_set_numbers: 複数テナントの番号を一括付け替え（番号の並び替え・再割り当てはこれを使う。clear → set の2段階が不要）
- auto_assign_numbers: 全テナントの番号を左上→右→下の順で自動採番する

## 会場ゾーン定義（重要）
| ゾーン | 名称 | X範囲 | Y範囲 | 代表座標 |
|--------|------|--------|--------|----------|
| Aゾーン | フードエリア | 140〜860 | 168〜480 | startX=140, startY=200 |
| Bゾーン | メインステージ | 900〜1180 | 168〜420 | startX=900, startY=200 |
| Cゾーン | 物販エリア | 1280〜1536 | 168〜760 | startX=1280, startY=200 |
| Dゾーン | ワークショップ | 600〜1000 | 548〜760 | startX=600, startY=580 |
| Eゾーン | ポップアップ | 140〜380 | 548〜760 | startX=140, startY=580 |

有効配置エリア: x=64〜1536, y=44〜956（壁の内側）
正面入口: x=740, y=30付近（y が小さいほど入口寄り）
南口: x=740, y=956付近（y が大きいほど南口寄り。南口近くに移動するには startY=800〜856 付近を使う）

## ツールの選択基準
- ゾーン間の入れ替え・グループ移動 → batch_rearrange（1回の呼び出しで両グループを同時指定）
- 2テナントの位置交換 → swap_tenant_positions
- 1テナントを空きスペースへ移動 → move_tenant

## 複数テナントの配置方向ルール（重要）
- 縦並び（direction:'column'）は少数（〜3件）のみ。テナント1件あたり高さ+gapが必要なため、南口付近（y≥800）では3件以上で会場外エラーが必ず発生する
- 4件以上を南口付近に配置する場合は必ず direction:'row'（横並び）を使う
- 8件横並びの例: startX=140, startY=820, direction:'row', gap=20 → 幅約1100px、y=820〜920で会場内に収まる

## ツールエラー時のリトライ戦略（絶対厳守）
success: false を受け取ったら、テキストを生成せず、即座に次のいずれかのツール呼び出しを実行せよ。テキスト応答は全ツール操作が完了するまで禁止。

### 「会場外」エラー → 方向転換が最優先
1. direction が 'column' の場合 → 'row' に切り替えて同じ startX/startY で即再試行
2. 'row' でも会場外 → startX を 64 に近づけるか startY を 750〜820 の範囲で調整して再試行

### 「重なります」エラー → 座標調整
1. startY を ±120〜200 変えて再試行
2. gap を 20 → 60 → 140 と段階的に拡大して再試行
3. batch_rearrange が3回失敗 → move_tenant で1件ずつ個別に移動

### 諦める条件（3回以上異なるパラメータで試みてすべて失敗した場合のみ）
「移動できませんでした: （理由）」と報告する

## カテゴリ定義（テナント一覧の cat フィールド）
| cat値 | 表示名 | ユーザーが使う言葉 |
|-------|--------|------------------|
| food | 飲食 | 飲食、フード、食べ物、料理 |
| drink | ドリンク | ドリンク、飲み物、お酒、カフェ |
| goods | 物販 | 物販、グッズ、雑貨、ショップ |
| service | サービス | サービス、体験、ワークショップ |
| stage | ステージ | ステージ |
| info | インフォ | インフォ、案内、救護 |

カテゴリの絞り込みルール:
- 「飲食テナント」→ cat='food' のみ（ドリンクは含まない）
- 「ドリンクテナント」→ cat='drink' のみ
- 「飲食・ドリンク」「食べ物・飲み物系」と明示された場合のみ両カテゴリを対象にする

## テナントの自律的な特定
- ゾーン名（Aゾーン・フードエリアなど）→ 上記の定義から座標範囲を確認してそのゾーン内のテナントを対象にする
- テナント名が部分一致・類似 → 最も近い名前を採用して実行
- 「入口近く」→ y が最小、「南口近く」「奥」→ y=800〜856 付近
- 複数候補 → 最も合理的なものを選んで即実行

## 最終報告ルール
- 一部でも成功した操作があれば、成功した内容と失敗した内容を1〜3文で報告する
- 「完了しました。」は1件以上成功した場合のみ使用する

## 質問・確認をしてよい唯一の例外
テナント名・番号・位置・ゾーンの手がかりが一切なく、どう解釈しても対象を特定できない場合のみ質問する。`

function buildFallbackText(toolResults: Array<{ toolName: string; result: unknown }>): string {
  type ToolResult = { success?: boolean; message?: string }
  const successes = toolResults.filter((tr) => (tr.result as ToolResult)?.success)
  if (successes.length > 0) {
    return successes
      .map((tr) => (tr.result as ToolResult)?.message)
      .filter(Boolean)
      .join('\n')
  }
  const failures = toolResults.filter((tr) => !(tr.result as ToolResult)?.success)
  if (failures.length > 0) {
    const reasons = failures
      .map((tr) => (tr.result as ToolResult)?.message)
      .filter(Boolean)
      .join(', ')
    return `操作に失敗しました: ${reasons}`
  }
  return '操作を完了しました。'
}

const app = new Hono()

app.use('*', cors({ origin: '*' }))

app.post('/api/chat', async (c) => {
  let body: { message: string; tenants: unknown[]; llm?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'リクエストのJSONパースに失敗しました' }, 400)
  }

  const { message, tenants, llm = 'claude' } = body

  if (!message || !Array.isArray(tenants)) {
    return c.json({ error: 'message と tenants は必須です' }, 400)
  }

  if (!(llm in modelMap)) {
    return c.json({ error: `未対応のLLMです: ${llm}` }, 400)
  }

  const parsedTenants = TenantSnapshot.array().safeParse(tenants)
  if (!parsedTenants.success) {
    return c.json({ error: 'テナントデータの形式が不正です' }, 400)
  }

  const tools = createVenueTools(parsedTenants.data)

  const tenantSummary = parsedTenants.data
    .map((t) => `  - ID:${t.id} 名前:${t.name} カテゴリ:${t.cat} 番号:${t.num ?? '未設定'} 位置:(${t.x},${t.y}) サイズ:${t.w}×${t.h}`)
    .join('\n')

  const userMessage = `${message}\n\n# 現在のテナント一覧\n${tenantSummary}`

  try {
    const result = await generateText({
      model: modelMap[llm as LLMKey],
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      tools,
      maxSteps: 15,
    })

    console.log(`[Chat] steps=${result.steps.length} finishReason=${result.finishReason}`)
    for (const [i, step] of result.steps.entries()) {
      const calls = step.toolCalls?.map((c) => c.toolName).join(', ') || '(none)'
      const results = step.toolResults?.map((r) => `${r.toolName}:${(r.output as { success?: boolean })?.success}`).join(', ') || '(none)'
      console.log(`  step[${i}] calls=[${calls}] results=[${results}]`)
    }

    const allToolResults: Array<{ toolName: string; result: unknown }> = []
    for (const step of result.steps) {
      for (const tr of step.toolResults) {
        allToolResults.push({ toolName: tr.toolName, result: tr.output })
      }
    }

    console.log(`[Chat] toolResults count=${allToolResults.length}`)

    const responseText = result.text || buildFallbackText(allToolResults)

    return c.json({ message: responseText, toolResults: allToolResults })
  } catch (e) {
    console.error('[Chat] generate error:', e)
    const detail = e instanceof Error ? e.message : String(e)
    return c.json({ error: 'AI処理中にエラーが発生しました', detail }, 500)
  }
})

app.get('/health', (c) => c.json({ status: 'ok', llms: Object.keys(modelMap) }))

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`Mastra Backend: http://localhost:${PORT}`)
  console.log('  対応LLM: claude / openai / gemini')
  console.log('  環境変数チェック:')
  console.log(`    ANTHROPIC_API_KEY             : ${process.env.ANTHROPIC_API_KEY ? '✅ 設定済み' : '❌ 未設定'}`)
  console.log(`    OPENAI_API_KEY                : ${process.env.OPENAI_API_KEY ? '✅ 設定済み' : '❌ 未設定'}`)
  console.log(`    GOOGLE_GENERATIVE_AI_API_KEY  : ${process.env.GOOGLE_GENERATIVE_AI_API_KEY ? '✅ 設定済み' : '❌ 未設定'}`)
})
