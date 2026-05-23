<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useToolsStore } from '@/stores/tools'
import Icon from './icons/Icon.vue'

const toolsStore = useToolsStore()
const { mode, tool } = storeToRefs(toolsStore)

const editTools = [
  { id: 'select', icon: 'cursor',  short: 'V', title: '選択ツール (V)' },
  { id: 'add',    icon: 'add_box', short: 'T', title: 'テナント追加 (T)' },
  { id: 'pan',    icon: 'pan',     short: 'H', title: '手のひらツール (H)' },
] as const

const operateTools = [
  { id: 'select', icon: 'cursor', short: 'V', title: '選択ツール (V)' },
  { id: 'number', icon: 'number', short: 'N', title: '番号付与モード — なぞりで連番 (N)' },
  { id: 'pan',    icon: 'pan',    short: 'H', title: '手のひらツール (H)' },
] as const
</script>

<template>
  <nav class="rail">
    <template v-for="t in (mode === 'edit' ? editTools : operateTools)" :key="t.id">
      <button
        :class="['tool-btn', tool === t.id && 'active', t.id === 'number' && 'tool-number']"
        :title="t.title"
        @click="toolsStore.setTool(t.id)"
      >
        <Icon :name="t.icon" />
        <span class="shortcut">{{ t.short }}</span>
      </button>
    </template>

    <div class="rail-divider" />

    <button class="tool-btn" title="レイヤー">
      <Icon name="layers" />
    </button>
    <button class="tool-btn" title="ガイド">
      <Icon name="ruler" />
    </button>
  </nav>
</template>

<style scoped>
.rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 0;
  background: var(--surface);
  border-right: 1px solid var(--border);
  z-index: 20;
}
.tool-btn {
  position: relative;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--ink-3);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.12s;
}
.tool-btn:hover { background: var(--bg-2); color: var(--ink-1); }
.tool-btn.active {
  background: var(--accent-soft);
  color: var(--accent-ink);
  box-shadow: 0 0 0 1.5px var(--accent) inset;
}
.tool-btn.tool-number.active { background: var(--accent); color: var(--on-accent); }
.tool-btn svg { width: 18px; height: 18px; }
.shortcut {
  position: absolute;
  bottom: 3px;
  right: 4px;
  font-size: 8px;
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--ink-4);
  line-height: 1;
}
.tool-btn.active .shortcut { color: var(--accent-ink); opacity: 0.7; }
.tool-btn.tool-number.active .shortcut { color: var(--on-accent); opacity: 0.7; }
.rail-divider { width: 24px; height: 1px; background: var(--divider); margin: 4px 0; }
</style>
