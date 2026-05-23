<script setup lang="ts">
interface Option { value: string; label: string }

const props = defineProps<{
  label: string
  modelValue: string
  options: Option[]
}>()
defineEmits<{ 'update:modelValue': [value: string] }>()

function idx(): number {
  return Math.max(0, props.options.findIndex((o) => o.value === props.modelValue))
}
</script>

<template>
  <div class="twk-row">
    <div class="twk-lbl"><span>{{ label }}</span></div>
    <div class="twk-seg" role="radiogroup">
      <div
        class="twk-seg-thumb"
        :style="{
          left: `calc(2px + ${idx()} * (100% - 4px) / ${options.length})`,
          width: `calc((100% - 4px) / ${options.length})`,
        }"
      />
      <button
        v-for="opt in options"
        :key="opt.value"
        type="button"
        role="radio"
        :aria-checked="opt.value === modelValue"
        @click="$emit('update:modelValue', opt.value)"
      >
        {{ opt.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.twk-row { display: flex; flex-direction: column; gap: 5px; }
.twk-lbl { color: rgba(41, 38, 27, 0.72); }
.twk-lbl > span { font-weight: 500; }
.twk-seg {
  position: relative;
  display: flex;
  padding: 2px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.06);
  user-select: none;
}
.twk-seg-thumb {
  position: absolute;
  top: 2px;
  bottom: 2px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
  transition: left 0.15s cubic-bezier(0.3, 0.7, 0.4, 1), width 0.15s;
}
.twk-seg button {
  position: relative;
  z-index: 1;
  flex: 1;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 11.5px;
  font-weight: 500;
  min-height: 22px;
  border-radius: 6px;
  cursor: pointer;
  padding: 4px 6px;
  line-height: 1.2;
}
</style>
