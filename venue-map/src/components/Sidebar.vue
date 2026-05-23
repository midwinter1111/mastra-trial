<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useTenantsStore } from '@/stores/tenants'
import { useUIStore } from '@/stores/ui'
import { CATEGORIES, getCategoryById, STATUSES } from '@/data/seed'
import Icon from './icons/Icon.vue'
import type { Tenant } from '@/types'

const tenantsStore = useTenantsStore()
const uiStore = useUIStore()
const { tenants, unplaced, selectedIds } = storeToRefs(tenantsStore)
const { search, filterCat, filterStatus } = storeToRefs(uiStore)

const filtered = computed(() => {
  return tenants.value.filter((t) => {
    if (search.value) {
      const q = search.value.toLowerCase()
      if (!t.name.toLowerCase().includes(q) && !(t.num != null && String(t.num).includes(q))) return false
    }
    if (filterCat.value !== 'all' && t.cat !== filterCat.value) return false
    if (filterStatus.value !== 'all' && t.status !== filterStatus.value) return false
    return true
  })
})

const groups = computed(() => {
  const g: Record<string, Tenant[]> = {}
  filtered.value.forEach((t) => {
    if (!g[t.cat]) g[t.cat] = []
    g[t.cat].push(t)
  })
  return g
})

const groupOrder = computed(() =>
  CATEGORIES.map((c) => c.id).filter((id) => groups.value[id])
)

function onRowClick(id: string, e: MouseEvent) {
  const shift = e.shiftKey || e.metaKey || e.ctrlKey
  if (shift) {
    const next = new Set(selectedIds.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    tenantsStore.selectedIds = next
  } else {
    tenantsStore.selectedIds = new Set([id])
  }
}

function onRowDblClick(id: string) {
  uiStore.openDetail(id)
}
</script>

<template>
  <aside class="side">
    <div class="side-hd">
      <div class="side-title">
        <h2>テナント</h2>
        <span class="count">{{ tenants.length }}</span>
      </div>
      <div class="search-input">
        <Icon name="search" />
        <input
          v-model="search"
          type="text"
          placeholder="名前・番号で検索…"
        />
      </div>
      <div class="filter-row">
        <button
          :class="['filter-chip', filterCat === 'all' && filterStatus === 'all' && 'on']"
          @click="filterCat = 'all'; filterStatus = 'all'"
        >
          すべて
        </button>
        <button
          v-for="c in CATEGORIES"
          :key="c.id"
          :class="['filter-chip', filterCat === c.id && 'on']"
          @click="filterCat = filterCat === c.id ? 'all' : c.id"
        >
          <span class="dot" :style="{ background: c.color }" />
          <span>{{ c.label }}</span>
        </button>
      </div>
    </div>

    <div class="side-list">
      <template v-for="catId in groupOrder" :key="catId">
        <div class="list-section">
          <span style="display:inline-flex;align-items:center;gap:6px">
            <span :style="{ width: '8px', height: '8px', borderRadius: '3px', background: getCategoryById(catId).color, display: 'inline-block' }" />
            {{ getCategoryById(catId).label }}
          </span>
          <span style="color:var(--ink-4);font-family:var(--font-mono);font-weight:600">
            {{ groups[catId].length }}
          </span>
        </div>
        <div
          v-for="t in groups[catId]"
          :key="t.id"
          :class="['tenant-row', selectedIds.has(t.id) && 'selected', t.num != null && 'has-num']"
          @click="(e) => onRowClick(t.id, e)"
          @dblclick="onRowDblClick(t.id)"
        >
          <div
            class="num-badge mono"
            :style="t.num != null
              ? { background: getCategoryById(t.cat).color, color: '#fff' }
              : { background: 'var(--bg-2)', color: 'var(--ink-4)' }"
          >
            {{ t.num == null ? '—' : t.num }}
          </div>
          <div class="name">{{ t.name }}</div>
          <div class="meta">
            <span class="cat-dot" :style="{ background: getCategoryById(t.cat).color }" />
            <span>{{ getCategoryById(t.cat).label }}</span>
          </div>
          <div class="stat">
            <span :class="['status-pill', t.status]">
              <span class="dot" />
              {{ STATUSES.find((s) => s.id === t.status)?.label }}
            </span>
          </div>
        </div>
      </template>

      <template v-if="unplaced.length > 0">
        <div class="list-section" style="margin-top:12px">
          <span>未配置（出店候補）</span>
          <span style="color:var(--ink-4);font-family:var(--font-mono);font-weight:600">
            {{ unplaced.length }}
          </span>
        </div>
        <div
          v-for="u in unplaced"
          :key="u.id"
          class="unplaced-card"
          draggable="true"
          title="マップにドラッグして配置"
          @dragstart="(e) => { e.dataTransfer!.setData('text/tenant-id', u.id); e.dataTransfer!.effectAllowed = 'copy' }"
        >
          <span class="grip">⋮⋮</span>
          <span :style="{ width: '9px', height: '9px', borderRadius: '3px', background: getCategoryById(u.cat).color, flexShrink: 0, display: 'inline-block' }" />
          <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ u.name }}</span>
        </div>
      </template>

      <div
        v-if="filtered.length === 0 && unplaced.length === 0"
        class="side-empty"
      >
        該当するテナントがありません
      </div>
    </div>
  </aside>
