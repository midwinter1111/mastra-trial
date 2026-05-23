import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ToolId, ModeId } from '@/types'

export const useToolsStore = defineStore('tools', () => {
  const mode = ref<ModeId>('edit')
  const tool = ref<ToolId>('select')

  function setMode(m: ModeId) {
    mode.value = m
    if (m === 'edit' && tool.value === 'number') tool.value = 'select'
    if (m === 'operate' && tool.value === 'add') tool.value = 'select'
  }

  function setTool(t: ToolId) {
    tool.value = t
  }

  return { mode, tool, setMode, setTool }
})
