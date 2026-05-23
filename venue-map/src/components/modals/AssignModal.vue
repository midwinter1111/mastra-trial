<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { getCategoryById } from '@/data/seed'
import type { Tenant } from '@/types'
import Icon from '../icons/Icon.vue'

const props = defineProps<{
  targetIds: string[]
  tenants: Tenant[]
}>()

const emit = defineEmits<{
  close: []
  assign: [assignments: Record<string, number | null>]
  switchToDragMode: []
}>()

const currentIdx = ref(0)

const targets = computed(() =>
  props.targetIds.map((id) => props.tenants.find((t) => t.id === id)).filter((t): t is Tenant => Boolean(t))
)

const used = computed(() =>
  new Set(
    props.tenants
      .filter((t) => t.num != null && !props.targetIds.includes(t.id))
      .map((t) => t.num as number)
  )
)

const assignments = ref<Record<string, number | null>>({})

watch(targets, (tgts) => {
  const m: Record<string, number | null> = {}
  tgts.forEach((t) => { m[t.id] = t.num })
  assignments.value = m
}, { immediate: true })

function setAssign(id: string, num: number | null) {
  assignments.value = { ...assignments.value, [id]: num }
}

const current = computed(() => targets.value[currentIdx.value])
const cat = computed(() => current.value ? getCategoryById(current.value.cat) : null)

const PAD = Array.from({ length: 100 }, (_, i) => i)
</script>

<template>
  <div class="modal-backdrop" @click="emit('close')">
    <div class="modal" @click.stop>
      <div class="modal-hd">
        <div style="flex:1">
          <h2>呼び出し番号を付与</h2>
          <div class="sub">
            <template v-if="targets.length > 1">{{ currentIdx + 1 }} / {{ targets.length }}件目 — </template>
            {{ current?.name }}
          </div>
        </div>
        <button class="icon-btn" @click="emit('close')"><Icon name="close" /></button>
      </div>

      <div v-if="current" class="modal-body">
        <div class="guided-panel">
          <div class="big-num">
            {{ assignments[current.id] != null ? assignments[current.id] : '—' }}
          </div>
          <div class="info">
            <div class="ttl">{{ current.name }}</div>
            <div class="desc">
              <span style="display:inline-flex;align-items:center;gap:4px">
                <span :style="{ width: '7px', height: '7px', borderRadius: '2px', background: cat?.color, display: 'inline-block' }" />
                {{ cat?.label }}
              </span>
              <span style="margin:0 6px">·</span>
              <span class="mono">{{ current.id }}</span>
            </div>
          </div>
          <button class="btn sm ghost" title="連番なぞり付与モードに切り替え" @click="emit('switchToDragMode')">
            <Icon name="number" /><span>なぞり連番モード</span>
          </button>
        </div>

        <div class="pad-label">番号を選択（使用済みはグレー）</div>
        <div class="num-pad">
          <button
            v-for="n in PAD"
            :key="n"
            :class="[assignments[current.id] === n && 'current', used.has(n) && 'used']"
            :disabled="used.has(n)"
            :title="used.has(n) ? '使用済み' : ''"
            @click="!used.has(n) && setAssign(current.id, n)"
          >
            {{ n }}
          </button>
        </div>

        <div style="display:flex;align-items:center;gap:8px">
          <button class="btn sm ghost" @click="setAssign(current.id, null)">クリア</button>
          <div style="flex:1" />
          <span style="font-size:11px;color:var(--ink-3)">または直接入力</span>
          <input
            type="number"
            class="mono"
            style="width:84px;height:32px;border:1.5px solid var(--border);border-radius:8px;padding:0 10px;text-align:right;font-size:13px"
            :value="assignments[current.id] ?? ''"
            @input="setAssign(current.id, ($event.target as HTMLInputElement).value === '' ? null : Number(($event.target as HTMLInputElement).value))"
          />
        </div>
      </div>

      <div class="modal-ft">
        <template v-if="targets.length > 1">
          <button class="btn sm ghost left" :disabled="currentIdx === 0" @click="currentIdx = Math.max(0, currentIdx - 1)">
            <Icon name="chevron_left" /> 前へ
          </button>
          <button class="btn sm" :disabled="currentIdx === targets.length - 1" @click="currentIdx = Math.min(targets.length - 1, currentIdx + 1)">
            次へ <Icon name="chevron_right" />
          </button>
        </template>
        <button class="btn sm ghost" @click="emit('close')">キャンセル</button>
        <button class="btn sm primary" @click="emit('assign', assignments)">
          <Icon name="check" /><span>{{ targets.length > 1 ? '一括で適用' : '適用' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.guided-panel {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px;
  background: var(--bg-2);
  border-radius: 12px;
  margin-bottom: 16px;
}
.big-num {
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  border-radius: 14px;
  background: var(--accent);
  color: var(--on-accent);
  display: grid;
  place-items: center;
  font-family: var(--font-mono);
  font-size: 24px;
  font-weight: 800;
}
.info { flex: 1; min-width: 0; }
.info .ttl { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.info .desc { font-size: 12.5px; color: var(--ink-3); display: flex; align-items: center; }
.pad-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .08em;
  color: var(--ink-3);
  margin-bottom: 8px;
}
.num-pad {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 4px;
  margin-bottom: 12px;
}
.num-pad button {
  height: 32px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  color: var(--ink-1);
  cursor: pointer;
  transition: all 0.1s;
}
.num-pad button:hover:not(:disabled) { background: var(--accent-soft); border-color: var(--accent); }
.num-pad button.current { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
.num-pad button.used { background: var(--bg-2); color: var(--ink-4); cursor: not-allowed; text-decoration: line-through; }
</style>