</template>

<style scoped>
.side {
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-right: 1px solid var(--border);
  overflow: hidden;
  z-index: 10;
}
.side-hd {
  padding: 12px 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.side-title {
  display: flex;
  align-items: center;
  gap: 8px;
}
.side-title h2 { font-size: 13px; font-weight: 600; margin: 0; }
.count {
  background: var(--bg-2);
  color: var(--ink-3);
  font-size: 11px;
  font-family: var(--font-mono);
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 20px;
}
.search-input {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  background: var(--bg-2);
  border-radius: 8px;
  padding: 0 10px;
  border: 1px solid transparent;
}
.search-input:focus-within { border-color: var(--accent); background: var(--surface); }
.search-input svg { width: 13px; height: 13px; color: var(--ink-3); flex-shrink: 0; }
.search-input input { flex: 1; background: transparent; border: 0; outline: 0; font-size: 12.5px; color: var(--ink-1); }
.search-input input::placeholder { color: var(--ink-4); }
.filter-row { display: flex; gap: 4px; flex-wrap: wrap; }
.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 8px;
  border-radius: 20px;
  border: 1px solid transparent;
  background: var(--bg-2);
  font-size: 11px;
  font-weight: 500;
  color: var(--ink-3);
  cursor: pointer;
  white-space: nowrap;
}
.filter-chip:hover { background: var(--bg-3, var(--border)); }
.filter-chip.on { background: var(--accent-soft); color: var(--accent-ink); border-color: var(--accent); }
.filter-chip .dot { width: 6px; height: 6px; border-radius: 50%; }
.side-list { flex: 1; overflow-y: auto; padding: 4px 0 12px; }
.list-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px 4px;
  font-size: 10.5px;
  font-weight: 600;
  color: var(--ink-3);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.tenant-row {
  display: grid;
  grid-template-columns: 32px 1fr auto auto;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  cursor: pointer;
  font-size: 12.5px;
  border-radius: 0;
  transition: background 0.1s;
}
.tenant-row:hover { background: var(--bg-2); }
.tenant-row.selected { background: var(--accent-soft); }
.num-badge {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  font-size: 11.5px;
  font-family: var(--font-mono);
  font-weight: 800;
  flex-shrink: 0;
  transition: background 0.15s;
}
.tenant-row .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
.tenant-row .meta { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--ink-3); }
.tenant-row .meta .cat-dot { width: 7px; height: 7px; border-radius: 2px; flex-shrink: 0; }
.tenant-row .stat { flex-shrink: 0; }
.unplaced-card {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 2px 8px;
  padding: 6px 10px;
  background: var(--bg-2);
  border-radius: 8px;
  border: 1.5px dashed var(--border);
  font-size: 12px;
  color: var(--ink-2);
  cursor: grab;
}
.unplaced-card:hover { border-color: var(--accent); background: var(--accent-soft); }
.unplaced-card .grip { color: var(--ink-4); font-size: 10px; letter-spacing: -2px; flex-shrink: 0; }
.side-empty {
  padding: 50px 14px;
  text-align: center;
  color: var(--ink-3);
  font-size: 12.5px;
}
</style>
