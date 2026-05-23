<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useTenantsStore } from '@/stores/tenants'
import { useToolsStore } from '@/stores/tools'
import { useVenueStore } from '@/stores/venue'
import { useTweaksStore } from '@/stores/tweaks'
import { useUIStore } from '@/stores/ui'
import { VENUE_WIDTH, VENUE_HEIGHT, STRUCTURES, ZONES } from '@/data/seed'
import type { Tenant, TrailEntry } from '@/types'
import TenantBox from './TenantBox.vue'
import NumberBanner from './NumberBanner.vue'
import Minimap from './Minimap.vue'
import Icon from './icons/Icon.vue'

const GRID = 20

const tenantsStore = useTenantsStore()
const toolsStore = useToolsStore()
const venueStore = useVenueStore()
const tweaksStore = useTweaksStore()
const uiStore = useUIStore()

const { tenants, selectedIds } = storeToRefs(tenantsStore)
const { mode, tool } = storeToRefs(toolsStore)
const { zoom, pan } = storeToRefs(venueStore)
const { showGrid, gridStyle, showCoords, showMinimap, tileStyle } = storeToRefs(tweaksStore)

const viewportRef = ref<HTMLElement | null>(null)
const viewportSize = ref({ w: 0, h: 0 })
const crumbs = ref({ x: 0, y: 0 })
const dropPreview = ref<{ x: number; y: number; w: number; h: number } | null>(null)
const lasso = ref<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
const hoverTenantId = ref<string | null>(null)
const cursorPos = ref<{ x: number; y: number } | null>(null)

const trail = ref<TrailEntry[]>([])
const nextStart = ref(1)

// Track next start from current data on mount
onMounted(() => {
  nextStart.value = tenantsStore.computeNextStart()
})

// Auto-fit on first viewport measurement
let didFit = false
const ro = new ResizeObserver((entries) => {
  for (const e of entries) {
    const r = e.contentRect
    viewportSize.value = { w: r.width, h: r.height }
    if (!didFit && r.width > 200 && r.height > 200) {
      venueStore.fitToViewport(r.width, r.height, VENUE_WIDTH, VENUE_HEIGHT)
      didFit = true
    }
  }
})

onMounted(() => {
  if (viewportRef.value) ro.observe(viewportRef.value)
  window.addEventListener('keydown', onSpaceDown)
  window.addEventListener('keyup', onSpaceUp)
})
onUnmounted(() => {
  ro.disconnect()
  window.removeEventListener('keydown', onSpaceDown)
  window.removeEventListener('keyup', onSpaceUp)
})

// Reset trail when leaving number tool
watch(tool, (t) => { if (t !== 'number') trail.value = [] })

const spacePan = ref(false)
function onSpaceDown(e: KeyboardEvent) { if (e.code === 'Space' && !e.repeat) spacePan.value = true }
function onSpaceUp(e: KeyboardEvent) { if (e.code === 'Space') spacePan.value = false }
const isPanning = computed(() => tool.value === 'pan' || spacePan.value)

function screenToCanvas(sx: number, sy: number) {
  const r = viewportRef.value!.getBoundingClientRect()
  return {
    x: (sx - r.left - pan.value.x) / zoom.value,
    y: (sy - r.top - pan.value.y) / zoom.value,
  }
}

function snap(n: number) { return Math.round(n / GRID) * GRID }

function hitTest(cx: number, cy: number): Tenant | null {
  const hits = tenants.value.filter((t) =>
    cx >= t.x && cx <= t.x + t.w && cy >= t.y && cy <= t.y + t.h
  )
  if (!hits.length) return null
  hits.sort((a, b) => (a.w * a.h) - (b.w * b.h))
  return hits[0]
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  if (e.ctrlKey || e.metaKey) {
    const r = viewportRef.value!.getBoundingClientRect()
    const mx = e.clientX - r.left
    const my = e.clientY - r.top
    const nz = Math.max(0.25, Math.min(2.5, zoom.value * (1 - e.deltaY * 0.0015)))
    const cx = (mx - pan.value.x) / zoom.value
    const cy = (my - pan.value.y) / zoom.value
    venueStore.zoom = nz
    venueStore.pan = { x: mx - cx * nz, y: my - cy * nz }
  } else {
    venueStore.pan = { x: pan.value.x - e.deltaX, y: pan.value.y - e.deltaY }
  }
}

