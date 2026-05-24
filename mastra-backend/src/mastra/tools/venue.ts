import { tool, jsonSchema } from 'ai'
import { z } from 'zod'

export const ZoneSnapshot = z.object({
  label: z.string(),
  x: z.number(),
  y: z.number(),
  minX: z.number().optional(),
  maxX: z.number().optional(),
  minY: z.number().optional(),
  maxY: z.number().optional(),
})

export type ZoneData = z.infer<typeof ZoneSnapshot>

export const TenantSnapshot = z.object({
  id: z.string(),
  name: z.string(),
  cat: z.string(),
  num: z.number().nullable(),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
})

export type TenantData = z.infer<typeof TenantSnapshot>

// 会場の有効配置エリア（壁の内側）
const BOUNDS = { minX: 64, minY: 44, maxX: 1536, maxY: 956 }

function findTenant(query: string, tenants: TenantData[]) {
  const byId = tenants.find((t) => t.id === query)
  if (byId) return byId
  const num = Number.parseInt(query, 10)
  if (!Number.isNaN(num)) {
    return tenants.find((t) => t.num === num)
  }
  return tenants.find((t) => t.name.includes(query))
}

function checkBounds(x: number, y: number, w: number, h: number): string | null {
  if (x < BOUNDS.minX || y < BOUNDS.minY || x + w > BOUNDS.maxX || y + h > BOUNDS.maxY) {
    return `会場外に配置できません。有効範囲: x=${BOUNDS.minX}〜${BOUNDS.maxX - w}, y=${BOUNDS.minY}〜${BOUNDS.maxY - h}`
  }
  return null
}

function checkOverlap(x: number, y: number, w: number, h: number, tenants: TenantData[], excludeId?: string): TenantData | undefined {
  return tenants.find((t) => {
    if (t.id === excludeId) return false
    return x < t.x + t.w && x + w > t.x && y < t.y + t.h && y + h > t.y
  })
}

type Rect = { x: number; y: number; w: number; h: number }

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function layoutGroup(
  queries: string[],
  startX: number,
  startY: number,
  direction: 'row' | 'column',
  gap: number,
  tenants: TenantData[],
): { updates: Array<{ id: string; x: number; y: number }>; label: string } | { error: string } {
  const resolved = queries.map((q) => findTenant(q, tenants)).filter((t): t is TenantData => t !== undefined)
  if (resolved.length === 0) return { error: `テナントが見つかりません: ${queries.join(', ')}` }

  const updates: Array<{ id: string; x: number; y: number }> = []
  let curX = startX
  let curY = startY

  for (const t of resolved) {
    const boundsErr = checkBounds(curX, curY, t.w, t.h)
    if (boundsErr) {
      const suggestion = direction === 'column'
        ? ` 対策: direction='row'（横並び）に変更して再試行してください。`
        : ` 対策: direction='column'（縦並び）に変更するか、startX を小さくして再試行してください。`
      return { error: `「${t.name}」: ${boundsErr}${suggestion}` }
    }
    updates.push({ id: t.id, x: curX, y: curY })
    if (direction === 'row') curX += t.w + gap
    else curY += t.h + gap
  }

  const label = `${resolved.map((t) => t.name).join('・')} → (${startX}, ${startY}) ${direction === 'row' ? '横並び' : '縦並び'}`
  return { updates, label }
}

function validateBatchUpdates(
  allUpdates: Array<{ id: string; x: number; y: number }>,
  movedIds: Set<string>,
  tenants: TenantData[],
): string | null {
  const getSize = (id: string) => tenants.find((t) => t.id === id)!

  for (const u of allUpdates) {
    const t = getSize(u.id)
    const uRect: Rect = { x: u.x, y: u.y, w: t.w, h: t.h }
    const clash = tenants.find((other) => !movedIds.has(other.id) && rectsOverlap(uRect, other))
    if (clash) return `「${t.name}」の移動先が「${clash.name}」と重なります。startX/startY または gap を調整してください。`
  }

  for (let i = 0; i < allUpdates.length; i++) {
    for (let j = i + 1; j < allUpdates.length; j++) {
      const a = allUpdates[i]
      const b = allUpdates[j]
      const ta = getSize(a.id)
      const tb = getSize(b.id)
      if (rectsOverlap({ x: a.x, y: a.y, w: ta.w, h: ta.h }, { x: b.x, y: b.y, w: tb.w, h: tb.h })) {
        return `「${ta.name}」と「${tb.name}」の配置先が重なります。gap を大きくしてください。`
      }
    }
  }
  return null
}

