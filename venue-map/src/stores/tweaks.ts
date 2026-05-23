import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { TileStyle, GridStyle, SidePos } from '@/types'
import { loadState } from '@/services/storage'

const STORAGE_KEY = 'venuemap:tweaks:v1'

type PaletteTriple = [string, string, string]

interface TweaksState {
  palette: PaletteTriple
  tileStyle: TileStyle
  gridStyle: GridStyle
  sidePos: SidePos
  showGrid: boolean
  showCoords: boolean
  showMinimap: boolean
  showInspector: boolean
  dark: boolean
}

const DEFAULTS: TweaksState = {
  palette: ['#e07550', '#c45c3a', '#fbe4d8'],
  tileStyle: 'pin',
  gridStyle: 'lines',
  sidePos: 'left',
  showGrid: true,
  showCoords: true,
  showMinimap: true,
  showInspector: true,
  dark: false,
}

export const useTweaksStore = defineStore('tweaks', () => {
  const saved = loadState<TweaksState>(STORAGE_KEY)
  const init = saved ? { ...DEFAULTS, ...saved } : DEFAULTS

  const palette = ref<PaletteTriple>(init.palette)
  const tileStyle = ref<TileStyle>(init.tileStyle)
  const gridStyle = ref<GridStyle>(init.gridStyle)
  const sidePos = ref<SidePos>(init.sidePos)
  const showGrid = ref(init.showGrid)
  const showCoords = ref(init.showCoords)
  const showMinimap = ref(init.showMinimap)
  const showInspector = ref(init.showInspector)
  const dark = ref(init.dark)

  function persist() {
    const state: TweaksState = {
      palette: palette.value,
      tileStyle: tileStyle.value,
      gridStyle: gridStyle.value,
      sidePos: sidePos.value,
      showGrid: showGrid.value,
      showCoords: showCoords.value,
      showMinimap: showMinimap.value,
      showInspector: showInspector.value,
      dark: dark.value,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }

  watch(
    [palette, tileStyle, gridStyle, sidePos, showGrid, showCoords, showMinimap, showInspector, dark],
    persist,
    { deep: true },
  )

  return {
    palette, tileStyle, gridStyle, sidePos,
    showGrid, showCoords, showMinimap, showInspector, dark,
  }
})
