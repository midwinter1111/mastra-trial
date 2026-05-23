<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useTweaksStore } from '@/stores/tweaks'
import { useTenantsStore } from '@/stores/tenants'
import TweakSection from './TweakSection.vue'
import TweakToggle from './TweakToggle.vue'
import TweakColor from './TweakColor.vue'
import TweakRadio from './TweakRadio.vue'

const props = defineProps<{ open: boolean }>()
defineEmits<{ 'update:open': [val: boolean] }>()

const tweaks = useTweaksStore()
const tenantsStore = useTenantsStore()
const { palette, tileStyle, gridStyle, sidePos, showGrid, showCoords, showMinimap, showInspector, dark } =
  storeToRefs(tweaks)

const panelRef = ref<HTMLElement | null>(null)
const posRight = ref(16)
const posBottom = ref(16)

const PALETTE_OPTIONS: [string, string, string][] = [
  ['#e07550', '#c45c3a', '#fbe4d8'], // Terracotta
  ['#7da380', '#5d8362', '#e2ede3'], // Sage
  ['#d49241', '#b07423', '#faebd0'], // Mustard
  ['#b85a8a', '#964068', '#f3dfe9'], // Berry
  ['#4d8db8', '#356f9a', '#dde9f1'], // Sky
  ['#5b6478', '#3e4659', '#e2e5ec'], // Slate
]

function onDragStart(e: MouseEvent) {
  if (!panelRef.value) return
  const rect = panelRef.value.getBoundingClientRect()
  const startRight = window.innerWidth - rect.right
  const startBottom = window.innerHeight - rect.bottom
  const sx = e.clientX
  const sy = e.clientY

  function move(ev: MouseEvent) {
    posRight.value = Math.max(8, startRight - (ev.clientX - sx))
    posBottom.value = Math.max(8, startBottom - (ev.clientY - sy))
  }
  function up() {
    window.removeEventListener('mousemove', move)
    window.removeEventListener('mouseup', up)
  }
  window.addEventListener('mousemove', move)
  window.addEventListener('mouseup', up)
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      ref="panelRef"
      class="twk-panel"
      :style="{ right: posRight + 'px', bottom: posBottom + 'px' }"
    >
      <div class="twk-hd" @mousedown="onDragStart">
        <b>表示設定</b>
        <button class="twk-x" @mousedown.stop @click="$emit('update:open', false)">✕</button>
      </div>
      <div class="twk-body">
        <TweakSection label="表示テーマ" />
        <TweakColor label="アクセントカラー" v-model="palette" :options="PALETTE_OPTIONS" />
        <TweakToggle label="ダークモード" v-model="dark" />

        <TweakSection label="マップ表現" />
        <TweakRadio
          label="グリッド"
          v-model="gridStyle"
          :options="[{ value: 'lines', label: '方眼' }, { value: 'dots', label: 'ドット' }, { value: 'none', label: 'なし' }]"
        />
        <TweakRadio
          label="テナント表示"
          v-model="tileStyle"
          :options="[{ value: 'card', label: 'カード' }, { value: 'badge', label: 'バッジ' }, { value: 'pin', label: 'ピン' }]"
        />
        <TweakToggle label="座標オーバーレイ" v-model="showCoords" />
        <TweakToggle label="ミニマップ" v-model="showMinimap" />

        <TweakSection label="レイアウト" />
        <TweakRadio
          label="サイドバー位置"
          v-model="sidePos"
          :options="[{ value: 'left', label: '左' }, { value: 'right', label: '右' }]"
        />
        <TweakToggle label="プロパティパネル" v-model="showInspector" />

        <TweakSection label="データ" />
        <button class="btn sm ghost" style="width:100%" @click="tenantsStore.resetToSeed()">
          シードに戻す
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.twk-panel {
  position: fixed;
  z-index: 2000;
  width: 280px;
  max-height: calc(100vh - 32px);
  display: flex;
  flex-direction: column;
  background: rgba(250, 249, 247, 0.85);
  color: #29261b;
  backdrop-filter: blur(24px) saturate(160%);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  border: 0.5px solid rgba(255, 255, 255, 0.6);
  border-radius: 14px;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.5) inset, 0 12px 40px rgba(0, 0, 0, 0.18);
  font-size: 11.5px;
  overflow: hidden;
}
.twk-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 8px 10px 14px;
  cursor: move;
  user-select: none;
}
.twk-hd b { font-size: 12px; font-weight: 600; }
.twk-x {
  appearance: none;
  border: 0;
  background: transparent;
  color: rgba(41, 38, 27, 0.55);
  width: 22px;
  height: 22px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
}
.twk-x:hover { background: rgba(0, 0, 0, 0.06); color: #29261b; }
.twk-body {
  padding: 2px 14px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
}
</style>
