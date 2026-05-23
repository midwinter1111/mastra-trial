<script setup lang="ts">
type PaletteTriple = [string, string, string]

const props = defineProps<{
  label: string
  modelValue: PaletteTriple
  options: PaletteTriple[]
}>()
defineEmits<{ 'update:modelValue': [value: PaletteTriple] }>()

function isSelected(opt: PaletteTriple): boolean {
  return props.modelValue[0] === opt[0]
}
</script>

<template>
  <div class="twk-row">
    <div class="twk-lbl"><span>{{ label }}</span></div>
    <div class="twk-chips" role="radiogroup">
      <button
        v-for="(opt, i) in options"
        :key="i"
        type="button"
        class="twk-chip"
        role="radio"
        :aria-checked="isSelected(opt)"
        :data-on="isSelected(opt) ? '1' : '0'"
        :style="{ background: opt[0] }"
        :title="opt.join(' · ')"
        @click="$emit('update:modelValue', opt)"
      >
        <span>
          <i :style="{ background: opt[1] }" />
          <i :style="{ background: opt[2] }" />
        </span>
        <svg v-if="isSelected(opt)" viewBox="0 0 14 14" style="position:absolute;top:6px;left:6px;width:13px;height:13px;">
          <path d="M3 7.2 5.8 10 11 4.2" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" :stroke="isLight(opt[0]) ? 'rgba(0,0,0,.78)' : '#fff'" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script lang="ts">
function isLight(hex: string): boolean {
  const h = hex.replace('#', '')
  const x = h.length === 3 ? h.replace(/./g, (c) => c + c) : h.padEnd(6, '0')
  const n = parseInt(x.slice(0, 6), 16)
  if (Number.isNaN(n)) return true
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return r * 299 + g * 587 + b * 114 > 148000
}
</script>

<style scoped>
.twk-row { display: flex; flex-direction: column; gap: 5px; }
.twk-lbl { color: rgba(41, 38, 27, 0.72); }
.twk-lbl > span { font-weight: 500; }
.twk-chips { display: flex; gap: 6px; }
.twk-chip {
  position: relative;
  flex: 1;
  min-width: 0;
  height: 46px;
  border: 0;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  box-shadow: 0 0 0 0.5px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.06);
  transition: transform 0.12s, box-shadow 0.12s;
}
.twk-chip:hover { transform: translateY(-1px); box-shadow: 0 0 0 0.5px rgba(0, 0, 0, 0.18), 0 4px 10px rgba(0, 0, 0, 0.12); }
.twk-chip[data-on='1'] { box-shadow: 0 0 0 1.5px rgba(0, 0, 0, 0.85), 0 2px 6px rgba(0, 0, 0, 0.15); }
.twk-chip > span {
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  width: 34%;
  display: flex;
  flex-direction: column;
  box-shadow: -1px 0 0 rgba(0, 0, 0, 0.1);
}
.twk-chip > span > i { flex: 1; box-shadow: 0 -1px 0 rgba(0, 0, 0, 0.1); }
.twk-chip > span > i:first-child { box-shadow: none; }
</style>
