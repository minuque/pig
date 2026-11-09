export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max"

export interface ModelRef {
  provider: string
  id: string
}

export interface ModelMetadata extends ModelRef {
  name: string
  api: string
  reasoning: boolean
  input: Array<"text" | "image">
  contextWindow: number
  maxTokens: number
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number }
  supportedThinkingLevels: ThinkingLevel[]
  authenticated: boolean
}