function onMouseMove(e: MouseEvent) {
  const c = screenToCanvas(e.clientX, e.clientY)
  crumbs.value = { x: Math.round(c.x), y: Math.round(c.y) }
  if (tool.value === 'number' && viewportRef.value) {
    const r = viewportRef.value.getBoundingClientRect()
    cursorPos.value = { x: e.clientX - r.left, y: e.clientY - r.top }
    const t = hitTest(c.x, c.y)
    hoverTenantId.value = t ? t.id : null
  }
}

function onMouseLeave() {
  hoverTenantId.value = null
  cursorPos.value = null
}

function onViewportDown(e: PointerEvent) {
  if ((e.target as HTMLElement).closest('.resize-handle')) return

  // Pan (spacebar or middle button)
  if (isPanning.value || e.button === 1) {
    const sx = e.clientX, sy = e.clientY
    const start = { ...pan.value }
    const move = (ev: PointerEvent) => venueStore.pan = { x: start.x + (ev.clientX - sx), y: start.y + (ev.clientY - sy) }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return
  }

  // Number sweep
  if (tool.value === 'number') {
    const c0 = screenToCanvas(e.clientX, e.clientY)
    const t0 = hitTest(c0.x, c0.y)
    beginSweep(t0, e)
    return
  }

  // Add tool — drag out a new tenant
  if (tool.value === 'add') {
    if ((e.target as HTMLElement).closest('.tenant-box')) return
    const start = screenToCanvas(e.clientX, e.clientY)
    const x0 = snap(start.x), y0 = snap(start.y)
    dropPreview.value = { x: x0, y: y0, w: GRID * 5, h: GRID * 5 }
    const move = (ev: PointerEvent) => {
      const c = screenToCanvas(ev.clientX, ev.clientY)
      const x1 = snap(c.x), y1 = snap(c.y)
      dropPreview.value = {
        x: Math.min(x0, x1), y: Math.min(y0, y1),
        w: Math.max(GRID * 3, Math.abs(x1 - x0) || GRID * 5),
        h: Math.max(GRID * 3, Math.abs(y1 - y0) || GRID * 5),
      }
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      const c = screenToCanvas(ev.clientX, ev.clientY)
      const x1 = snap(c.x), y1 = snap(c.y)
      const x = Math.min(x0, x1), y = Math.min(y0, y1)
      const w = Math.max(GRID * 3, Math.abs(x1 - x0) || GRID * 5)
      const h = Math.max(GRID * 3, Math.abs(y1 - y0) || GRID * 5)
      addNewTenant(x, y, w, h)
      dropPreview.value = null
      toolsStore.setTool('select')
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return
  }

  // Select tool — lasso on empty canvas
  if (tool.value === 'select' && e.button === 0 && !(e.target as HTMLElement).closest('.tenant-box')) {
    const start = screenToCanvas(e.clientX, e.clientY)
    lasso.value = { x0: start.x, y0: start.y, x1: start.x, y1: start.y }
    tenantsStore.selectedIds = new Set()
    const move = (ev: PointerEvent) => {
      const c = screenToCanvas(ev.clientX, ev.clientY)
      lasso.value = { x0: start.x, y0: start.y, x1: c.x, y1: c.y }
      const xMin = Math.min(start.x, c.x), xMax = Math.max(start.x, c.x)
      const yMin = Math.min(start.y, c.y), yMax = Math.max(start.y, c.y)
      const ids = new Set<string>()
      tenants.value.forEach((t) => {
        if (t.x + t.w >= xMin && t.x <= xMax && t.y + t.h >= yMin && t.y <= yMax) ids.add(t.id)
      })
      tenantsStore.selectedIds = ids
    }
    const up = () => {
      lasso.value = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
}

// Number trail sweep
function beginSweep(initialTenant: Tenant | null, e: PointerEvent) {
  let collected = [...trail.value]
  let nextNum = nextStart.value

  function addToTrail(t: Tenant | null) {
    if (!t) return
    if (collected.some((c) => c.id === t.id)) return
    const entry: TrailEntry = { id: t.id, num: nextNum, cx: t.x + t.w / 2, cy: t.y + t.h / 2 }
    collected = [...collected, entry]
    nextNum += 1
    trail.value = collected
    nextStart.value = nextNum
  }

  addToTrail(initialTenant)

  const move = (ev: PointerEvent) => {
    const c = screenToCanvas(ev.clientX, ev.clientY)
    const t = hitTest(c.x, c.y)
    if (viewportRef.value) {
      const r = viewportRef.value.getBoundingClientRect()
      cursorPos.value = { x: ev.clientX - r.left, y: ev.clientY - r.top }
    }
    addToTrail(t)
  }

  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    if (collected.length > 0) {
      const prior = trail.value
      const fresh = collected.filter((c) => !prior.some((p) => p.id === c.id && p.num === c.num))
      if (fresh.length) {
        tenantsStore.assignNumbers(fresh.map((c) => ({ id: c.id, num: c.num })))
      }
    }
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

// Drag-from-sidebar drop
function onDragOver(e: DragEvent) {
  if (!e.dataTransfer?.types.includes('text/tenant-id')) return
  e.preventDefault()
  e.dataTransfer.dropEffect = 'copy'
  const c = screenToCanvas(e.clientX, e.clientY)
  dropPreview.value = { x: snap(c.x) - 50, y: snap(c.y) - 50, w: 100, h: 100 }
}
function onDragLeave() { dropPreview.value = null }
function onDrop(e: DragEvent) {
  const id = e.dataTransfer?.getData('text/tenant-id')
  if (!id) return
  const c = screenToCanvas(e.clientX, e.clientY)
  const x = snap(c.x) - 50, y = snap(c.y) - 50
  const newId = tenantsStore.placeFromUnplaced(id, x, y, 100, 100)
  if (newId) tenantsStore.selectedIds = new Set([newId])
  dropPreview.value = null
}

function addNewTenant(x: number, y: number, w: number, h: number) {
  const newId = 't' + Date.now().toString().slice(-6)
  const newTenant: Tenant = {
    id: newId, num: null, name: '新規テナント', cat: 'food', status: 'prep',
    x, y, w, h, contact: '', phone: '', power: false,
    size: `${(w / 100).toFixed(1)} x ${(h / 100).toFixed(1)}m`, memo: '',
  }
  tenantsStore.addTenant(newTenant)
  tenantsStore.selectedIds = new Set([newId])
  uiStore.openEdit(newId)
}

function onTenantDown(tenant: Tenant, e: PointerEvent) {
  if (tool.value === 'number') return
  if (tool.value !== 'select') return
  e.stopPropagation()

  const isShift = e.shiftKey || e.metaKey
  let nextSel = new Set(selectedIds.value)
  if (isShift) {
    if (nextSel.has(tenant.id)) nextSel.delete(tenant.id)
    else nextSel.add(tenant.id)
  } else {
    if (!nextSel.has(tenant.id)) nextSel = new Set([tenant.id])
  }
  tenantsStore.selectedIds = nextSel

  if (mode.value !== 'edit') return

  const ids = Array.from(nextSel)
  const starts: Record<string, { x: number; y: number }> = {}
  ids.forEach((id) => {
    const t = tenants.value.find((x) => x.id === id)
    if (t) starts[id] = { x: t.x, y: t.y }
  })
  const sx = e.clientX, sy = e.clientY
  const move = (ev: PointerEvent) => {
    const dx = (ev.clientX - sx) / zoom.value
    const dy = (ev.clientY - sy) / zoom.value
    const updates: Record<string, { x: number; y: number }> = {}
    ids.forEach((id) => {
      const s = starts[id]
      updates[id] = { x: snap(s.x + dx), y: snap(s.y + dy) }
    })
    tenantsStore.moveTenants(updates)
  }
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

function onResizeStart(tenant: Tenant, e: PointerEvent) {
  e.stopPropagation()
  const sx = e.clientX, sy = e.clientY
  const sw = tenant.w, sh = tenant.h
  const move = (ev: PointerEvent) => {
    const dw = (ev.clientX - sx) / zoom.value
    const dh = (ev.clientY - sy) / zoom.value
    tenantsStore.resizeTenant(tenant.id, {
      w: Math.max(GRID * 3, snap(sw + dw)),
      h: Math.max(GRID * 3, snap(sh + dh)),
    })
  }
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

function onFit() {
  venueStore.fitToViewport(viewportSize.value.w, viewportSize.value.h, VENUE_WIDTH, VENUE_HEIGHT)
}

const trailPath = computed(() => {
  if (trail.value.length < 2) return ''
  return trail.value.map((p, i) => (i === 0 ? `M${p.cx},${p.cy}` : `L${p.cx},${p.cy}`)).join(' ')
})

const cursorStyle = computed(() =>
  isPanning.value ? 'grab' : tool.value === 'add' ? 'crosshair' : 'default'
)

function clearTrail() { trail.value = [] }
</script>

<template>
  <div :class="['canvas-area', tool === 'number' && 'tool-number']">
    <!-- Canvas toolbar -->
    <div class="canvas-toolbar">
      <div class="crumb">
        <span>会場</span>
        <span class="sep">/</span>
        <span>中央広場</span>
        <span class="sep">/</span>
        <span class="now">レイアウト</span>
      </div>
      <div class="spacer" />
      <div class="tile-seg">
        <button :class="tileStyle === 'card' && 'on'" title="カード表示" @click="tweaksStore.tileStyle = 'card'">
          <Icon name="grid" />カード
        </button>
        <button :class="tileStyle === 'pin' && 'on'" title="ピン表示" @click="tweaksStore.tileStyle = 'pin'">
          <Icon name="number" />ピン
        </button>
      </div>
      <div class="tb-divider" />
      <button class="btn sm ghost" @click="onFit">
        <Icon name="fit" />
        <span>フィット</span>
      </button>
      <div class="zoom-ctl">
        <button @click="venueStore.zoom = Math.max(0.25, zoom - 0.1)"><Icon name="minus" :size="12" /></button>
        <span class="val">{{ (zoom * 100).toFixed(0) }}%</span>
        <button @click="venueStore.zoom = Math.min(2.5, zoom + 0.1)"><Icon name="plus" :size="12" /></button>
      </div>
    </div>

    <!-- Viewport -->
    <div
      ref="viewportRef"
      class="canvas-viewport"
      :style="{ cursor: cursorStyle }"
      @wheel.passive="false"
      @wheel="onWheel"
      @mousemove="onMouseMove"
      @mouseleave="onMouseLeave"
      @pointerdown="onViewportDown"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <!-- Coord overlay -->
      <div v-if="showCoords" class="coord-overlay">
        x {{ String(crumbs.x).padStart(4, ' ') }} · y {{ String(crumbs.y).padStart(4, ' ') }} · {{ (zoom * 100).toFixed(0) }}%
      </div>

      <!-- Number banner -->
      <NumberBanner
        v-if="tool === 'number'"
        :next="nextStart"
        :trail-len="trail.length"
        @update:next="nextStart = $event"
        @reset="clearTrail"
        @done="toolsStore.setTool('select')"
      />

      <!-- Stage -->
      <div
        class="canvas-stage"
        :style="{
          width: VENUE_WIDTH + 'px',
          height: VENUE_HEIGHT + 'px',
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }"
      >
        <!-- Grid -->
        <div
          v-if="showGrid && gridStyle !== 'none'"
          :class="['canvas-grid', gridStyle === 'dots' ? 'dotted' : 'major']"
        />

        <!-- Structures -->
        <template v-for="(s, i) in STRUCTURES" :key="i">
          <div
            v-if="s.type === 'wall'"
            class="wall"
            :style="{ left: s.x + 'px', top: s.y + 'px', width: s.w + 'px', height: s.h + 'px' }"
          />
          <div
            v-else-if="s.type === 'entrance'"
            class="entrance"
            :style="{ left: s.x + 'px', top: s.y + 'px', width: s.w + 'px', height: s.h + 'px' }"
          >
            <Icon name="chevron_down" />{{ s.label }}
          </div>
        </template>

        <!-- Zone labels -->
        <div
          v-for="(z, i) in ZONES"
          :key="'z' + i"
          class="zone-label"
          :style="{ left: z.x + 'px', top: z.y + 'px' }"
        >
          {{ z.label }}
        </div>

        <!-- Lasso -->
        <div
          v-if="lasso"
          class="lasso"
          :style="{
            left: Math.min(lasso.x0, lasso.x1) + 'px',
            top: Math.min(lasso.y0, lasso.y1) + 'px',
            width: Math.abs(lasso.x1 - lasso.x0) + 'px',
            height: Math.abs(lasso.y1 - lasso.y0) + 'px',
          }"
        />

        <!-- Drop preview -->
        <div
          v-if="dropPreview"
          class="drop-preview"
          :style="{
            left: dropPreview.x + 'px',
            top: dropPreview.y + 'px',
            width: dropPreview.w + 'px',
            height: dropPreview.h + 'px',
          }"
        />

        <!-- Tenants -->
        <TenantBox
          v-for="t in tenants"
          :key="t.id"
          :tenant="t"
          :selected="selectedIds.has(t.id)"
          :tile-style="tileStyle"
          :num-hover="tool === 'number' && hoverTenantId === t.id"
          :in-trail="trail.some((x) => x.id === t.id)"
          :show-resize="mode === 'edit'"
          @pointerdown="(e) => onTenantDown(t, e)"
          @resize-start="(e) => onResizeStart(t, e)"
          @dblclick="uiStore.openDetail(t.id)"
        />

        <!-- Number trail SVG -->
        <svg v-if="trail.length > 0" class="num-trail-svg">
          <path v-if="trailPath" :d="trailPath" />
          <g v-for="p in trail" :key="p.id">
            <circle :cx="p.cx" :cy="p.cy" r="16" />
            <text :x="p.cx" :y="p.cy">{{ p.num }}</text>
          </g>
        </svg>
      </div>

      <!-- Cursor badge (number mode) -->
      <div
        v-if="tool === 'number' && cursorPos"
        class="cursor-badge"
        :style="{ left: cursorPos.x + 'px', top: cursorPos.y + 'px' }"
      >
        次は #{{ nextStart }}
      </div>

      <!-- Minimap -->
      <Minimap
        v-if="showMinimap"
        :tenants="tenants"
        :pan="pan"
        :zoom="zoom"
        :viewport-size="viewportSize"
      />
    </div>
  </div>
</template>

<style scoped>
.canvas-area {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg);
  z-index: 1;
}
.canvas-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  height: 36px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.crumb { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ink-3); }
.crumb .sep { color: var(--ink-4); }
.crumb .now { color: var(--ink-2); font-weight: 600; }
.spacer { flex: 1; }
.tb-divider { width: 1px; height: 18px; background: var(--divider); margin: 0 2px; }
.tile-seg {
  display: flex;
  background: var(--bg-2);
  border-radius: 8px;
  padding: 2px;
  gap: 1px;
}
.tile-seg button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 0 9px;
  border: 0;
  background: transparent;
  border-radius: 6px;
  font-size: 11.5px;
  font-weight: 500;
  color: var(--ink-3);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.12s;
}
.tile-seg button svg { width: 12px; height: 12px; }
.tile-seg button:hover { color: var(--ink-1); }
.tile-seg button.on { background: var(--surface); color: var(--ink-1); font-weight: 600; box-shadow: var(--shadow-sm); }
.zoom-ctl {
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--bg-2);
  border-radius: 8px;
  padding: 2px;
}
.zoom-ctl button {
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
.zoom-ctl button:hover { background: var(--surface); }
.zoom-ctl button svg { width: 12px; height: 12px; }
.zoom-ctl .val { font-family: var(--font-mono); font-size: 12px; font-weight: 600; min-width: 38px; text-align: center; }

.canvas-viewport {
  flex: 1;
  overflow: hidden;
  position: relative;
}
.canvas-stage {
  position: absolute;
  transform-origin: 0 0;
  background: var(--venue-bg);
  border-radius: 4px;
  box-shadow: 0 0 0 2px var(--venue-border);
}

/* Grid */
.canvas-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.canvas-grid.major {
  background-image:
    linear-gradient(to right, var(--grid-line) 1px, transparent 1px),
    linear-gradient(to bottom, var(--grid-line) 1px, transparent 1px);
  background-size: 20px 20px;
}
.canvas-grid.dotted {
  background-image: radial-gradient(circle, var(--grid-dot) 1px, transparent 1px);
  background-size: 20px 20px;
}

/* Structures */
.wall {
  position: absolute;
  background: var(--wall-fill);
  border: 1.5px solid var(--wall-stroke);
  border-radius: 3px;
}
.entrance {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: var(--entrance-fill);
  border: 1.5px dashed var(--entrance-stroke);
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--entrance-text);
  letter-spacing: .04em;
}
.entrance svg { width: 13px; height: 13px; }
.zone-label {
  position: absolute;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .12em;
  color: var(--ink-4);
  pointer-events: none;
}

