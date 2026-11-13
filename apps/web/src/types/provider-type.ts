/** 供应商配置页自己的界面类型；接口数据形状在 @pig/protocol。 */
import type { ProviderView, ThinkingLevel } from "@/types/common-type.js"

export interface SamplingParamRow {
  key: string
  value: string
}

export interface ModelParamsFormState {
  thinkingLevel: ThinkingLevel | null
  maxTokens: string
  contextWindow: string
  samplingParams: SamplingParamRow[]
}

export type ProviderBadge = "connected" | "disconnected" | "authorizing"

export type ProviderSourceText = "app" | "environment" | "modelsJson" | "none"

export type ProviderGroupId = "connected" | "builtin" | "custom"

export interface ProviderGroup {
  id: ProviderGroupId
  providers: ProviderView[]
}
