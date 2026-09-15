/** 模型选择目录的本地 UI 类型：由官方 ModelMetadata 投影。 */
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

/** 输入卡执行档：本地模型引用与思考档位。 */
export interface ComposerPreset {
  model: ComposerModel
  thinkingLevel: string
}

export interface ContextUsageSegment {
  id:
    | "systemPrompt"
    | "memory"
    | "skills"
    | "tools"
    | "toolResults"
    | "conversation"
    | "other"
    | "idle"
  label: string
  tokens: number
  color: string
  previewable: boolean
}

export interface ContextUsage {
  used: number
  window: number
  percent: number
  segments: ContextUsageSegment[]
}
