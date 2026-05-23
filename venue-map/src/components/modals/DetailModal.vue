<script setup lang="ts">
import { computed } from 'vue'
import { getCategoryById, STATUSES } from '@/data/seed'
import type { Tenant } from '@/types'
import Icon from '../icons/Icon.vue'

const props = defineProps<{ tenant: Tenant }>()
const emit = defineEmits<{
  close: []
  edit: []
  assign: [ids: string[]]
  delete: [ids: string[]]
}>()

const cat = computed(() => getCategoryById(props.tenant.cat))
const statusLabel = computed(() => STATUSES.find((s) => s.id === props.tenant.status)?.label ?? '')
</script>

<template>
  <div class="modal-backdrop" @click="emit('close')">
    <div class="modal" @click.stop>
      <div class="modal-hd">
        <div style="flex:1;min-width:0">
          <div style="font-size:11px;color:var(--ink-3);margin-bottom:4px;letter-spacing:.08em;text-transform:uppercase;font-weight:700">
            テナント詳細
          </div>
          <div class="detail-hero">
            <div
              :class="['detail-num', tenant.num == null && 'unassigned']"
              :style="tenant.num != null ? { background: cat.color } : undefined"
            >
              {{ tenant.num != null ? tenant.num : '未付与' }}
            </div>
            <div class="detail-name">
              <h2>{{ tenant.name }}</h2>
              <div class="crumb">
                <span style="display:inline-flex;align-items:center;gap:5px">
                  <span :style="{ width: '8px', height: '8px', borderRadius: '3px', background: cat.color, display: 'inline-block' }" />
                  {{ cat.label }}
                </span>
                <span style="color:var(--ink-4);margin:0 4px">·</span>
                <span class="mono" style="color:var(--ink-3)">{{ tenant.id }}</span>
                <span style="color:var(--ink-4);margin:0 4px">·</span>
                <span :class="['status-pill', tenant.status]"><span class="dot" />{{ statusLabel }}</span>
              </div>
            </div>
          </div>
        </div>
        <button class="icon-btn" @click="emit('close')"><Icon name="close" /></button>
      </div>

      <div class="modal-body">
        <div class="detail-stats">
          <div class="detail-stat">
            <div class="label">位置</div>
            <div class="val">{{ tenant.x }}/{{ tenant.y }}</div>
          </div>
          <div class="detail-stat">
            <div class="label">サイズ</div>
            <div class="val">{{ tenant.w }}×{{ tenant.h }}</div>
          </div>
          <div class="detail-stat">
            <div class="label">電源</div>
            <div class="val" :style="{ color: tenant.power ? 'var(--status-open)' : 'var(--ink-3)' }">
              {{ tenant.power ? 'あり' : 'なし' }}
            </div>
          </div>
        </div>

        <div class="detail-section">
          <h4>出店者情報</h4>
          <dl class="kv-grid">
            <dt>担当者</dt><dd>{{ tenant.contact || '—' }}</dd>
            <dt>連絡先</dt><dd class="mono">{{ tenant.phone || '—' }}</dd>
            <dt>実寸</dt><dd class="mono">{{ tenant.size }}</dd>
          </dl>
        </div>

        <div v-if="tenant.memo" class="detail-section">
          <h4>運営メモ</h4>
          <div class="memo-box">{{ tenant.memo }}</div>
        </div>

        <div class="detail-section">
          <h4>タイムライン</h4>
          <div style="display:flex;flex-direction:column;gap:8px">
            <div class="timeline-row"><span class="mono t">09:42</span><span class="who">運営</span><span>配置を更新（移動）</span></div>
            <div class="timeline-row"><span class="mono t">08:15</span><span class="who">運営</span><span>呼び出し番号を付与 (#{{ tenant.num ?? '—' }})</span></div>
            <div class="timeline-row"><span class="mono t">昨日 17:30</span><span class="who">システム</span><span>テナントを登録</span></div>
          </div>
        </div>
      </div>

      <div class="modal-ft">
        <button class="btn sm danger left" @click="emit('delete', [tenant.id])">
          <Icon name="trash" /><span>削除</span>
        </button>
        <button class="btn sm" @click="emit('assign', [tenant.id])">
          <Icon name="number" /><span>番号を付与</span>
        </button>
        <button class="btn sm primary" @click="emit('edit')">
          <Icon name="edit" /><span>編集</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.detail-hero { display: flex; align-items: flex-start; gap: 14px; margin-top: 8px; }
.detail-num {
  width: 52px; height: 52px; flex-shrink: 0;
  border-radius: 14px;
  display: grid; place-items: center;
  font-family: var(--font-mono); font-weight: 800; font-size: 22px; color: #fff;
}
.detail-num.unassigned { background: var(--bg-2); color: var(--ink-3); border: 1.5px dashed var(--border); font-size: 11px; }
.detail-name h2 { margin: 0 0 4px; font-size: 18px; font-weight: 700; }
.crumb { display: flex; align-items: center; flex-wrap: wrap; font-size: 12.5px; }
.detail-stats { display: flex; gap: 12px; padding: 14px; border-bottom: 1px solid var(--border); }
.detail-stat { flex: 1; }
.detail-stat .label { font-size: 10.5px; color: var(--ink-3); text-transform: uppercase; letter-spacing: .06em; font-weight: 700; margin-bottom: 3px; }
.detail-stat .val { font-family: var(--font-mono); font-weight: 700; font-size: 14px; }
.detail-section { padding: 14px; border-bottom: 1px solid var(--border); }
.detail-section:last-child { border-bottom: 0; }
.detail-section h4 { margin: 0 0 10px; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--ink-3); }
.kv-grid { display: grid; grid-template-columns: 80px 1fr; gap: 6px 12px; margin: 0; font-size: 13px; }
.kv-grid dt { color: var(--ink-3); }
.kv-grid dd { margin: 0; color: var(--ink-1); }
.memo-box { padding: 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 10px; font-size: 13px; color: var(--ink-2); line-height: 1.6; }
.timeline-row { display: grid; grid-template-columns: 90px 60px 1fr; align-items: baseline; font-size: 12.5px; gap: 8px; }
.timeline-row .t { color: var(--ink-4); }
.timeline-row .who { color: var(--ink-3); font-size: 11px; }
</style>
