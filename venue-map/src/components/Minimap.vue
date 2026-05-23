<script setup lang="ts">
import { computed } from 'vue'
import { getCategoryById } from '@/data/seed'
import { VENUE_WIDTH, VENUE_HEIGHT } from '@/data/seed'
import type { Tenant } from '@/types'

const props = defineProps<{
  tenants: Tenant[]
  pan: { x: number; y: number }
  zoom: number
  viewportSize: { w: number; h: number }
}>()

const W = 200
const H = 140
const HEADER_H = 26

const innerH = H - HEADER_H

const s = computed(() => {
  const sx = W / VENUE_WIDTH
  const sy = innerH / VENUE_HEIGHT
  return Math.min(sx, sy)
})

const offsetX = computed(() => (W - VENUE_WIDTH * s.value) / 2)
const offsetY = computed(() => (innerH - VENUE_HEIGHT * s.value) / 2)

const vpStyle = computed(() => ({
  left: `${offsetX.value + (-props.pan.x / props.zoom) * s.value}px`,
  top: `${HEADER_H + offsetY.value + (-props.pan.y / props.zoom) * s.value}px`,
  width: `${(props.viewportSize.w / props.zoom) * s.value}px`,
  height: `${(props.viewportSize.h / props.zoom) * s.value}px`,
}))
</script>

<template>
  <div class="minimap">
    <div class="minimap-hd">マップ</div>
    <div class="minimap-canvas" :style="{ width: W + 'px', height: (H - HEADER_H) + 'px' }">
      <div
        v-for="t in tenants"
        :key="t.id"
        class="minimap-tenant"
        :style="{
          left: `${offsetX + t.x * s}px`,
          top: `${offsetY + t.y * s}px`,
          width: `${Math.max(3, t.w * s)}px`,
          height: `${Math.max(3, t.h * s)}px`,
          background: getCategoryById(t.cat).color,
        }"
      />
      <div class="minimap-viewport" :style="vpStyle" />
    </div>
  </div>
</template>

<style scoped>
.minimap {
  position: absolute;
  bottom: 12px;
  right: 12px;
  z-index: 50;
  background: rgba(250, 249, 247, 0.88);
  backdrop-filter: blur(12px);
  border: 0.5px solid rgba(255, 255, 255, 0.5);
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.14);
  overflow: hidden;
}
.minimap-hd {
  height: 26px;
  display: flex;
  align-items: center;
  padding: 0 10px;
  font-size: 10.5px;
  font-weight: 700;
  color: var(--ink-3);
  text-transform: uppercase;
  letter-spacing: .06em;
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.08);
}
.minimap-canvas {
  position: relative;
  overflow: hidden;
}
.minimap-tenant {
  position: absolute;
  border-radius: 2px;
}
.minimap-viewport {
  position: absolute;
  border: 1.5px solid var(--accent);
  border-radius: 3px;
  background: rgba(224, 117, 80, 0.08);
  pointer-events: none;
}
</style>
