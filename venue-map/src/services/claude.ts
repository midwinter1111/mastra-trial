import Anthropic from '@anthropic-ai/sdk'

const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY

export const isClaudeAvailable = (): boolean => Boolean(apiKey)

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY が設定されていません')
  if (!client) {
    client = new Anthropic({
      apiKey,
      // PoC のみ。本番環境ではサーバーサイドプロキシを経由してください
      dangerouslyAllowBrowser: true,
    })
  }
  return client
}

export interface TenantSuggestion {
  cat: string
  size: string
  memo: string
}

export async function completeTenantInfo(name: string): Promise<TenantSuggestion> {
  const res = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `あなたはイベント会場の出店管理システムです。
テナント名「${name}」から、以下の情報を推測してJSON形式のみで返してください。

カテゴリ（cat）は以下のいずれか:
- food: 飲食（食べ物全般）
- drink: ドリンク（飲み物専門）
- goods: 物販（雑貨・アクセサリー等）
- service: サービス（体験・ワークショップ等）
- stage: ステージ（パフォーマンス・演奏）
- info: インフォ（案内・救護所等）

サイズ（size）は実寸表示文字列（例: "1.2 x 1.0m"）
メモ（memo）は運営上の注意事項（1〜2文、なければ空文字）

必ずJSONのみを返し、説明文・コードブロックは不要です。
例: {"cat": "food", "size": "1.2 x 1.0m", "memo": "焼き菓子の香りが広がりやすいため、風向き注意。"}`,
      },
    ],
  })

  const text = res.content[0].type === 'text' ? res.content[0].text : ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return { cat: 'food', size: '1.0 x 1.0m', memo: '' }

  try {
    return JSON.parse(match[0]) as TenantSuggestion
  } catch {
    return { cat: 'food', size: '1.0 x 1.0m', memo: '' }
  }
}
