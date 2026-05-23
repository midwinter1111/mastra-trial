<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useTenantsStore } from '@/stores/tenants'
import { useToolsStore } from '@/stores/tools'
import { useUIStore } from '@/stores/ui'
import { useAIStore } from '@/stores/ai'
import Icon from './icons/Icon.vue'

const tenantsStore = useTenantsStore()
const toolsStore = useToolsStore()
const uiStore = useUIStore()
const aiStore = useAIStore()

const { canUndo, canRedo, selectedIds } = storeToRefs(tenantsStore)
const { mode } = storeToRefs(toolsStore)
const { panelOpen } = storeToRefs(aiStore)
</script>

<template>
  <div class="topbar">
    <div class="brand">
      <div class="brand-mark">設</div>
      <div>
        <div class="brand-name">VenueMap</div>
        <div class="brand-sub">マルシェ会場 · 設営＆運営</div>
      </div>
    </div>

    <button class="event-pill" type="button">
      <span class="dot" />
      <span>春のマルシェ 2026</span>
      <span class="when">5/24(土)—5/25(日)</span>
      <Icon name="chevron_down" :size="12" class="chev" />
    </button>

    <div class="top-divider" />

    <button
      class="icon-btn"
      :disabled="!canUndo"
      title="元に戻す (Ctrl+Z)"
      @click="tenantsStore.undo()"
    >
      <Icon name="undo" />
    </button>
    <button
      class="icon-btn"
      :disabled="!canRedo"
      title="やり直し (Ctrl+Shift+Z)"
      @click="tenantsStore.redo()"
    >
      <Icon name="redo" />
    </button>

    <div class="top-spacer" />

    <div class="mode-tabs">
      <button
        :class="['mode-tab', mode === 'edit' && 'on']"
        @click="toolsStore.setMode('edit')"
      >
        <Icon name="edit" />
        設営モード
      </button>
      <button
        :class="['mode-tab', mode === 'operate' && 'on']"
        @click="toolsStore.setMode('operate')"
      >
        <Icon name="bullhorn" />
        運営モード
      </button>
    </div>

    <div class="top-divider" />

    <button
      v-if="selectedIds.size > 0"
      class="btn sm"
      @click="uiStore.openAssign([...selectedIds])"
    >
      <Icon name="number" />
      <span>番号付与</span>
    </button>

    <button
      :class="['btn', 'sm', panelOpen ? 'primary' : 'ghost', 'ai-btn']"
      title="AIアシスタント"
      @click="aiStore.togglePanel()"
    >
      <Icon name="ai_sparkle" />
      <span>AI</span>
    </button>

    <button class="btn sm primary">
      <Icon name="check" />
      <span>公開</span>
    </button>
  </div>
</template>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  z-index: 30;
  position: relative;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-right: 14px;
  margin-right: 4px;
  border-right: 1px solid var(--divider);
  height: 36px;
}
.brand-mark {
  width: 34px;
  height: 34px;
  border-radius: 11px;
  background: linear-gradient(135deg, var(--accent) 0%, #f0926d 100%);
  display: grid;
  place-items: center;
  color: var(--on-accent);
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 16px;
  box-shadow: 0 2px 0 rgba(196, 92, 58, 0.6), 0 4px 8px rgba(224, 117, 80, 0.3);
}
.brand-name { font-family: var(--font-display); font-size: 16px; font-weight: 600; line-height: 1.1; }
.brand-sub { font-size: 10.5px; color: var(--ink-3); letter-spacing: 0.04em; margin-top: 1px; }

.event-pill {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 36px;
  padding: 0 12px 0 14px;
  border-radius: var(--r-pill);
  background: var(--bg-2);
  border: 1px solid transparent;
  font-size: 13px;
  font-weight: 500;
  color: var(--ink-1);
  white-space: nowrap;
}
.event-pill:hover { background: var(--surface); border-color: var(--border); }
.event-pill .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--status-open); box-shadow: 0 0 0 3px rgba(91, 148, 102, 0.18); }
.event-pill .chev { color: var(--ink-3); margin-left: 2px; }
.event-pill .when { font-size: 11px; color: var(--ink-3); font-family: var(--font-mono); }

.top-spacer { flex: 1; }
.top-divider { width: 1px; height: 24px; background: var(--divider); margin: 0 2px; }

.mode-tabs { display: flex; background: var(--bg-2); border-radius: var(--r-pill); padding: 3px; }
.mode-tab {
  height: 30px;
  padding: 0 14px;
  border: 0;
  background: transparent;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--ink-2);
  border-radius: var(--r-pill);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s;
  white-space: nowrap;
}
.mode-tab svg { width: 13px; height: 13px; }
.mode-tab.on { background: var(--surface); color: var(--ink-1); box-shadow: var(--shadow-sm); font-weight: 600; }

.ai-btn.primary { background: var(--accent); color: var(--on-accent); }
</style>
