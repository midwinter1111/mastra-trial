<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAIStore, type LLMProvider } from '@/stores/ai'
import { useTenantsStore } from '@/stores/tenants'
import Icon from './icons/Icon.vue'

const aiStore = useAIStore()
const tenantsStore = useTenantsStore()

const { messages, loading, provider, panelOpen } = storeToRefs(aiStore)
const input = ref('')
const messagesEl = ref<HTMLElement | null>(null)

const PROVIDERS: { key: LLMProvider; label: string; color: string }[] = [
  { key: 'claude', label: 'Claude', color: '#d97559' },
  { key: 'openai', label: 'ChatGPT', color: '#10a37f' },
  { key: 'gemini', label: 'Gemini', color: '#4285f4' },
]

type AnyPatch = Record<string, number | string | boolean | null>

function applyPositionUpdates(updates: Array<{ id: string } & AnyPatch>) {
  const map: Record<string, AnyPatch> = {}
  for (const u of updates) {
    const { id, ...patch } = u
    map[id] = patch
  }
  tenantsStore.updateTenants((prev) => prev.map((t) => (map[t.id] ? { ...t, ...map[t.id] } : t)))
}

function applyToolResult(toolName: string, r: Record<string, unknown>) {
  if (toolName === 'swap_tenant_positions') {
    applyPositionUpdates((r.updates ?? []) as Array<{ id: string } & AnyPatch>)
  } else if (toolName === 'batch_rearrange' && r.updates) {
    applyPositionUpdates(r.updates as Array<{ id: string } & AnyPatch>)
  } else if (toolName === 'move_tenant' && r.update) {
    applyPositionUpdates([r.update as { id: string } & AnyPatch])
  } else if (toolName === 'add_tenant' && r.tenant) {
    tenantsStore.addTenant(r.tenant as Parameters<typeof tenantsStore.addTenant>[0])
  } else if (toolName === 'delete_tenant' && r.id) {
    tenantsStore.deleteTenants([r.id as string])
  } else if (toolName === 'set_tenant_number' && r.update) {
    const { id, num } = r.update as { id: string; num: number }
    tenantsStore.updateTenant(id, { num })
  } else if (toolName === 'clear_tenant_number' && r.update) {
    tenantsStore.updateTenant((r.update as { id: string }).id, { num: null })
  } else if (toolName === 'bulk_set_numbers') {
    tenantsStore.pushHistory()
    for (const u of (r.updates ?? []) as Array<{ id: string; num: number | null }>) {
      tenantsStore.updateTenant(u.id, { num: u.num }, false)
    }
  } else if (toolName === 'auto_assign_numbers') {
    tenantsStore.assignNumbers((r.assignments ?? []) as Array<{ id: string; num: number }>)
  }
}

async function send() {
  const msg = input.value.trim()
  if (!msg || loading.value) return

  aiStore.addMessage('user', msg)
  input.value = ''
  aiStore.loading = true
  scrollToBottom()

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: msg,
        tenants: tenantsStore.tenants.map((t) => ({
          id: t.id,
          name: t.name,
          cat: t.cat,
          num: t.num,
          x: t.x,
          y: t.y,
          w: t.w,
          h: t.h,
        })),
        llm: provider.value,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'サーバーエラー' }))
      aiStore.addMessage('assistant', `エラー: ${err.error ?? 'リクエストに失敗しました'}`)
      return
    }

    const data = await res.json()
    aiStore.addMessage('assistant', data.message || '（応答なし）')

    for (const tr of data.toolResults ?? []) {
      if (tr.result?.success) applyToolResult(tr.toolName, tr.result)
    }
  } catch (err) {
    console.error('[AiChat]', err)
    aiStore.addMessage(
      'assistant',
      'Mastraサーバーに接続できませんでした。`pnpm start` でバックエンドを起動してください。',
    )
  } finally {
    aiStore.loading = false
    scrollToBottom()
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight
  })
}

watch(messages, scrollToBottom)
</script>

