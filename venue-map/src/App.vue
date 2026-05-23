<script setup lang="ts">
import { computed, watch, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useTenantsStore } from '@/stores/tenants'
import { useToolsStore } from '@/stores/tools'
import { useTweaksStore } from '@/stores/tweaks'
import { useUIStore } from '@/stores/ui'
import Topbar from '@/components/Topbar.vue'
import ToolRail from '@/components/ToolRail.vue'
import Sidebar from '@/components/Sidebar.vue'
import MapCanvas from '@/components/MapCanvas.vue'
import Inspector from '@/components/Inspector.vue'
import StatusBar from '@/components/StatusBar.vue'
import TweaksPanel from '@/components/tweaks/TweaksPanel.vue'
import DetailModal from '@/components/modals/DetailModal.vue'
import EditModal from '@/components/modals/EditModal.vue'
import AssignModal from '@/components/modals/AssignModal.vue'

const tenantsStore = useTenantsStore()
const toolsStore = useToolsStore()
const tweaksStore = useTweaksStore()
const uiStore = useUIStore()

const { tenants, selectedIds } = storeToRefs(tenantsStore)
const { mode, tool } = storeToRefs(toolsStore)
const { palette, dark, sidePos, showInspector } = storeToRefs(tweaksStore)
const { detailId, editId, assignTargets, tweaksPanelOpen } = storeToRefs(uiStore)

// Apply accent palette to CSS variables
watch(palette, ([accent, strong, soft]) => {
  document.documentElement.style.setProperty('--accent', accent)
  document.documentElement.style.setProperty('--accent-strong', strong)
  document.documentElement.style.setProperty('--accent-soft', soft)
}, { immediate: true })

// Apply dark mode and side position to root element
watch(dark, (v) => {
  document.documentElement.classList.toggle('theme-dark', v)
}, { immediate: true })

// App class composition
const appClass = computed(() => [
  'app',
  !showInspector.value && 'no-insp',
  sidePos.value === 'right' && 'side-right',
])

// Tenant detail/edit
const detailTenant = computed(() => detailId.value ? tenants.value.find((t) => t.id === detailId.value) ?? null : null)
const editTenant = computed(() => editId.value ? tenants.value.find((t) => t.id === editId.value) ?? null : null)

function onDetailEdit() {
  if (detailId.value) {
    uiStore.openEdit(detailId.value)
    uiStore.closeDetail()
  }
}

function onDetailAssign(ids: string[]) {
  uiStore.openAssign(ids)
  uiStore.closeDetail()
}

function onDetailDelete(ids: string[]) {
  if (!confirm(`${ids.length}件のテナントを削除しますか？`)) return
  tenantsStore.deleteTenants(ids)
  uiStore.closeDetail()
}

function onEditSave(draft: import('@/types').Tenant) {
  tenantsStore.updateTenants((prev) => prev.map((t) => t.id === draft.id ? draft : t))
  uiStore.closeEdit()
}

function onAssignApply(assignments: Record<string, number | null>) {
  tenantsStore.updateTenants((prev) =>
    prev.map((t) =>
      assignments[t.id] === undefined ? t : { ...t, num: assignments[t.id] }
    )
  )
  uiStore.closeAssign()
}

function onSwitchToDragMode() {
  uiStore.closeAssign()
  toolsStore.setMode('operate')
  toolsStore.setTool('number')
}

// Keyboard shortcuts
function onKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement
  const inForm = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
  if (inForm) return

  const m = e.metaKey || e.ctrlKey
  if (m && e.key.toLowerCase() === 'z') {
    e.preventDefault()
    if (e.shiftKey) tenantsStore.redo()
    else tenantsStore.undo()
    return
  }
  if (!m) {
    if (e.key === 'v') toolsStore.setTool('select')
    else if (e.key === 't' && mode.value === 'edit') toolsStore.setTool('add')
    else if (e.key === 'n' && mode.value === 'operate') toolsStore.setTool('number')
    else if (e.key === 'h') toolsStore.setTool('pan')
    else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.value.size > 0) {
      e.preventDefault()
      const ids = [...selectedIds.value]
      if (!confirm(`${ids.length}件のテナントを削除しますか？`)) return
      tenantsStore.deleteTenants(ids)
    } else if (e.key === 'Escape') {
      if (tool.value === 'number') toolsStore.setTool('select')
      else {
        tenantsStore.selectedIds = new Set()
        uiStore.closeDetail()
        uiStore.closeEdit()
        uiStore.closeAssign()
      }
    } else if (e.key === 'Enter' && selectedIds.value.size === 1) {
      uiStore.openDetail([...selectedIds.value][0])
    }
  }
}

onMounted(() => globalThis.addEventListener('keydown', onKeydown))
onUnmounted(() => globalThis.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div :class="appClass">
    <Topbar />
    <ToolRail />
    <Sidebar />
    <MapCanvas />
    <Inspector v-if="showInspector" />
    <StatusBar />

    <!-- Tweaks panel -->
    <TweaksPanel :open="tweaksPanelOpen" @update:open="tweaksPanelOpen = $event" />

    <!-- Modals -->
    <DetailModal
      v-if="detailTenant"
      :tenant="detailTenant"
      @close="uiStore.closeDetail()"
      @edit="onDetailEdit"
      @assign="onDetailAssign"
      @delete="onDetailDelete"
    />

    <EditModal
      v-if="editTenant"
      :tenant="editTenant"
      @close="uiStore.closeEdit()"
      @save="(draft) => {
        tenantsStore.updateTenants((prev) => prev.map((t) => t.id === draft.id ? draft : t))
        uiStore.closeEdit()
      }"
    />

    <AssignModal
      v-if="assignTargets && assignTargets.length > 0"
      :target-ids="assignTargets"
      :tenants="tenants"
      @close="uiStore.closeAssign()"
      @assign="onAssignApply"
      @switch-to-drag-mode="onSwitchToDragMode"
    />
  </div>
</template>

<style>
/* Global layout — .app grid is defined in base.css */
</style>
