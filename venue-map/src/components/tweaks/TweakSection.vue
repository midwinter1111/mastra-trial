<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<template>
  <div class="twk-sect">{{ label }}</div>
</template>

<style scoped>
.twk-sect {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(41, 38, 27, 0.45);
  padding: 10px 0 0;
}
.twk-sect:first-child { padding-top: 0; }
</style>