export function createVenueTools(tenants: TenantData[], zones: ZoneData[] = []) {
  return {
    get_layout: tool({
      description: '現在の会場レイアウトを取得します。全テナントの位置・ゾーン所属・番号を確認でき、操作前の状態把握や指示との整合性確認に使います。',
      inputSchema: jsonSchema<Record<string, never>>({ type: 'object', properties: {} }),
      execute: async () => {
        const zoneOf = (t: TenantData): string => {
          if (zones.length === 0) return '未分類'
          const z = zones.find(
            (zone) =>
              zone.minX !== undefined &&
              zone.maxX !== undefined &&
              zone.minY !== undefined &&
              zone.maxY !== undefined &&
              t.x >= zone.minX &&
              t.x < zone.maxX &&
              t.y >= zone.minY &&
              t.y < zone.maxY,
          )
          return z?.label ?? 'ゾーン外'
        }

        const layout = tenants.map((t) => ({
          id: t.id,
          name: t.name,
          cat: t.cat,
          num: t.num,
          x: t.x,
          y: t.y,
          zone: zoneOf(t),
        }))

        const zoneCounts = zones.map((z) => {
          const count = layout.filter((t) => t.zone === z.label).length
          return `${z.label}: ${count}件`
        })

        return {
          success: true,
          tenants: layout,
          summary: `${tenants.length}件配置中。${zoneCounts.join('、')}`,
        }
      },
    }),

    get_zones: tool({
      description: '会場のゾーン一覧を返します。各ゾーンの名称・境界座標・現在配置されているテナントを確認できます。ゾーン操作の前に呼び出して現状を把握してください。',
      inputSchema: jsonSchema<Record<string, never>>({ type: 'object', properties: {} }),
      execute: async () => {
        if (zones.length === 0) {
          return { success: false, message: 'ゾーン情報が提供されていません。' }
        }
        const result = zones.map((zone) => {
          const inZone = (zone.minX !== undefined && zone.maxX !== undefined && zone.minY !== undefined && zone.maxY !== undefined)
            ? tenants.filter((t) => t.x >= zone.minX! && t.x < zone.maxX! && t.y >= zone.minY! && t.y < zone.maxY!)
            : []
          return {
            label: zone.label,
            bounds: { minX: zone.minX, maxX: zone.maxX, minY: zone.minY, maxY: zone.maxY },
            startX: zone.minX ?? zone.x,
            startY: zone.minY === undefined ? zone.y : zone.minY + 32,
            tenants: inZone.map((t) => ({ id: t.id, name: t.name, num: t.num, cat: t.cat })),
          }
        })
        return { success: true, zones: result }
      },
    }),

    swap_tenant_positions: tool({
      description:
        '指定した2つのテナントの配置位置（x, y 座標とサイズ）を入れ替えます。テナントは名前の一部または番号で指定します。',
      inputSchema: jsonSchema<{ tenantA: string; tenantB: string }>({
        type: 'object',
        properties: {
          tenantA: { type: 'string', description: '1つ目のテナント（名前の一部または呼び出し番号）' },
          tenantB: { type: 'string', description: '2つ目のテナント（名前の一部または呼び出し番号）' },
        },
        required: ['tenantA', 'tenantB'],
      }),
      execute: async ({ tenantA, tenantB }) => {
        const a = findTenant(tenantA, tenants)
        const b = findTenant(tenantB, tenants)

        if (!a) return { success: false, message: `テナントが見つかりません: ${tenantA}` }
        if (!b) return { success: false, message: `テナントが見つかりません: ${tenantB}` }

        return {
          success: true,
          updates: [
            { id: a.id, x: b.x, y: b.y, w: b.w, h: b.h },
            { id: b.id, x: a.x, y: a.y, w: a.w, h: a.h },
          ],
          message: `「${a.name}」と「${b.name}」の位置を入れ替えました`,
        }
      },
    }),

    move_tenant: tool({
      description:
        'テナントを指定した座標（x, y）に移動します。テナントは名前の一部または番号で指定します。会場外への移動と他テナントとの重なりはエラーになります。',
      inputSchema: jsonSchema<{ tenant: string; x: number; y: number }>({
        type: 'object',
        properties: {
          tenant: { type: 'string', description: '移動するテナント（名前の一部または呼び出し番号）' },
          x: { type: 'number', description: '移動先の X 座標（左上基準）' },
          y: { type: 'number', description: '移動先の Y 座標（左上基準）' },
        },
        required: ['tenant', 'x', 'y'],
      }),
      execute: async ({ tenant, x, y }) => {
        const t = findTenant(tenant, tenants)
        if (!t) return { success: false, message: `テナントが見つかりません: ${tenant}` }

        const boundsErr = checkBounds(x, y, t.w, t.h)
        if (boundsErr) return { success: false, message: boundsErr }

        const overlap = checkOverlap(x, y, t.w, t.h, tenants, t.id)
        if (overlap) {
          return { success: false, message: `移動先で「${overlap.name}」と重なります。別の座標を指定してください。` }
        }

        return {
          success: true,
          update: { id: t.id, x, y },
          message: `「${t.name}」を座標 (${x}, ${y}) に移動しました`,
        }
      },
    }),

    add_tenant: tool({
      description:
        '新しいテナントを会場に追加して配置します。名前・座標（x, y）が必須です。会場外や他テナントと重なる位置には配置できません。',
      inputSchema: jsonSchema<{
        name: string
        x: number
        y: number
        w?: number
        h?: number
        cat?: string
        num?: number
      }>({
        type: 'object',
        properties: {
          name: { type: 'string', description: 'テナント名' },
          x: { type: 'number', description: '配置する X 座標（左上基準）' },
          y: { type: 'number', description: '配置する Y 座標（左上基準）' },
          w: { type: 'number', description: '幅（省略時: 120）' },
          h: { type: 'number', description: '高さ（省略時: 100）' },
          cat: {
            type: 'string',
            description: 'カテゴリ: food / drink / goods / service / stage / info（省略時: goods）',
          },
          num: { type: 'number', description: '呼び出し番号（省略可、1以上の整数）' },
        },
        required: ['name', 'x', 'y'],
      }),
      execute: async ({ name, x, y, w = 120, h = 100, cat = 'goods', num }) => {
        const validCats = ['food', 'drink', 'goods', 'service', 'stage', 'info']
        const resolvedCat = validCats.includes(cat) ? cat : 'goods'

        const boundsErr = checkBounds(x, y, w, h)
        if (boundsErr) return { success: false, message: boundsErr }

        const overlap = checkOverlap(x, y, w, h, tenants)
        if (overlap) {
          return {
            success: false,
            message: `配置先で「${overlap.name}」と重なります。別の座標を指定してください。`,
          }
        }

        if (num != null) {
          if (!Number.isInteger(num) || num < 1) {
            return { success: false, message: '呼び出し番号は1以上の整数で指定してください。' }
          }
          const dup = tenants.find((t) => t.num === num)
          if (dup) {
            return {
              success: false,
              message: `呼び出し番号 ${num} は「${dup.name}」が既に使用しています。`,
            }
          }
        }

        const newTenant = {
          id: `ai${Date.now().toString().slice(-8)}`,
          name,
          x,
          y,
          w,
          h,
          cat: resolvedCat,
          status: 'prep' as const,
          num: num ?? null,
          contact: '',
          phone: '',
          power: false,
          size: `${(w / 100).toFixed(1)} x ${(h / 100).toFixed(1)}m`,
          memo: '',
        }

        return {
          success: true,
          tenant: newTenant,
          message: `「${name}」を (${x}, ${y}) に追加しました`,
        }
      },
    }),

    delete_tenant: tool({
      description: 'テナントをレイアウトから削除します。テナントは名前の一部または番号で指定します。',
      inputSchema: jsonSchema<{ tenant: string }>({
        type: 'object',
        properties: {
          tenant: { type: 'string', description: '削除するテナント（名前の一部または呼び出し番号）' },
        },
        required: ['tenant'],
      }),
      execute: async ({ tenant }) => {
        const t = findTenant(tenant, tenants)
        if (!t) return { success: false, message: `テナントが見つかりません: ${tenant}` }
        return {
          success: true,
          id: t.id,
          message: `「${t.name}」を削除しました`,
        }
      },
    }),

    set_tenant_number: tool({
      description:
        'テナントの呼び出し番号を設定または変更します。番号は1以上の整数で、他テナントと重複不可。テナントは名前の一部または現在の番号で指定します。',
      inputSchema: jsonSchema<{ tenant: string; num: number }>({
        type: 'object',
        properties: {
          tenant: { type: 'string', description: 'テナント（名前の一部または現在の呼び出し番号）' },
          num: { type: 'number', description: '設定する呼び出し番号（1以上の整数）' },
        },
        required: ['tenant', 'num'],
      }),
      execute: async ({ tenant, num }) => {
        const t = findTenant(tenant, tenants)
        if (!t) return { success: false, message: `テナントが見つかりません: ${tenant}` }

        if (!Number.isInteger(num) || num < 1) {
          return { success: false, message: '呼び出し番号は1以上の整数で指定してください。' }
        }
        const dup = tenants.find((other) => other.id !== t.id && other.num === num)
        if (dup) {
          return {
            success: false,
            message: `呼び出し番号 ${num} は「${dup.name}」が既に使用しています。`,
          }
        }

        return {
          success: true,
          update: { id: t.id, num },
          message: `「${t.name}」の呼び出し番号を ${num} に設定しました`,
        }
      },
    }),

    clear_tenant_number: tool({
      description: 'テナントの呼び出し番号を削除して未設定にします。テナントは名前の一部または番号で指定します。',
      inputSchema: jsonSchema<{ tenant: string }>({
        type: 'object',
        properties: {
          tenant: { type: 'string', description: 'テナント（名前の一部または呼び出し番号）' },
        },
        required: ['tenant'],
      }),
      execute: async ({ tenant }) => {
        const t = findTenant(tenant, tenants)
        if (!t) return { success: false, message: `テナントが見つかりません: ${tenant}` }
        return {
          success: true,
          update: { id: t.id, num: null },
          message: `「${t.name}」の呼び出し番号を削除しました`,
        }
      },
    }),

    batch_rearrange: tool({
      description: `複数のテナントグループを同時に再配置します。ゾーン単位の入れ替えや、グループを縦/横に並べ直す操作に使います。
移動元と移動先が重なっていても原子的に適用するため、ゾーン間の相互移動が可能です。
各グループに対して「どこに（startX, startY）」「どの向きで（row=横並び, column=縦並び）」並べるかを指定します。`,
      inputSchema: jsonSchema<{
        moves: Array<{
          tenants: string[]
          startX: number
          startY: number
          direction: 'row' | 'column'
          gap?: number
        }>
      }>({
        type: 'object',
        properties: {
          moves: {
            type: 'array',
            description: '再配置するグループのリスト',
            items: {
              type: 'object',
              properties: {
                tenants: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'グループ内のテナント（名前の一部または呼び出し番号）',
                },
                startX: { type: 'number', description: '配置先の左上 X 座標' },
                startY: { type: 'number', description: '配置先の左上 Y 座標' },
                direction: {
                  type: 'string',
                  enum: ['row', 'column'],
                  description: '並び方向: row=横並び / column=縦並び',
                },
                gap: { type: 'number', description: 'テナント間の隙間（デフォルト: 20）' },
              },
              required: ['tenants', 'startX', 'startY', 'direction'],
            },
          },
        },
        required: ['moves'],
      }),
      execute: async ({ moves }) => {
        const allUpdates: Array<{ id: string; x: number; y: number }> = []
        const movedIds = new Set<string>()
        const labels: string[] = []

        for (const move of moves) {
          const result = layoutGroup(move.tenants, move.startX, move.startY, move.direction, move.gap ?? 20, tenants)
          if ('error' in result) return { success: false, message: result.error }
          result.updates.forEach((u) => { allUpdates.push(u); movedIds.add(u.id) })
          labels.push(result.label)
        }

        const validationError = validateBatchUpdates(allUpdates, movedIds, tenants)
        if (validationError) return { success: false, message: validationError }

        return { success: true, updates: allUpdates, message: labels.join('\n') }
      },
    }),

    bulk_set_numbers: tool({
      description: `複数テナントの呼び出し番号を一括で付け替えます。番号の並び替え・再割り当てに使います。
バッチ内での整合性チェックのみ行い、既存番号との衝突は気にせず上書きします（clear_tenant_number を先に呼ぶ必要はありません）。
num に null を指定するとそのテナントの番号を削除します。`,
      inputSchema: jsonSchema<{
        assignments: Array<{ tenant: string; num: number | null }>
      }>({
        type: 'object',
        properties: {
          assignments: {
            type: 'array',
            description: '番号を設定するテナントと番号のペアのリスト',
            items: {
              type: 'object',
              properties: {
                tenant: { type: 'string', description: 'テナント（名前の一部・番号・ID）' },
                num: { type: ['number', 'null'], description: '設定する番号（null で削除）' },
              },
              required: ['tenant', 'num'],
            },
          },
        },
        required: ['assignments'],
      }),
      execute: async ({ assignments }) => {
        const nums = assignments.map((a) => a.num).filter((n): n is number => n !== null)
        if (new Set(nums).size !== nums.length) {
          return { success: false, message: 'バッチ内に重複した番号があります。各テナントに異なる番号を指定してください。' }
        }
        for (const a of assignments) {
          if (a.num !== null && (!Number.isInteger(a.num) || a.num < 1)) {
            return { success: false, message: `呼び出し番号は1以上の整数で指定してください: ${a.num}` }
          }
        }

        const updates: Array<{ id: string; num: number | null }> = []
        for (const a of assignments) {
          const t = findTenant(a.tenant, tenants)
          if (!t) return { success: false, message: `テナントが見つかりません: ${a.tenant}` }
          updates.push({ id: t.id, num: a.num })
        }

        const names = updates.map((u) => {
          const t = tenants.find((t) => t.id === u.id)!
          return `${t.name}→${u.num ?? '削除'}`
        }).join(', ')
        return { success: true, updates, message: `${updates.length}件の呼び出し番号を設定しました: ${names}` }
      },
    }),

    auto_assign_numbers: tool({
      description: '全テナントの呼び出し番号を、左上から右・下の順（行優先）で自動的に振り直します。',
      inputSchema: jsonSchema<{ startFrom?: number }>({
        type: 'object',
        properties: {
          startFrom: { type: 'number', description: '開始番号（デフォルト: 1）', default: 1 },
        },
      }),
      execute: async ({ startFrom = 1 }) => {
        if (!Number.isInteger(startFrom) || startFrom < 1) {
          return { success: false, message: '開始番号は1以上の整数で指定してください。' }
        }
        const ROW_TOLERANCE = 40
        const sorted = [...tenants].sort((a, b) => {
          const rowA = Math.round(a.y / ROW_TOLERANCE)
          const rowB = Math.round(b.y / ROW_TOLERANCE)
          return rowA === rowB ? a.x - b.x : rowA - rowB
        })

        const assignments = sorted.map((t, i) => ({ id: t.id, num: startFrom + i }))

        return {
          success: true,
          assignments,
          message: `${assignments.length} 件のテナントに番号を割り当てました（${startFrom}〜${startFrom + assignments.length - 1}）`,
        }
      },
    }),
  }
}
