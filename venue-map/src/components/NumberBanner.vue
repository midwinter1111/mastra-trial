<script setup lang="ts">
const props = defineProps<{
  next: number
  trailLen: number
}>()

const emit = defineEmits<{
  'update:next': [val: number]
  reset: []
  done: []
}>()
</script>

<template>
  <div class="number-banner">
    <Icon name="number" />
    <span class="text">
      番号付与モード · 次は <strong>#{{ next }}</strong> から
      <template v-if="trailLen > 0"> · 今回 <strong>{{ trailLen }}</strong>件付与</template>
    </span>
    <div class="stepper">
      <button @click="emit('update:next', Math.max(0, next - 1))" title="前の番号">
        <Icon name="minus" :size="12" />
      </button>
      <span class="v">#{{ next }}</span>
      <button @click="emit('update:next', next + 1)" title="次の番号">
        <Icon name="plus" :size="12" />
      </button>
    </div>
    <button v-if="trailLen > 0" class="btn sm ghost" title="軌跡を消す" @click="emit('reset')">
      <Icon name="close" />
    </button>
    <button class="btn sm primary" @click="emit('done')">
      <Icon name="check" />
      <span>完了</span>
    </button>
  </div>
</template>

<script lang="ts">
import Icon from './icons/Icon.vue'
</script>

<style scoped>
.number-banner {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(250, 249, 247, 0.92);
  backdrop-filter: blur(16px) saturate(160%);
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: var(--r-pill);
  padding: 6px 10px 6px 14px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.14);
  white-space: nowrap;
  font-size: 13px;
  color: var(--ink-1);
}
.number-banner svg { width: 16px; height: 16px; color: var(--accent); }
.text { font-weight: 500; }
.stepper {
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--bg-2);
  border-radius: 8px;
  padding: 1px;
}
.stepper button {
  width: 24px;
  height: 24px;
  border: 0;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ink-2);
}
.stepper button:hover { background: var(--surface); }
.stepper button svg { width: 12px; height: 12px; }
.stepper .v { font-family: var(--font-mono); font-weight: 700; font-size: 13px; padding: 0 6px; min-width: 36px; text-align: center; }
</style>
