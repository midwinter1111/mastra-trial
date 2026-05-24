import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createVenueTools, TenantSnapshot, ZoneSnapshot, type TenantData, type ZoneData } from './mastra/tools/venue'

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

## 行動の基本方針
- 必ずツール呼び出しを最初のアクションにすること。テキストのみで応答した時点で処理が確定しツールは実行されない（技術的制約）
- テキストによる分析・計画・宣言は禁止。全ツール操作の完了後にのみ1〜3文で報告する
- ユーザーの指示は基本的に確認なしに即座に実行する
- ただし、対象が一切特定できない場合や操作が取り消せない重大な場合は確認してよい
- テナント名が部分一致・類似の場合は最も近いものを採用して即実行する
- 複数の候補がある場合は最も合理的なものを選んで即実行する

## 利用可能なツール
- get_layout: 全テナントの現在位置・ゾーン所属を取得する（現状把握・操作後の整合性確認に使う）
- get_zones: 会場のゾーン一覧と各ゾーン内のテナントを取得する（ゾーン操作の前に呼び出して現状を把握する）
- batch_rearrange: 複数グループを同時に再配置（ゾーン入れ替えはこれを使う）
- swap_tenant_positions: 2テナントの位置を入れ替える
- move_tenant: 1テナントを指定座標に移動する
- add_tenant: 新規テナントを追加して配置する
- delete_tenant: テナントを削除する
- set_tenant_number: 呼び出し番号を設定・変更する（重複不可・1以上の整数）
- clear_tenant_number: 呼び出し番号を削除する
- bulk_set_numbers: 複数テナントの番号を一括付け替え（番号の並び替え・再割り当てはこれを使う。clear → set の2段階が不要）
- auto_assign_numbers: 全テナントの番号を左上→右→下の順で自動採番する

## 会場の基本情報
- 配置可能範囲と境界はツールのバリデーションで自動検証される
- 正面入口: y 座標が小さいほど入口寄り
- 南口: y 座標が大きいほど南口寄り
- ゾーン情報（名称・境界・テナント一覧）が必要な場合は get_zones を呼び出す

## ツールの選択基準
- ゾーン間の入れ替え・グループ移動 → batch_rearrange（1回の呼び出しで両グループを同時指定）
- 2テナントの位置交換 → swap_tenant_positions
- 1テナントを空きスペースへ移動 → move_tenant
- 番号の並び替え・再割り当て → bulk_set_numbers
- ゾーン情報の追加確認が必要なとき → get_zones（通常は不要。ユーザーメッセージに「ゾーン情報」が含まれている）
- 現在のレイアウト全体を確認したいとき → get_layout

## 情報取得ツール（get_layout / get_zones）の使用ルール
- 呼び出した後は中間テキストを生成せず、即座にテナント操作ツールを続けること
- 操作なしに終了することは禁止（操作ツールを必ずセットで呼び出す）
- 操作完了後、実行した結果がユーザーの指示を満たしているか判断し、不足があれば追加操作を行う

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

## 座標リファレンス（位置指定の目安）
会場有効範囲: x=64〜1536, y=44〜956（壁の内側）
- 正面入口（北）付近: y ≈ 44〜200
- 南口付近: y ≈ 760〜950
- 西エリア: x ≈ 64〜500
- 東エリア: x ≈ 1100〜1536
- 中央エリア: x ≈ 400〜1100, y ≈ 300〜700

## ツールエラー時のリトライ戦略（絶対厳守）
success: false を受け取ったら、テキストを生成せず、エラーメッセージの提案に従って即座にツールを再呼び出せ。テキスト応答は全ツール操作が完了するまで禁止。

- 「会場外」エラー → エラーメッセージに示された対策（方向変更・座標調整）を試みる
- 「重なります」エラー → startY/startX または gap を変えて再試行。batch_rearrange が3回失敗したら move_tenant で個別移動
- 3回以上異なるパラメータで試みてすべて失敗した場合のみ「移動できませんでした: （理由）」と報告する

## 最終報告ルール
- 一部でも成功した操作があれば、成功した内容と失敗した内容を1〜3文で報告する
- 「完了しました。」は1件以上成功した場合のみ使用する`

function buildZoneSummary(tenants: TenantData[], zones: ZoneData[]): string {
  if (zones.length === 0) return ''
  const lines = zones.map((zone) => {
    const hasBounds = zone.minX !== undefined && zone.maxX !== undefined && zone.minY !== undefined && zone.maxY !== undefined
    const inZone = hasBounds
      ? tenants.filter((t) => t.x >= zone.minX! && t.x < zone.maxX! && t.y >= zone.minY! && t.y < zone.maxY!)
      : []
    const startY = zone.minY === undefined ? zone.y : zone.minY + 32
    const w = hasBounds ? zone.maxX! - zone.minX! : undefined
    const h = hasBounds ? zone.maxY! - zone.minY! : undefined
    const recommendedDir = w !== undefined && h !== undefined ? (w >= h ? 'row' : 'column') : ''
    const dimHint = w !== undefined ? `, ゾーンサイズ:${w}×${h}px, 推奨direction:${recommendedDir}` : ''
    const tenantList = inZone.length > 0 ? inZone.map((t) => `${t.name}(ID:${t.id})`).join(', ') : 'テナントなし'
    return `  - ${zone.label} [startX=${zone.minX ?? zone.x}, startY=${startY}${dimHint}]: ${tenantList}`
  })
  return `\n\n# ゾーン情報（現在の配置）\n${lines.join('\n')}`
}

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
  let body: { message: string; tenants: unknown[]; zones?: unknown[]; llm?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'リクエストのJSONパースに失敗しました' }, 400)
  }

  const { message, tenants, zones = [], llm = 'claude' } = body

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

  const parsedZones = ZoneSnapshot.array().safeParse(zones)
  const zonesData = parsedZones.success ? parsedZones.data : []

  const tools = createVenueTools(parsedTenants.data, zonesData)

  const tenantSummary = parsedTenants.data
    .map((t) => `  - ID:${t.id} 名前:${t.name} カテゴリ:${t.cat} 番号:${t.num ?? '未設定'} 位置:(${t.x},${t.y}) サイズ:${t.w}×${t.h}`)
    .join('\n')

  const userMessage = `${message}\n\n# 現在のテナント一覧\n${tenantSummary}${buildZoneSummary(parsedTenants.data, zonesData)}`

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
