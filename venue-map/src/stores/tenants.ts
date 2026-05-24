import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Tenant } from '@/types'
import { INITIAL_TENANTS, UNPLACED_TENANTS, VENUE_BOUNDS } from '@/data/seed'

export const useTenantsStore = defineStore('tenants', () => {
  const tenants = ref<Tenant[]>(INITIAL_TENANTS.map((t) => ({ ...t })))
  const unplaced = ref<Tenant[]>(UNPLACED_TENANTS.map((t) => ({ ...t })))
  const selectedIds = ref<Set<string>>(new Set())

  // History (snapshot-based undo/redo)
  const past = ref<Tenant[][]>([])
  const future = ref<Tenant[][]>([])

  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)

  function pushHistory() {
    past.value.push(tenants.value.map((t) => ({ ...t })))
    if (past.value.length > 50) past.value.shift()
    future.value = []
  }

  function updateTenant(id: string, patch: Partial<Tenant>, recordHistory = true) {
    if (recordHistory) pushHistory()
    tenants.value = tenants.value.map((t) => (t.id === id ? { ...t, ...patch } : t))
  }

  function updateTenants(fn: (prev: Tenant[]) => Tenant[], recordHistory = true) {
    if (recordHistory) pushHistory()
    tenants.value = fn(tenants.value)
  }

  let moveBuffer: ReturnType<typeof setTimeout> | null = null
  function moveTenants(updates: Record<string, { x: number; y: number }>) {
    const movedIds = new Set(Object.keys(updates))
    const unmoved = tenants.value.filter((t) => !movedIds.has(t.id))
    const moved = tenants.value
      .filter((t) => movedIds.has(t.id))
      .map((t) => ({ ...t, ...updates[t.id] }))

    for (const t of moved) {
      if (
        t.x < VENUE_BOUNDS.minX || t.y < VENUE_BOUNDS.minY ||
        t.x + t.w > VENUE_BOUNDS.maxX || t.y + t.h > VENUE_BOUNDS.maxY
      ) return
      if (unmoved.some((o) => t.x < o.x + o.w && t.x + t.w > o.x && t.y < o.y + o.h && t.y + t.h > o.y)) return
    }

    if (!moveBuffer) {
      pushHistory()
      moveBuffer = setTimeout(() => { moveBuffer = null }, 250)
    }
    tenants.value = tenants.value.map((t) => (t.id in updates ? { ...t, ...updates[t.id] } : t))
  }

  function resizeTenant(id: string, dims: { w: number; h: number }) {
    if (!moveBuffer) {
      pushHistory()
      moveBuffer = setTimeout(() => {
        moveBuffer = null
      }, 250)
    }
    tenants.value = tenants.value.map((t) => (t.id === id ? { ...t, ...dims } : t))
  }

  function addTenant(tenant: Tenant) {
    pushHistory()
    tenants.value = [...tenants.value, tenant]
  }

  function deleteTenants(ids: string[]) {
    pushHistory()
    tenants.value = tenants.value.filter((t) => !ids.includes(t.id))
    selectedIds.value = new Set([...selectedIds.value].filter((id) => !ids.includes(id)))
  }

  function placeFromUnplaced(
    unplacedId: string,
    x: number,
    y: number,
    w: number,
    h: number,
  ): string | null {
    const u = unplaced.value.find((up) => up.id === unplacedId)
    if (!u) return null
    const newId = 't' + Date.now().toString().slice(-6)
    const newTenant: Tenant = { ...u, id: newId, x, y, w, h }
    pushHistory()
    tenants.value = [...tenants.value, newTenant]
    unplaced.value = unplaced.value.filter((up) => up.id !== unplacedId)
    return newId
  }

  function assignNumbers(assignments: Array<{ id: string; num: number }>) {
    pushHistory()
    const map: Record<string, number> = {}
    assignments.forEach(({ id, num }) => {
      map[id] = num
    })
    tenants.value = tenants.value.map((t) =>
      t.id in map ? { ...t, num: map[t.id] } : t,
    )
  }

  function undo() {
    const snapshot = past.value.pop()
    if (!snapshot) return
    future.value.push(tenants.value.map((t) => ({ ...t })))
    tenants.value = snapshot
  }

  function redo() {
    const snapshot = future.value.pop()
    if (!snapshot) return
    past.value.push(tenants.value.map((t) => ({ ...t })))
    tenants.value = snapshot
  }

  function resetToSeed() {
    if (!confirm('シードデータに戻しますか？現在の内容は失われます。')) return
    tenants.value = INITIAL_TENANTS.map((t) => ({ ...t }))
    unplaced.value = UNPLACED_TENANTS.map((t) => ({ ...t }))
    selectedIds.value = new Set()
    past.value = []
    future.value = []
  }

  function computeNextStart(): number {
    const used = tenants.value.map((t) => t.num).filter((n): n is number => n != null)
    return used.length ? Math.max(...used) + 1 : 1
  }

  const stats = computed(() => {
    const s = { total: tenants.value.length, open: 0, prep: 0, closed: 0, withNum: 0 }
    tenants.value.forEach((t) => {
      s[t.status]++
      if (t.num != null) s.withNum++
    })
    return s
  })

  return {
    tenants, unplaced, selectedIds,
    canUndo, canRedo, stats,
    updateTenant, updateTenants, moveTenants, resizeTenant,
    addTenant, deleteTenants, placeFromUnplaced, assignNumbers,
    undo, redo, resetToSeed, computeNextStart, pushHistory,
  }
})
