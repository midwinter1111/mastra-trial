import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUIStore = defineStore('ui', () => {
  const search = ref('')
  const filterCat = ref('all')
  const filterStatus = ref('all')

  const detailId = ref<string | null>(null)
  const editId = ref<string | null>(null)
  const assignTargets = ref<string[] | null>(null)

  const tweaksPanelOpen = ref(false)

  function openDetail(id: string) { detailId.value = id }
  function closeDetail() { detailId.value = null }

  function openEdit(id: string) { editId.value = id }
  function closeEdit() { editId.value = null }

  function openAssign(ids: string[]) { assignTargets.value = ids }
  function closeAssign() { assignTargets.value = null }

  return {
    search, filterCat, filterStatus,
    detailId, editId, assignTargets,
    tweaksPanelOpen,
    openDetail, closeDetail,
    openEdit, closeEdit,
    openAssign, closeAssign,
  }
})
