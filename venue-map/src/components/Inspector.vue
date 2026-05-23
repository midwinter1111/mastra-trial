<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useTenantsStore } from '@/stores/tenants'
import { useToolsStore } from '@/stores/tools'
import { useUIStore } from '@/stores/ui'
import { CATEGORIES, getCategoryById, STATUSES } from '@/data/seed'
import Icon from './icons/Icon.vue'
import type { Tenant } from '@/types'

const tenantsStore = useTenantsStore()
const toolsStore = useToolsStore()
const uiStore = useUIStore()
const { tenants, selectedIds } = storeToRefs(tenantsStore)
const { mode } = storeToRefs(toolsStore)

const selected = computed(() => tenants.value.filter((t) => selectedIds.value.has(t.id)))

function update(id: string, patch: Partial<Tenant>) {
  tenantsStore.updateTenant(id, patch)
}

function bulkUpdate(patch: Partial<Tenant>) {
  tenantsStore.updateTenants((prev) => prev.map((t) =>
    selectedIds.value.has(t.id) ? { ...t, ...patch } : t
  ))
}

function onDelete(ids: string[]) {
  if (!confirm(`${ids.length}件のテナントを削除しますか？`)) return
  tenantsStore.deleteTenants(ids)
}

const byCat = computed(() => {
  const m: Record<string, number> = {}
  selected.value.forEach((t) => { m[t.cat] = (m[t.cat] || 0) + 1 })
  return m
})
</script>

