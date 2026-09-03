/** 模型选择目录的本地 UI 类型：由官方 ModelMetadata 投影。 */
export interface ChatInputModelInfo {
  id: string
  name: string
  thinkingLevels: string[]
  contextWindow?: number
}

export interface ChatInputVendor {
  id: string
  name: string
  models: ChatInputModelInfo[]
}

export interface ChatInputModel {
  provider: string
  id: string
}

/** 输入卡执行档：本地模型引用与思考档位。 */
export interface ChatInputPreset {
  model: ChatInputModel
  thinkingLevel: string
}
