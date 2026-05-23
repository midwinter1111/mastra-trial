<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  name: string
  size?: number
}>()

const ICONS: Record<string, string> = {
  cursor:       `<path d="M3 2.5l9 4.5-4 1.5-1.5 4z" />`,
  add_box:      `<rect x="2.5" y="2.5" width="11" height="11" rx="1.5" /><path d="M8 5.5v5M5.5 8h5" />`,
  pan:          `<path d="M8 14V4M5 7l3-3 3 3M4 8l1 1M11 8l1 1M4 11l1 1M11 11l1 1" />`,
  number:       `<path d="M5.5 2v12M10.5 2v12M2 5.5h12M2 10.5h12" />`,
  ruler:        `<rect x="2" y="6" width="12" height="4" rx="0.5" transform="rotate(-15 8 8)" /><path d="M4.4 7.2l.5 1.3M6.4 6.7l.5 1.3M8.4 6.1l.5 1.3M10.4 5.6l.5 1.3" />`,
  search:       `<circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" />`,
  list:         `<path d="M5 4h9M5 8h9M5 12h9M2.5 4h.01M2.5 8h.01M2.5 12h.01" />`,
  layers:       `<path d="M8 2L2 5l6 3 6-3-6-3z" /><path d="M2 8l6 3 6-3M2 11l6 3 6-3" />`,
  trash:        `<path d="M3 4.5h10M6 4.5V3a1 1 0 011-1h2a1 1 0 011 1v1.5M4.5 4.5l.5 8a1 1 0 001 1h4a1 1 0 001-1l.5-8" />`,
  edit:         `<path d="M11.5 2.5l2 2-8 8H3v-2.5l8.5-7.5z" />`,
  copy:         `<rect x="4.5" y="4.5" width="9" height="9" rx="1" /><path d="M2.5 11.5V3a.5.5 0 01.5-.5h8.5" />`,
  close:        `<path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />`,
  check:        `<path d="M3 8l3.5 3.5L13 5" />`,
  chevron_down: `<path d="M4 6l4 4 4-4" />`,
  chevron_right:`<path d="M6 4l4 4-4 4" />`,
  chevron_left: `<path d="M10 4L6 8l4 4" />`,
  plus:         `<path d="M8 3v10M3 8h10" />`,
  minus:        `<path d="M3 8h10" />`,
  undo:         `<path d="M3 7l3-3M3 7l3 3M3 7h7a3 3 0 010 6h-1" />`,
  redo:         `<path d="M13 7l-3-3M13 7l-3 3M13 7H6a3 3 0 000 6h1" />`,
  settings:     `<circle cx="8" cy="8" r="2" /><path d="M8 1.5v2M8 12.5v2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M1.5 8h2M12.5 8h2M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4" />`,
  share:        `<circle cx="4" cy="8" r="1.5" /><circle cx="12" cy="4" r="1.5" /><circle cx="12" cy="12" r="1.5" /><path d="M5.5 7.3l5-2.7M5.5 8.7l5 2.7" />`,
  fit:          `<path d="M3 6V3h3M13 6V3h-3M3 10v3h3M13 10v3h-3" />`,
  grid:         `<rect x="2.5" y="2.5" width="4" height="4" /><rect x="9.5" y="2.5" width="4" height="4" /><rect x="2.5" y="9.5" width="4" height="4" /><rect x="9.5" y="9.5" width="4" height="4" />`,
  power:        `<path d="M8 2v6M5 4.5a4 4 0 106 0" />`,
  more:         `<circle cx="3.5" cy="8" r=".75" fill="currentColor" /><circle cx="8" cy="8" r=".75" fill="currentColor" /><circle cx="12.5" cy="8" r=".75" fill="currentColor" />`,
  drag:         `<circle cx="6" cy="4" r=".75" fill="currentColor" /><circle cx="10" cy="4" r=".75" fill="currentColor" /><circle cx="6" cy="8" r=".75" fill="currentColor" /><circle cx="10" cy="8" r=".75" fill="currentColor" /><circle cx="6" cy="12" r=".75" fill="currentColor" /><circle cx="10" cy="12" r=".75" fill="currentColor" />`,
  phone:        `<path d="M3 3l2 .5L6 6 5 7c.5 1.5 1.5 2.5 3 3l1-1 2.5 1 .5 2c-.5.5-1 .5-2 .5C6 12.5 3.5 10 3.5 5c0-1 0-1.5.5-2z" />`,
  user:         `<circle cx="8" cy="5.5" r="2.5" /><path d="M3 13.5c0-2.5 2.5-4 5-4s5 1.5 5 4" />`,
  bell:         `<path d="M8 2v1M4 7a4 4 0 018 0v3l1 1.5H3L4 10V7zM6.5 13a1.5 1.5 0 003 0" />`,
  bullhorn:     `<path d="M2 6v4l3 .5 1.5 3h1.5L7 10.5l5.5 1.5V4L7 5.5 2 6z" />`,
  alert:        `<path d="M8 2.5L14 13H2L8 2.5zM8 6.5v3M8 11.5v.01" />`,
  gear:         `<circle cx="8" cy="8" r="2.5" /><path d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14M3.5 3.5l1.1 1.1M11.4 11.4l1.1 1.1M3.5 12.5l1.1-1.1M11.4 4.6l1.1-1.1" />`,
  ai_sparkle:   `<path d="M8 2l1.2 3.4L13 7l-3.8 1.6L8 13l-1.2-4.4L3 7l3.8-1.6L8 2z" fill="currentColor" stroke="none" />`,
}

const paths = computed(() => ICONS[props.name] ?? '')
</script>

<template>
  <svg
    :width="props.size ?? 16"
    :height="props.size ?? 16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    v-html="paths"
  />
</template>