<template>
  <div :class="['ai-panel', panelOpen && 'open']">
    <!-- ヘッダー -->
    <div class="ai-header">
      <div class="ai-title">
        <span class="ai-icon">✦</span>
        <span>AI アシスタント</span>
      </div>
      <div class="llm-tabs">
        <button
          v-for="p in PROVIDERS"
          :key="p.key"
          :class="['llm-tab', provider === p.key && 'on']"
          :style="provider === p.key ? { background: p.color, color: '#fff' } : {}"
          @click="aiStore.setProvider(p.key)"
        >
          {{ p.label }}
        </button>
      </div>
      <button class="close-btn" title="閉じる" @click="aiStore.togglePanel()">
        <Icon name="close" />
      </button>
    </div>

    <!-- メッセージ一覧 -->
    <div ref="messagesEl" class="ai-messages">
      <div v-if="messages.length === 0" class="ai-empty">
        <p>レイアウトについて相談してみましょう。</p>
      </div>

      <div v-for="(m, i) in messages" :key="i" :class="['msg', m.role]">
        <div class="msg-speaker">{{ m.role === 'user' ? 'ユーザー' : 'AIアシスタント' }}</div>
        <div class="msg-bubble">{{ m.content }}</div>
      </div>

      <div v-if="loading" class="msg assistant">
        <div class="msg-bubble loading">
          <span class="dot" />
          <span class="dot" />
          <span class="dot" />
        </div>
      </div>
    </div>

    <!-- 入力エリア -->
    <div class="ai-input-area">
      <textarea
        v-model="input"
        class="ai-textarea"
        placeholder="正面入り口の近くにインフォメーションを配置して"
        rows="2"
        :disabled="loading"
        @keydown="onKeydown"
      />
      <button class="send-btn" :disabled="loading || !input.trim()" @click="send">
        <Icon name="chevron_down" style="transform: rotate(-90deg)" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.ai-panel {
  position: fixed;
  right: 0;
  bottom: 0;
  top: 46px; /* topbar height */
  width: 320px;
  background: var(--surface);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  z-index: 50;
  transform: translateX(100%);
  transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: var(--shadow-lg);
}
.ai-panel.open {
  transform: translateX(0);
}

.ai-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.ai-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ink-2);
}
.ai-icon {
  color: var(--accent);
  font-size: 13px;
}
.llm-tabs {
  display: flex;
  gap: 3px;
  margin-left: auto;
}
.llm-tab {
  height: 22px;
  padding: 0 8px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: var(--bg-2);
  font-size: 10.5px;
  font-weight: 600;
  color: var(--ink-3);
  cursor: pointer;
  transition: all 0.12s;
}
.llm-tab:hover { color: var(--ink-1); }
.llm-tab.on { border-color: transparent; }
.close-btn {
  width: 24px;
  height: 24px;
  border: 0;
  background: transparent;
  color: var(--ink-3);
  cursor: pointer;
  border-radius: 6px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.close-btn:hover { background: var(--bg-2); color: var(--ink-1); }
.close-btn svg { width: 14px; height: 14px; }

.ai-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ai-empty {
  padding: 20px 0;
  color: var(--ink-3);
  font-size: 12.5px;
  text-align: center;
}
.ai-empty p { margin: 0 0 12px; }
.ai-examples {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--ink-4);
}
.ai-examples code {
  background: var(--bg-2);
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 11.5px;
  font-family: var(--font-sans);
  color: var(--ink-2);
}

.msg {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.msg.user { align-items: flex-end; }
.msg.assistant { align-items: flex-start; }
.msg-bubble {
  max-width: 90%;
  padding: 8px 10px;
  border-radius: 12px;
  font-size: 12.5px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}
.msg.user .msg-bubble {
  background: var(--accent);
  color: var(--on-accent);
  border-bottom-right-radius: 4px;
}
.msg.assistant .msg-bubble {
  background: var(--bg-2);
  color: var(--ink-1);
  border-bottom-left-radius: 4px;
}
.msg-speaker {
  font-size: 10px;
  font-weight: 600;
  color: var(--ink-3);
  padding: 0 4px;
}

.msg-bubble.loading {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 10px 14px;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ink-3);
  animation: bounce 1.2s infinite ease-in-out;
}
.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes bounce {
  0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}

.ai-input-area {
  display: flex;
  gap: 6px;
  padding: 10px 12px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}
.ai-textarea {
  flex: 1;
  background: var(--bg-2);
  border: 1px solid transparent;
  border-radius: 10px;
  padding: 6px 10px;
  font-size: 12.5px;
  font-family: var(--font-sans);
  color: var(--ink-1);
  resize: none;
  line-height: 1.4;
  transition: border-color 0.12s;
}
.ai-textarea:focus {
  outline: none;
  border-color: var(--accent);
  background: var(--surface);
}
.ai-textarea::placeholder { color: var(--ink-4); }
.ai-textarea:disabled { opacity: 0.6; }
.send-btn {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: 0;
  background: var(--accent);
  color: var(--on-accent);
  display: grid;
  place-items: center;
  cursor: pointer;
  flex-shrink: 0;
  align-self: flex-end;
  transition: background 0.12s;
}
.send-btn:hover { background: var(--accent-strong); }
.send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.send-btn svg { width: 15px; height: 15px; }
</style>
