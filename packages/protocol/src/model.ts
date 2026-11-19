export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max"

export interface ModelRef {
  provider: string
  id: string
}

/** 宿主改过供应商配置、凭据或模型目录后经 pi.events 发的通知；扩展收到就丢掉缓存的模型运行时。 */
export interface ModelChannels {
  "pig:models:changed": undefined
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
