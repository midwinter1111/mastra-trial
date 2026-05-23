<script setup lang="ts">
import { computed } from 'vue'
import { getCategoryById } from '@/data/seed'
import type { Tenant, TileStyle } from '@/types'

const props = defineProps<{
  tenant: Tenant
  selected: boolean
  tileStyle: TileStyle
  numHover?: boolean
  inTrail?: boolean
  showResize: boolean
}>()

const emit = defineEmits<{
  pointerdown: [e: PointerEvent]
  resizeStart: [e: PointerEvent]
  dblclick: []
}>()

const cat = computed(() => getCategoryById(props.tenant.cat))
const small = computed(() => props.tenant.w < 110 || props.tenant.h < 75)

const cls = computed(() => [
  'tenant-box',
  `style-${props.tileStyle}`,
  props.selected && 'selected',
  small.value && 'small',
  props.numHover && 'num-hover',
  props.inTrail && 'num-flash',
])

const baseStyle = computed(() => ({
  left: `${props.tenant.x}px`,
  top: `${props.tenant.y}px`,
  width: `${props.tenant.w}px`,
  height: `${props.tenant.h}px`,
}))

const numLabel = computed(() =>
  props.tenant.num != null ? `#${String(props.tenant.num).padStart(2, '0')}` : '—'
)

const statusLabel = computed(() => {
  if (props.tenant.status === 'open') return '営業中'
  if (props.tenant.status === 'prep') return '準備中'
  return '閉店'
})
</script>

<template>
  <!-- badge style -->
  <div
    v-if="tileStyle === 'badge'"
    :class="cls"
    :style="{ ...baseStyle, background: cat.color, color: '#fff' }"
    @pointerdown="(e) => emit('pointerdown', e)"
    @dblclick="emit('dblclick')"
  >
    <div :class="['badge-num', tenant.num == null && 'unassigned']">
      {{ tenant.num == null ? '—' : tenant.num }}
    </div>
    <div class="badge-text">
      <div class="badge-name">{{ tenant.name }}</div>
      <div class="badge-cat">{{ cat.label }}</div>
    </div>
    <div v-if="selected && showResize" class="resize-handle se" @pointerdown.stop="(e) => emit('resizeStart', e)" />
  </div>

  <!-- pin style -->
  <div
    v-else-if="tileStyle === 'pin'"
    :class="cls"
    :style="{ ...baseStyle, borderColor: cat.color }"
    @pointerdown="(e) => emit('pointerdown', e)"
    @dblclick="emit('dblclick')"
  >
    <div class="pin" :style="{ background: cat.color, transform: 'translate(-50%, -50%) rotate(-45deg)' }">
      <span class="pin-inner">{{ tenant.num == null ? '—' : tenant.num }}</span>
    </div>
    <div class="pin-label">{{ tenant.name }}</div>
    <div v-if="selected && showResize" class="resize-handle se" @pointerdown.stop="(e) => emit('resizeStart', e)" />
  </div>

  <!-- card style (default) -->
  <div
    v-else
    :class="cls"
    :style="{ ...baseStyle, background: cat.soft, borderColor: cat.color }"
    @pointerdown="(e) => emit('pointerdown', e)"
    @dblclick="emit('dblclick')"
  >
    <div class="tb-head" :style="{ background: cat.color }">
      <span class="mono">{{ numLabel }}</span>
      <span style="font-size:9px;opacity:0.85">{{ statusLabel }}</span>
    </div>
    <div class="tb-body">
      <div class="tb-name">{{ tenant.name }}</div>
      <div class="tb-cat">{{ cat.label }} · {{ tenant.size }}</div>
    </div>
    <div v-if="selected && showResize" class="resize-handle se" @pointerdown.stop="(e) => emit('resizeStart', e)" />
  </div>
</template>

<style scoped>
.tenant-box {
  position: absolute;
  border-radius: 8px;
  border: 1.5px solid transparent;
  overflow: hidden;
  cursor: pointer;
  user-select: none;
  transition: box-shadow 0.12s, transform 0.08s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}
.tenant-box:hover { box-shadow: 0 2px 8px rgba(0, 0, 0, 0.14); }
.tenant-box.selected {
  box-shadow: 0 0 0 2px var(--accent), 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 5;
}
.tenant-box.num-hover { box-shadow: 0 0 0 2.5px #f59e0b, 0 4px 12px rgba(0, 0, 0, 0.15); z-index: 6; }
.tenant-box.num-flash { animation: numflash 0.35s ease-out; }

/* Card */
.style-card { border-width: 1.5px; }
.tb-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.95);
  min-height: 22px;
}
.tb-head .mono { font-family: var(--font-mono); }
.tb-body { padding: 5px 8px; }
.tb-name { font-size: 11.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ink-1); }
.tb-cat { font-size: 10px; color: var(--ink-3); margin-top: 1px; }
.small .tb-body { padding: 3px 6px; }
.small .tb-name { font-size: 10.5px; }

/* Badge */
.style-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border: 0;
}
.badge-num {
  font-family: var(--font-mono);
  font-size: 16px;
  font-weight: 800;
  min-width: 26px;
  text-align: center;
  flex-shrink: 0;
}
.badge-num.unassigned { opacity: 0.5; }
.badge-text { flex: 1; min-width: 0; }
.badge-name { font-size: 11.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.badge-cat { font-size: 10px; opacity: 0.75; }

/* Pin */
.style-pin {
  background: transparent !important;
  border: 2px dashed;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
.pin {
  width: 32px;
  height: 32px;
  border-radius: 50% 50% 50% 0;
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  top: 50%;
  left: 50%;
}
.pin-inner {
  transform: rotate(45deg);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 800;
  color: #fff;
  display: block;
}
.pin-label {
  position: absolute;
  bottom: 4px;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 10px;
  font-weight: 600;
  color: var(--ink-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0 4px;
}

/* Resize handle */
.resize-handle {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 3px;
  background: var(--accent);
  border: 2px solid var(--surface);
  z-index: 10;
  cursor: se-resize;
}
.resize-handle.se { bottom: -5px; right: -5px; }
</style>
