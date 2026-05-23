<script setup lang="ts">
import { ref, watch } from 'vue'
import { CATEGORIES, STATUSES } from '@/data/seed'
import { completeTenantInfo, isClaudeAvailable } from '@/services/claude'
import type { Tenant } from '@/types'
import Icon from '../icons/Icon.vue'

const props = defineProps<{ tenant: Tenant }>()
const emit = defineEmits<{
  close: []
  save: [draft: Tenant]
}>()

const draft = ref<Tenant>({ ...props.tenant })
watch(() => props.tenant, (t) => { draft.value = { ...t } }, { immediate: true })

function set<K extends keyof Tenant>(key: K, value: Tenant[K]) {
  draft.value = { ...draft.value, [key]: value }
}

const aiLoading = ref(false)
const aiError = ref('')

async function onAiSuggest() {
  if (!draft.value.name.trim()) return
  aiLoading.value = true
  aiError.value = ''
  try {
    const sug = await completeTenantInfo(draft.value.name)
    if (CATEGORIES.some((c) => c.id === sug.cat)) set('cat', sug.cat as Tenant['cat'])
    if (sug.size) set('size', sug.size)
    if (sug.memo) set('memo', sug.memo)
  } catch (e: unknown) {
    aiError.value = e instanceof Error ? e.message : 'AI提案に失敗しました'
  } finally {
    aiLoading.value = false
  }
}
</script>

<template>
  <div class="modal-backdrop" @click="emit('close')">
    <div class="modal lg" @click.stop>
      <div class="modal-hd">
        <div>
          <h2>テナント情報を編集</h2>
          <div class="sub">{{ tenant.id }}</div>
        </div>
        <button class="icon-btn" @click="emit('close')"><Icon name="close" /></button>
      </div>

      <div class="modal-body">
        <div class="edit-grid">
          <!-- Left column -->
          <div>
            <div class="sec-label">基本情報</div>
            <div class="field">
              <label>テナント名</label>
              <div style="display:flex;gap:6px">
                <input :value="draft.name" @input="set('name', ($event.target as HTMLInputElement).value)" style="flex:1" />
                <button
                  v-if="isClaudeAvailable()"
                  class="btn sm ghost"
                  :disabled="aiLoading"
                  title="AI でカテゴリ・メモを補完"
                  @click="onAiSuggest"
                >
                  <Icon name="ai_sparkle" />
                  <span>{{ aiLoading ? '提案中…' : 'AI 補完' }}</span>
                </button>
              </div>
              <div v-if="aiError" style="color:var(--status-closed);font-size:11.5px;margin-top:4px">{{ aiError }}</div>
            </div>

            <div class="field">
              <label>カテゴリ</label>
              <div class="cat-grid">
                <button
                  v-for="c in CATEGORIES"
                  :key="c.id"
                  type="button"
                  :class="['cat-pick', draft.cat === c.id && 'on']"
                  @click="set('cat', c.id)"
                >
                  <span class="dot" :style="{ background: c.color }" />
                  <span>{{ c.label }}</span>
                </button>
              </div>
            </div>

            <div class="field">
              <label>ステータス</label>
              <div class="seg">
                <button
                  v-for="s in STATUSES"
                  :key="s.id"
                  type="button"
                  :class="draft.status === s.id ? 'on' : ''"
                  @click="set('status', s.id)"
                >
                  {{ s.label }}
                </button>
              </div>
            </div>

            <div class="sec-label">出店者</div>
            <div class="field">
              <label>担当者氏名</label>
              <input :value="draft.contact" @input="set('contact', ($event.target as HTMLInputElement).value)" />
            </div>
            <div class="field">
              <label>連絡先電話番号</label>
              <input :value="draft.phone" class="mono" @input="set('phone', ($event.target as HTMLInputElement).value)" />
            </div>
          </div>

          <!-- Right column -->
          <div>
            <div class="sec-label">配置 & 設備</div>
            <div class="field-row">
              <div class="field">
                <label>位置 X</label>
                <input type="number" step="20" :value="draft.x" class="mono"
                  @input="set('x', Number(($event.target as HTMLInputElement).value))" />
              </div>
              <div class="field">
                <label>位置 Y</label>
                <input type="number" step="20" :value="draft.y" class="mono"
                  @input="set('y', Number(($event.target as HTMLInputElement).value))" />
              </div>
            </div>
            <div class="field-row">
              <div class="field">
                <label>幅</label>
                <input type="number" step="20" :value="draft.w" class="mono"
                  @input="set('w', Number(($event.target as HTMLInputElement).value))" />
              </div>
              <div class="field">
                <label>高さ</label>
                <input type="number" step="20" :value="draft.h" class="mono"
                  @input="set('h', Number(($event.target as HTMLInputElement).value))" />
              </div>
            </div>
            <div class="field">
              <label>実寸表示</label>
              <input :value="draft.size" class="mono" @input="set('size', ($event.target as HTMLInputElement).value)" />
            </div>
            <div class="field">
              <label style="display:flex;align-items:center;gap:8px;color:var(--ink-2);font-size:13px;font-weight:400;cursor:pointer">
                <input type="checkbox" :checked="!!draft.power" @change="set('power', ($event.target as HTMLInputElement).checked)" />
                電源あり（要 電源タップ）
              </label>
            </div>

            <div class="sec-label">呼び出し番号</div>
            <div class="field">
              <input
                type="number"
                :value="draft.num ?? ''"
                placeholder="未付与"
                class="mono"
                @input="set('num', ($event.target as HTMLInputElement).value === '' ? null : Number(($event.target as HTMLInputElement).value))"
              />
            </div>

            <div class="sec-label">メモ</div>
            <div class="field">
              <textarea
                :value="draft.memo"
                placeholder="運営上の注意事項、特記事項など"
                @input="set('memo', ($event.target as HTMLTextAreaElement).value)"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="modal-ft">
        <button class="btn sm ghost" @click="emit('close')">キャンセル</button>
        <button class="btn sm primary" @click="emit('save', draft)">
          <Icon name="check" /><span>変更を保存</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.edit-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.sec-label {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .08em;
  color: var(--ink-3);
  margin: 4px 0 10px;
}
</style>
