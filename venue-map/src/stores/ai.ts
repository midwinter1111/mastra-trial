import { defineStore } from 'pinia'
import { ref } from 'vue'

export type LLMProvider = 'claude' | 'openai' | 'gemini'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ToolResult {
  toolName: string
  result: {
    success?: boolean
    updates?: Array<{ id: string; x: number; y: number; w: number; h: number }>
    assignments?: Array<{ id: string; num: number }>
    message?: string
  }
}

export const useAIStore = defineStore('ai', () => {
  const provider = ref<LLMProvider>('claude')
  const messages = ref<ChatMessage[]>([])
  const loading = ref(false)
  const panelOpen = ref(false)

  function setProvider(p: LLMProvider) {
    provider.value = p
  }

  function togglePanel() {
    panelOpen.value = !panelOpen.value
  }

  function addMessage(role: 'user' | 'assistant', content: string) {
    messages.value.push({ role, content })
  }

  function clearMessages() {
    messages.value = []
  }

  return { provider, messages, loading, panelOpen, setProvider, togglePanel, addMessage, clearMessages }
})
