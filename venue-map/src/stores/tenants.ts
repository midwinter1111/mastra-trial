import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Tenant } from '@/types'
import { INITIAL_TENANTS, UNPLACED_TENANTS } from '@/data/seed'
import { loadState, saveState } from '@/services/storage'

const STATE_KEY = 'venuemap:state:v1'

interface PersistedState {
  tenants: Tenant[]
  unplaced: Tenant[]
}

export const useTenantsStore = defineStore('tenants', () => {
  const saved = loadState<PersistedState>(STATE_KEY)
  const tenants = ref<Tenant[]>(saved?.tenants ?? INITIAL_TENANTS.map((t) => ({ ...t })))
  const unplaced = ref<Tenant[]>(saved?.unplaced ?? UNPLACED_TENANTS.map((t) => ({ ...t })))
  const selectedIds = ref<Set<string>>(new Set())

  // History (snapshot-based undo/redo)
  const past = ref<Tenant[][]>([])
  const future = ref<Tenant[][]>([])

  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)

  function persist() {
    saveState<PersistedState>(STATE_KEY, {
      tenants: tenants.value,
      unplaced: unplaced.value,
    })
    // Flash save in UI store (lazy import to avoid circular deps)
    import('./ui').then(({ useUIStore }) => useUIStore().flashSave())
  }

  function pushHistory() {
    past.value.push(tenants.value.map((t) => ({ ...t })))
    if (past.value.length > 50) past.value.shift()
    future.value = []
  }

  function updateTenant(id: string, patch: Partial<Tenant>, recordHistory = true) {
    if (recordHistory) pushHistory()
    tenants.value = tenants.value.map((t) => (t.id === id ? { ...t, ...patch } : t))
    persist()
  }

  function updateTenants(fn: (prev: Tenant[]) => Tenant[], recordHistory = true) {
    if (recordHistory) pushHistory()
    tenants.value = fn(tenants.value)
    persist()
  }

  let moveBuffer: ReturnType<typeof setTimeout> | null = null
  function moveTenants(updates: Record<string, { x: number; y: number }>) {
    if (!moveBuffer) {
      pushHistory()
      moveBuffer = setTimeout(() => {
        moveBuffer = null
      }, 250)
    }
    tenants.value = tenants.value.map((t) => (updates[t.id] ? { ...t, ...updates[t.id] } : t))
    persist()
  }

  function resizeTenant(id: string, dims: { w: number; h: number }) {
    if (!moveBuffer) {
      pushHistory()
      moveBuffer = setTimeout(() => {
        moveBuffer = null
      }, 250)
    }
    tenants.value = tenants.value.map((t) => (t.id === id ? { ...t, ...dims } : t))
    persist()
  }

  function addTenant(tenant: Tenant) {
    pushHistory()
    tenants.value = [...tenants.value, tenant]
    persist()
  }

  function deleteTenants(ids: string[]) {
    pushHistory()
    tenants.value = tenants.value.filter((t) => !ids.includes(t.id))
    selectedIds.value = new Set([...selectedIds.value].filter((id) => !ids.includes(id)))
    persist()
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
    persist()
    return newId
  }

  function assignNumbers(assignments: Array<{ id: string; num: number }>) {
    pushHistory()
    const map: Record<string, number> = {}
    assignments.forEach(({ id, num }) => {
      map[id] = num
    })
    tenants.value = tenants.value.map((t) =>
      map[t.id] !== undefined ? { ...t, num: map[t.id] } : t,
    )
    persist()
  }

  function undo() {
    const snapshot = past.value.pop()
    if (!snapshot) return
    future.value.push(tenants.value.map((t) => ({ ...t })))
    tenants.value = snapshot
    persist()
  }

  function redo() {
    const snapshot = future.value.pop()
    if (!snapshot) return
    past.value.push(tenants.value.map((t) => ({ ...t })))
    tenants.value = snapshot
    persist()
  }

  function resetToSeed() {
    if (!confirm('シードデータに戻しますか？現在の内容は失われます。')) return
    tenants.value = INITIAL_TENANTS.map((t) => ({ ...t }))
    unplaced.value = UNPLACED_TENANTS.map((t) => ({ ...t }))
    selectedIds.value = new Set()
    past.value = []
    future.value = []
    persist()
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
