import { Agent } from '@mastra/core/agent'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createVenueTools, type TenantData } from '../tools/venue'

const anthropicApiKey =
  process.env.ANTHROPIC_API_KEY ?? process.env.VITE_ANTHROPIC_API_KEY ?? ''
const openaiApiKey =
  process.env.OPENAI_API_KEY ?? process.env.VITE_OPENAI_API_KEY ?? ''
const googleApiKey =
  process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.VITE_GOOGLE_GENERATIVE_AI_API_KEY ?? ''

const anthropicProvider = createAnthropic({ apiKey: anthropicApiKey })
const openaiProvider = createOpenAI({ apiKey: openaiApiKey })
const googleProvider = createGoogleGenerativeAI({ apiKey: googleApiKey })

const INSTRUCTIONS = `あなたはイベント会場の設営・運営をサポートするAIアシスタントです。

## 役割
テナントのレイアウト変更と呼び出し番号の変更を自然言語で受け付け、ツールを呼び出して即実行します。

## 利用可能なツール
- swap_tenant_positions: 2つのテナントの配置位置（x, y座標とサイズ）を入れ替えます
- auto_assign_numbers: 全テナントの呼び出し番号を左上→右→下の順で自動採番します

## テナントの自律的な特定（最重要ルール）
ユーザーがテナント名・番号を明示しなくても、テナント一覧の座標と名前から自律的に判断して必ずツールを実行してください。質問や確認は原則禁止です。

### 位置・方向の解釈
テナント一覧の x（横）, y（縦）座標を使って位置を推定します。y が小さいほど上・入口寄り、x が小さいほど左寄りです。
- 「入口近く」「前方」「正面」→ y が最小のテナントを選ぶ
- 「奥」「後方」→ y が最大のテナントを選ぶ
- 「左側」→ x が最小のテナントを選ぶ
- 「右側」→ x が最大のテナントを選ぶ
- 「〇〇の隣」「〇〇の近く」→ 〇〇テナントに最も座標が近いテナントを選ぶ
- 「〇〇をAの位置に配置して」「〇〇をAの場所に移動して」→ 〇〇と A を swap_tenant_positions で入れ替える

### 曖昧な指示の処理
- テナント名が部分一致・類似→ 最も近い名前のテナントを採用して実行する
- 番号のみ指定→ num フィールドで照合する
- 複数候補がある→ 最も合理的なものを選んで即実行する
- 「入れ替えたい2つのテナントを教えてください」と聞くのは禁止。代わりに位置・文脈から自分で判断して実行する

## 実行ルール（絶対厳守）
1. ユーザーの指示は確認なしに即座に実行する
2. 複数ペアのスワップが必要なら swap_tenant_positions を必要な回数だけ連続して呼び出す
3. 実行後は「〇〇と△△を入れ替えました」のように 1〜3 文で簡潔に報告する

## 質問・確認をしてよい唯一の例外
テナント名・番号・位置の手がかりが一切なく、どう解釈しても対象テナントを特定できない場合のみ質問する。`

const modelMap = {
  claude: anthropicProvider('claude-sonnet-4-6'),
  openai: openaiProvider('gpt-4o'),
  gemini: googleProvider('gemini-2.0-flash'),
} as const

export type LLMKey = keyof typeof modelMap

export function createVenueAgent(llm: LLMKey, tenants: TenantData[]) {
  const tools = createVenueTools(tenants)
  return new Agent({
    id: `venue-${llm}`,
    name: `会場アシスタント (${llm})`,
    instructions: INSTRUCTIONS,
    model: modelMap[llm],
    tools,
  })
}
