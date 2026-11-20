export interface ComposerModelInfo {
  id: string
  name: string
  thinkingLevels: string[]
  contextWindow?: number
}

export interface ComposerVendor {
  id: string
  name: string
  models: ComposerModelInfo[]
}

export interface ComposerModel {
  provider: string
  id: string
}

export interface ComposerPreset {
  model: ComposerModel
  thinkingLevel: string
}

export type { ContextUsage, ContextUsageSegment } from "@features/session/lib/context-usage.js"
