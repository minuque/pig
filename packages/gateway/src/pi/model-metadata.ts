import { getSupportedThinkingLevels, type Api, type Model } from "@earendil-works/pi-ai"
import type { ModelMetadata } from "@pig/protocol"

const nonNegative = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0)

/** pi 模型 → 界面用的模型目录项；数值钳到合法范围。 */
export function toModelMetadata(model: Model<Api>, authenticated: boolean): ModelMetadata {
  return {
    provider: model.provider,
    id: model.id,
    name: model.name,
    api: model.api,
    reasoning: model.reasoning,
    input: [...model.input],
    contextWindow: Math.max(1, Math.floor(model.contextWindow)),
    maxTokens: Math.max(1, Math.floor(model.maxTokens)),
    cost: {
      input: nonNegative(model.cost.input),
      output: nonNegative(model.cost.output),
      cacheRead: nonNegative(model.cost.cacheRead),
      cacheWrite: nonNegative(model.cost.cacheWrite),
    },
    supportedThinkingLevels: getSupportedThinkingLevels(model),
    authenticated,
  }
}