<template>
  <!-- Empty state -->
  <aside v-if="selected.length === 0" class="insp">
    <div class="empty-insp">
      <div class="icon"><Icon name="cursor" /></div>
      <div class="title">テナント未選択</div>
      <div class="hint">
        マップやサイドバーから選ぶと、ここに詳細が出ます。<br />
        <span style="display:inline-block;margin-top:8px">
          <span class="kbd">⇧</span> または範囲ドラッグで複数選択
        </span>
      </div>
    </div>
  </aside>

  <!-- Bulk state -->
  <aside v-else-if="selected.length > 1" class="insp">
    <div class="insp-hd">
      <div>
        <div class="insp-title">複数選択</div>
        <h3>{{ selected.length }} 件のテナント</h3>
      </div>
    </div>
    <div class="insp-body">
      <div class="insp-section">
        <h4>内訳</h4>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          <span
            v-for="(n, cid) in byCat"
            :key="cid"
            class="tag"
            :style="{ background: getCategoryById(cid).soft, color: getCategoryById(cid).color }"
          >
            <span :style="{ width: '7px', height: '7px', borderRadius: '2px', background: getCategoryById(cid).color, display: 'inline-block' }" />
            {{ getCategoryById(cid).label }} × {{ n }}
          </span>
        </div>
      </div>

      <div class="insp-section">
        <h4>一括操作</h4>
        <div style="display:flex;flex-direction:column;gap:8px">
          <button class="btn sm primary" @click="uiStore.openAssign([...selectedIds])">
            <Icon name="number" />
            <span>順番に番号を付与</span>
          </button>
          <div class="seg">
            <button
              v-for="s in STATUSES"
              :key="s.id"
              @click="bulkUpdate({ status: s.id })"
            >
              {{ s.label }}
            </button>
          </div>
          <button class="btn sm danger" @click="onDelete([...selectedIds])">
            <Icon name="trash" />
            <span>選択中を削除</span>
          </button>
        </div>
      </div>

      <div class="insp-section">
        <h4>整列</h4>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
          <button class="btn sm ghost">左揃え</button>
          <button class="btn sm ghost">右揃え</button>
          <button class="btn sm ghost">上揃え</button>
          <button class="btn sm ghost">下揃え</button>
          <button class="btn sm ghost">横分布</button>
          <button class="btn sm ghost">縦分布</button>
        </div>
      </div>
    </div>
  </aside>

  <!-- Single state -->
  <aside v-else class="insp">
    <div class="insp-hd">
      <div style="flex:1;min-width:0">
        <div class="insp-title">テナント</div>
        <h3>{{ selected[0].name }}</h3>
      </div>
      <button class="icon-btn" title="詳細表示" @click="uiStore.openDetail(selected[0].id)">
        <Icon name="more" />
      </button>
    </div>

    <div class="insp-body">
      <div class="insp-section">
        <h4>呼び出し番号</h4>
        <div style="display:flex;align-items:center;gap:12px">
          <div
            :class="['detail-num', selected[0].num == null && 'unassigned']"
            :style="selected[0].num != null
              ? { background: getCategoryById(selected[0].cat).color, width: '56px', height: '56px', fontSize: '22px', borderRadius: '14px' }
              : { width: '56px', height: '56px', fontSize: '11px', borderRadius: '14px' }"
          >
            {{ selected[0].num != null ? selected[0].num : '未付与' }}
          </div>
          <div style="flex:1;display:flex;flex-direction:column;gap:4px">
            <button class="btn sm" @click="uiStore.openAssign([selected[0].id])">
              <Icon name="number" />
              <span>{{ selected[0].num != null ? '番号を変更' : '番号を付与' }}</span>
            </button>
            <button
              v-if="selected[0].num != null"
              class="btn sm ghost"
              @click="update(selected[0].id, { num: null })"
            >
              クリア
            </button>
          </div>
        </div>
      </div>

      <div class="insp-section">
        <h4>基本情報</h4>
        <div class="field">
          <label>名称</label>
          <input :value="selected[0].name" @change="(e) => update(selected[0].id, { name: (e.target as HTMLInputElement).value })" />
        </div>
        <div class="field">
          <label>カテゴリ</label>
          <div class="cat-grid">
            <button
              v-for="cat in CATEGORIES"
              :key="cat.id"
              :class="['cat-pick', selected[0].cat === cat.id && 'on']"
              @click="update(selected[0].id, { cat: cat.id })"
            >
              <span class="dot" :style="{ background: cat.color }" />
              <span>{{ cat.label }}</span>
            </button>
          </div>
        </div>
        <div class="field">
          <label>ステータス</label>
          <div class="seg">
            <button
              v-for="s in STATUSES"
              :key="s.id"
              :class="selected[0].status === s.id ? 'on' : ''"
              @click="update(selected[0].id, { status: s.id })"
            >
              {{ s.label }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="mode === 'edit'" class="insp-section">
        <h4>配置 & サイズ</h4>
        <div class="field-row">
          <div class="field">
            <label>X</label>
            <input type="number" step="20" :value="selected[0].x" class="mono"
              @change="(e) => update(selected[0].id, { x: Number((e.target as HTMLInputElement).value) })" />
          </div>
          <div class="field">
            <label>Y</label>
            <input type="number" step="20" :value="selected[0].y" class="mono"
              @change="(e) => update(selected[0].id, { y: Number((e.target as HTMLInputElement).value) })" />
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>幅</label>
            <input type="number" step="20" :value="selected[0].w" class="mono"
              @change="(e) => update(selected[0].id, { w: Number((e.target as HTMLInputElement).value) })" />
          </div>
          <div class="field">
            <label>高さ</label>
            <input type="number" step="20" :value="selected[0].h" class="mono"
              @change="(e) => update(selected[0].id, { h: Number((e.target as HTMLInputElement).value) })" />
          </div>
        </div>
      </div>

      <div class="insp-section">
        <h4>出店者</h4>
        <div class="field">
          <label>担当者</label>
          <input :value="selected[0].contact"
            @change="(e) => update(selected[0].id, { contact: (e.target as HTMLInputElement).value })" />
        </div>
        <div class="field">
          <label>連絡先</label>
          <input :value="selected[0].phone" class="mono"
            @change="(e) => update(selected[0].id, { phone: (e.target as HTMLInputElement).value })" />
        </div>
      </div>

      <div class="insp-section">
        <h4>メモ</h4>
        <div class="field">
          <textarea
            :value="selected[0].memo"
            placeholder="運営メモ・注意事項を入力"
            @change="(e) => update(selected[0].id, { memo: (e.target as HTMLTextAreaElement).value })"
          />
        </div>
      </div>

      <div class="insp-section">
        <div style="display:flex;gap:6px">
          <button class="btn sm ghost" style="flex:1" @click="uiStore.openDetail(selected[0].id)">
            <Icon name="edit" />
            <span>詳細を編集</span>
          </button>
          <button class="btn sm danger" @click="onDelete([selected[0].id])">
            <Icon name="trash" />
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.insp {
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-left: 1px solid var(--border);
  overflow: hidden;
  z-index: 10;
}
.insp-hd {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 14px 14px 12px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.insp-title { font-size: 10.5px; color: var(--ink-3); text-transform: uppercase; letter-spacing: .08em; font-weight: 700; margin-bottom: 2px; }
.insp-hd h3 { margin: 0; font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.insp-body { flex: 1; overflow-y: auto; padding: 4px 0 12px; }
.insp-section { padding: 12px 14px; border-bottom: 1px solid var(--border); }
.insp-section:last-child { border-bottom: 0; }
.insp-section h4 { margin: 0 0 10px; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--ink-3); }
.detail-num {
  display: grid;
  place-items: center;
  font-family: var(--font-mono);
  font-weight: 800;
  color: #fff;
  border-radius: 14px;
  flex-shrink: 0;
}
.detail-num.unassigned {
  background: var(--bg-2);
  color: var(--ink-3);
  border: 1.5px dashed var(--border);
}
.empty-insp {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 10px;
  padding: 40px 24px;
  text-align: center;
}
.empty-insp .icon { width: 40px; height: 40px; color: var(--ink-4); }
.empty-insp .icon svg { width: 100%; height: 100%; }
.empty-insp .title { font-size: 13px; font-weight: 600; color: var(--ink-2); }
.empty-insp .hint { font-size: 12px; color: var(--ink-3); line-height: 1.6; }
</style>
