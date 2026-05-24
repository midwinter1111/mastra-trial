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
  const byId = tenants.find((tenant) => tenant.id === query)
  if (byId) return byId
  const num = Number.parseInt(query, 10)
  if (!Number.isNaN(num)) {
    return tenants.find((tenant) => tenant.num === num)
  }
  return tenants.find((tenant) => tenant.name.includes(query))
}

function checkBounds(x: number, y: number, w: number, h: number): string | null {
  if (x < BOUNDS.minX || y < BOUNDS.minY || x + w > BOUNDS.maxX || y + h > BOUNDS.maxY) {
    return `会場外に配置できません。有効範囲: x=${BOUNDS.minX}〜${BOUNDS.maxX - w}, y=${BOUNDS.minY}〜${BOUNDS.maxY - h}`
  }
  return null
}

function checkOverlap(x: number, y: number, w: number, h: number, tenants: TenantData[], excludeId?: string): TenantData | undefined {
  return tenants.find((candidate) => {
    if (candidate.id === excludeId) return false
    return x < candidate.x + candidate.w && x + w > candidate.x && y < candidate.y + candidate.h && y + h > candidate.y
  })
}

type Rect = { x: number; y: number; w: number; h: number }

function rectsOverlap(rectA: Rect, rectB: Rect): boolean {
  return rectA.x < rectB.x + rectB.w && rectA.x + rectA.w > rectB.x && rectA.y < rectB.y + rectB.h && rectA.y + rectA.h > rectB.y
}

function layoutGroup(
  queries: string[],
  startX: number,
  startY: number,
  direction: 'row' | 'column',
  gap: number,
  tenants: TenantData[],
): { updates: Array<{ id: string; x: number; y: number }>; label: string } | { error: string } {
  const resolved = queries.map((query) => findTenant(query, tenants)).filter((tenant): tenant is TenantData => tenant !== undefined)
  if (resolved.length === 0) return { error: `テナントが見つかりません: ${queries.join(', ')}` }

  const updates: Array<{ id: string; x: number; y: number }> = []
  let curX = startX
  let curY = startY

  for (const tenant of resolved) {
    const boundsErr = checkBounds(curX, curY, tenant.w, tenant.h)
    if (boundsErr) {
      const suggestion = direction === 'column'
        ? ` 対策: direction='row'（横並び）に変更して再試行してください。`
        : ` 対策: direction='column'（縦並び）に変更するか、startX を小さくして再試行してください。`
      return { error: `「${tenant.name}」: ${boundsErr}${suggestion}` }
    }
    updates.push({ id: tenant.id, x: curX, y: curY })
    if (direction === 'row') curX += tenant.w + gap
    else curY += tenant.h + gap
  }

  const label = `${resolved.map((tenant) => tenant.name).join('・')} → (${startX}, ${startY}) ${direction === 'row' ? '横並び' : '縦並び'}`
  return { updates, label }
}

