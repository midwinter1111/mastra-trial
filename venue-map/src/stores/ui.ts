import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUIStore = defineStore('ui', () => {
  const search = ref('')
  const filterCat = ref('all')
  const filterStatus = ref('all')

  const detailId = ref<string | null>(null)
  const editId = ref<string | null>(null)
  const assignTargets = ref<string[] | null>(null)

  const saving = ref(false)
  const lastSaved = ref('')

  const tweaksPanelOpen = ref(false)

  function openDetail(id: string) { detailId.value = id }
  function closeDetail() { detailId.value = null }

  function openEdit(id: string) { editId.value = id }
  function closeEdit() { editId.value = null }

  function openAssign(ids: string[]) { assignTargets.value = ids }
  function closeAssign() { assignTargets.value = null }

  let saveTimer: ReturnType<typeof setTimeout> | null = null
  function flashSave() {
    saving.value = true
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saving.value = false
      const d = new Date()
      lastSaved.value = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
    }, 400)
  }

  return {
    search, filterCat, filterStatus,
    detailId, editId, assignTargets,
    saving, lastSaved,
    tweaksPanelOpen,
    openDetail, closeDetail,
    openEdit, closeEdit,
    openAssign, closeAssign,
    flashSave,
  }
})
