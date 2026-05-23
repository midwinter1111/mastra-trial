<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useTenantsStore } from '@/stores/tenants'
import { useToolsStore } from '@/stores/tools'
import { useVenueStore } from '@/stores/venue'
import { useUIStore } from '@/stores/ui'

const tenantsStore = useTenantsStore()
const toolsStore = useToolsStore()
const venueStore = useVenueStore()
const uiStore = useUIStore()

const { stats, selectedIds } = storeToRefs(tenantsStore)
const { mode } = storeToRefs(toolsStore)
const { zoom } = storeToRefs(venueStore)
const { tweaksPanelOpen } = storeToRefs(uiStore)
</script>

<template>
  <div class="statusbar">
    <div class="grp"><span class="dot" /><span>ライブ同期</span></div>
    <div class="grp">
      <span class="label">モード</span>
      <span class="val" :style="{ color: mode === 'operate' ? 'var(--accent)' : 'var(--ink-1)' }">
        {{ mode === 'edit' ? '設営' : '運営' }}
      </span>
    </div>
    <div class="grp"><span class="label">総数</span><span class="val">{{ stats.total }}</span></div>
    <div class="grp">
      <span class="label">営業</span>
      <span class="val" style="color: var(--status-open)">{{ stats.open }}</span>
    </div>
    <div class="grp">
      <span class="label">準備</span>
      <span class="val" style="color: var(--status-prep)">{{ stats.prep }}</span>
    </div>
    <div class="grp">
      <span class="label">番号付与</span>
      <span class="val">{{ stats.withNum }}/{{ stats.total }}</span>
    </div>

    <div class="sb-spacer" />

    <div v-if="selectedIds.size > 0" class="grp">
      <span class="label">選択</span>
      <span class="val" style="color: var(--accent)">{{ selectedIds.size }}</span>
    </div>
    <div class="grp">
      <span class="label">ズーム</span>
      <span class="val">{{ Math.round(zoom * 100) }}%</span>
    </div>
    <div class="grp"><span class="label">グリッド</span><span class="val">20px</span></div>

    <button
      class="tweak-btn"
      :class="{ active: tweaksPanelOpen }"
      title="表示設定"
      @click="tweaksPanelOpen = !tweaksPanelOpen"
    >
      ⚙
    </button>
  </div>
</template>

<style scoped>
.statusbar {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 0 16px;
  font-size: 11.5px;
  color: var(--ink-3);
  background: var(--surface);
  border-top: 1px solid var(--border);
}
.grp { display: flex; align-items: center; gap: 6px; }
.label { color: var(--ink-4); }
.val { color: var(--ink-2); font-weight: 600; font-family: var(--font-mono); }
.sb-spacer { flex: 1; }
.dot { width: 6px; height: 6px; border-radius: 50%; background: var(--status-open); }
.tweak-btn {
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 13px;
  color: var(--ink-3);
  cursor: pointer;
  transition: all 0.12s;
}
.tweak-btn:hover { background: var(--bg-2); color: var(--ink-1); }
.tweak-btn.active { background: var(--accent-soft); color: var(--accent-ink); border-color: var(--accent); }
</style>