function validateBatchUpdates(
  allUpdates: Array<{ id: string; x: number; y: number }>,
  movedIds: Set<string>,
  tenants: TenantData[],
): string | null {
  const getTenant = (id: string) => tenants.find((tenant) => tenant.id === id)!

  for (const update of allUpdates) {
    const tenant = getTenant(update.id)
    const updateRect: Rect = { x: update.x, y: update.y, w: tenant.w, h: tenant.h }
    const clash = tenants.find((other) => !movedIds.has(other.id) && rectsOverlap(updateRect, other))
    if (clash) return `「${tenant.name}」の移動先が「${clash.name}」と重なります。startX/startY または gap を調整してください。`
  }

  for (let i = 0; i < allUpdates.length; i++) {
    for (let j = i + 1; j < allUpdates.length; j++) {
      const updateA = allUpdates[i]
      const updateB = allUpdates[j]
      const tenantA = getTenant(updateA.id)
      const tenantB = getTenant(updateB.id)
      if (rectsOverlap({ x: updateA.x, y: updateA.y, w: tenantA.w, h: tenantA.h }, { x: updateB.x, y: updateB.y, w: tenantB.w, h: tenantB.h })) {
        return `「${tenantA.name}」と「${tenantB.name}」の配置先が重なります。gap を大きくしてください。`
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
        const zoneOf = (tenant: TenantData): string => {
          if (zones.length === 0) return '未分類'
          const zone = zones.find(
            (z) =>
              z.minX !== undefined &&
              z.maxX !== undefined &&
              z.minY !== undefined &&
              z.maxY !== undefined &&
              tenant.x >= z.minX &&
              tenant.x < z.maxX &&
              tenant.y >= z.minY &&
              tenant.y < z.maxY,
          )
          return zone?.label ?? 'ゾーン外'
        }

        const layout = tenants.map((tenant) => ({
          id: tenant.id,
          name: tenant.name,
          cat: tenant.cat,
          num: tenant.num,
          x: tenant.x,
          y: tenant.y,
          zone: zoneOf(tenant),
        }))

        const zoneCounts = zones.map((zone) => {
          const count = layout.filter((entry) => entry.zone === zone.label).length
          return `${zone.label}: ${count}件`
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
            ? tenants.filter((tenant) => tenant.x >= zone.minX! && tenant.x < zone.maxX! && tenant.y >= zone.minY! && tenant.y < zone.maxY!)
            : []
          return {
            label: zone.label,
            bounds: { minX: zone.minX, maxX: zone.maxX, minY: zone.minY, maxY: zone.maxY },
            startX: zone.minX ?? zone.x,
            startY: zone.minY === undefined ? zone.y : zone.minY + 32,
            tenants: inZone.map((tenant) => ({ id: tenant.id, name: tenant.name, num: tenant.num, cat: tenant.cat })),
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
        const foundA = findTenant(tenantA, tenants)
        const foundB = findTenant(tenantB, tenants)

        if (!foundA) return { success: false, message: `テナントが見つかりません: ${tenantA}` }
        if (!foundB) return { success: false, message: `テナントが見つかりません: ${tenantB}` }

        return {
          success: true,
          updates: [
            { id: foundA.id, x: foundB.x, y: foundB.y, w: foundB.w, h: foundB.h },
            { id: foundB.id, x: foundA.x, y: foundA.y, w: foundA.w, h: foundA.h },
          ],
          message: `「${foundA.name}」と「${foundB.name}」の位置を入れ替えました`,
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
        const found = findTenant(tenant, tenants)
        if (!found) return { success: false, message: `テナントが見つかりません: ${tenant}` }

        const boundsErr = checkBounds(x, y, found.w, found.h)
        if (boundsErr) return { success: false, message: boundsErr }

        const overlap = checkOverlap(x, y, found.w, found.h, tenants, found.id)
        if (overlap) {
          return { success: false, message: `移動先で「${overlap.name}」と重なります。別の座標を指定してください。` }
        }

        return {
          success: true,
          update: { id: found.id, x, y },
          message: `「${found.name}」を座標 (${x}, ${y}) に移動しました`,
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
          const duplicate = tenants.find((tenant) => tenant.num === num)
          if (duplicate) {
            return {
              success: false,
              message: `呼び出し番号 ${num} は「${duplicate.name}」が既に使用しています。`,
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
        const found = findTenant(tenant, tenants)
        if (!found) return { success: false, message: `テナントが見つかりません: ${tenant}` }
        return {
          success: true,
          id: found.id,
          message: `「${found.name}」を削除しました`,
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
        const found = findTenant(tenant, tenants)
        if (!found) return { success: false, message: `テナントが見つかりません: ${tenant}` }

        if (!Number.isInteger(num) || num < 1) {
          return { success: false, message: '呼び出し番号は1以上の整数で指定してください。' }
        }
        const duplicate = tenants.find((other) => other.id !== found.id && other.num === num)
        if (duplicate) {
          return {
            success: false,
            message: `呼び出し番号 ${num} は「${duplicate.name}」が既に使用しています。`,
          }
        }

        return {
          success: true,
          update: { id: found.id, num },
          message: `「${found.name}」の呼び出し番号を ${num} に設定しました`,
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
        const found = findTenant(tenant, tenants)
        if (!found) return { success: false, message: `テナントが見つかりません: ${tenant}` }
        return {
          success: true,
          update: { id: found.id, num: null },
          message: `「${found.name}」の呼び出し番号を削除しました`,
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
          result.updates.forEach((update) => { allUpdates.push(update); movedIds.add(update.id) })
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
        const nums = assignments.map((assignment) => assignment.num).filter((num): num is number => num !== null)
        if (new Set(nums).size !== nums.length) {
          return { success: false, message: 'バッチ内に重複した番号があります。各テナントに異なる番号を指定してください。' }
        }
        for (const assignment of assignments) {
          if (assignment.num !== null && (!Number.isInteger(assignment.num) || assignment.num < 1)) {
            return { success: false, message: `呼び出し番号は1以上の整数で指定してください: ${assignment.num}` }
          }
        }

        const updates: Array<{ id: string; num: number | null }> = []
        for (const assignment of assignments) {
          const found = findTenant(assignment.tenant, tenants)
          if (!found) return { success: false, message: `テナントが見つかりません: ${assignment.tenant}` }
          updates.push({ id: found.id, num: assignment.num })
        }

        const names = updates.map((update) => {
          const tenant = tenants.find((tenant) => tenant.id === update.id)!
          return `${tenant.name}→${update.num ?? '削除'}`
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
        const sorted = [...tenants].sort((tenantA, tenantB) => {
          const rowA = Math.round(tenantA.y / ROW_TOLERANCE)
          const rowB = Math.round(tenantB.y / ROW_TOLERANCE)
          return rowA === rowB ? tenantA.x - tenantB.x : rowA - rowB
        })

        const assignments = sorted.map((tenant, index) => ({ id: tenant.id, num: startFrom + index }))

        return {
          success: true,
          assignments,
          message: `${assignments.length} 件のテナントに番号を割り当てました（${startFrom}〜${startFrom + assignments.length - 1}）`,
        }
      },
    }),
  }
}