/* Lasso */
.lasso {
  position: absolute;
  border: 1.5px solid var(--accent);
  background: rgba(224, 117, 80, 0.06);
  border-radius: 4px;
  pointer-events: none;
}

/* Drop preview */
.drop-preview {
  position: absolute;
  border: 2px dashed var(--accent);
  background: var(--accent-soft);
  border-radius: 8px;
  pointer-events: none;
  opacity: 0.7;
}

/* Number trail SVG */
.num-trail-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
}
.num-trail-svg path {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2.5;
  stroke-dasharray: 6 4;
  stroke-linecap: round;
  opacity: 0.6;
}
.num-trail-svg circle { fill: var(--accent); opacity: 0.85; }
.num-trail-svg text {
  fill: var(--on-accent);
  font-size: 12px;
  font-family: var(--font-mono);
  font-weight: 800;
  text-anchor: middle;
  dominant-baseline: central;
}

/* Cursor badge */
.cursor-badge {
  position: absolute;
  pointer-events: none;
  transform: translate(14px, -50%);
  background: var(--accent);
  color: var(--on-accent);
  font-size: 11.5px;
  font-weight: 700;
  font-family: var(--font-mono);
  padding: 3px 8px;
  border-radius: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  white-space: nowrap;
}

/* Coord overlay */
.coord-overlay {
  position: absolute;
  bottom: 10px;
  left: 12px;
  z-index: 40;
  font-size: 11px;
  font-family: var(--font-mono);
  font-weight: 600;
  color: var(--ink-4);
  background: rgba(250, 249, 247, 0.72);
  padding: 2px 8px;
  border-radius: 6px;
  pointer-events: none;
}

/* Number tool cursor */
.canvas-area.tool-number .canvas-viewport { cursor: crosshair !important; }
</style>
