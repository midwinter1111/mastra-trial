import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { TenantSnapshot, ZoneSnapshot, type TenantData, type ZoneData } from './mastra/tools/venue'
import { createVenueAgent } from './mastra/agents/venue'

const PORT = 4111

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

  // llm フィールドはUI互換のため受け付けるが無視する（Claude固定）
  const { message, tenants, zones = [] } = body

  if (!message || !Array.isArray(tenants)) {
    return c.json({ error: 'message と tenants は必須です' }, 400)
  }

  const parsedTenants = TenantSnapshot.array().safeParse(tenants)
  if (!parsedTenants.success) {
    return c.json({ error: 'テナントデータの形式が不正です' }, 400)
  }

  const parsedZones = ZoneSnapshot.array().safeParse(zones)
  const zonesData = parsedZones.success ? parsedZones.data : []

  const agent = createVenueAgent(parsedTenants.data, zonesData)

  const tenantSummary = parsedTenants.data
    .map((t) => `  - ID:${t.id} 名前:${t.name} カテゴリ:${t.cat} 番号:${t.num ?? '未設定'} 位置:(${t.x},${t.y}) サイズ:${t.w}×${t.h}`)
    .join('\n')

  const userMessage = `${message}\n\n# 現在のテナント一覧\n${tenantSummary}${buildZoneSummary(parsedTenants.data, zonesData)}`

  try {
    const result = await agent.generate(
      [{ role: 'user', content: userMessage }],
      { maxSteps: 15 },
    )

    const steps = result.steps ?? []
    console.log(`[Chat] steps=${steps.length} finishReason=${result.finishReason}`)
    for (const [i, step] of steps.entries()) {
      const calls = step.toolCalls?.map((c) => c.payload.toolName).join(', ') || '(none)'
      const results = step.toolResults?.map((r) => `${r.payload.toolName}:${(r.payload.result as { success?: boolean })?.success}`).join(', ') || '(none)'
      console.log(`  step[${i}] calls=[${calls}] results=[${results}]`)
    }

    const allToolResults: Array<{ toolName: string; result: unknown }> = []
    for (const step of steps) {
      for (const tr of step.toolResults ?? []) {
        allToolResults.push({ toolName: tr.payload.toolName, result: tr.payload.result })
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

app.get('/health', (c) => c.json({ status: 'ok' }))

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`Mastra Backend: http://localhost:${PORT}`)
  console.log('  モデル: claude-sonnet-4-6')
  console.log(`  ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? '✅ 設定済み' : '❌ 未設定'}`)
})
